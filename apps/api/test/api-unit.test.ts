import assert from "node:assert/strict";
import test from "node:test";
import { AlertsService } from "../src/alerts/alerts.service.js";
import { BathroomsService } from "../src/bathrooms/bathrooms.service.js";
import { ClimatizersService } from "../src/climatizers/climatizers.service.js";
import { AuditService } from "../src/audit/audit.service.js";
import { NotificationsService } from "../src/notifications/notifications.service.js";
import { RoomsService } from "../src/rooms/rooms.service.js";
import { StateService } from "../src/state/state.service.js";
import { TelemetryService } from "../src/telemetry/telemetry.service.js";
import { ThresholdsService } from "../src/thresholds/thresholds.service.js";
import { mapAlert, mapRoom, mapSystemState } from "../src/mappers/response-mappers.js";
import { createFakeRepository } from "./fake-repository.js";

const connectedMqtt = (published = []) => ({
  isConnected: () => true,
  publish: async (topic, payload) => {
    published.push({ topic, payload });
    return true;
  },
});

test("response mappers preserve public camelCase contract", () => {
  const room = mapRoom(
    {
      id: "sala-1",
      name: "Sala 1",
      floor: "1",
      climatizer_id: "clima-1",
      setpoint: 22,
      current_temperature: 22.6,
      current_humidity: 51,
      current_co2: 640,
      last_reading_at: "2026-08-31T12:00:00.000Z",
      telemetry_source: "MQTT",
    },
    { id: "vav-1", room_id: "sala-1", state: "ok", opening: 40, airflow: 0, mode: "auto", reason: "estavel" },
    undefined,
  );
  const state = mapSystemState([room], [{ id: "clima-1", nome: "Climatizador A", salas: ["sala-1"], ligado: true, tempInsuflamento: 15 }], [{ id: "ban-1", nome: "Banheiro 1", luz: true }], true, "MQTT", "2026-08-31T12:00:00.000Z");

  assert.equal(room.climatizadorId, "clima-1");
  assert.deepEqual(room.vav, { abertura: 40, estado: "ok", modo: "auto", motivo: "estavel" });
  assert.deepEqual(state.exaustao, { ligada: true, logica: "OR" });
  assert.equal(state.timestamp, "2026-08-31T12:00:00.000Z");
});

test("StateService assembles persisted state and connection source", async () => {
  const { repository } = createFakeRepository();
  const state = new StateService(repository, connectedMqtt());
  const result = await state.getState();

  assert.equal(result.salas.length, 2);
  assert.equal(result.salas[0].nome, "Sala 1");
  assert.equal(result.climatizadores[0].salas[1], "sala-2");
  assert.equal(result.conexao.online, true);
  assert.equal(result.conexao.fonte, "MQTT");
});

test("RoomsService validates setpoints, rounds VAV opening, publishes command, and audits", async () => {
  const { repository } = createFakeRepository();
  const published = [];
  const audits = [];
  const service = new RoomsService(
    repository,
    new StateService(repository, connectedMqtt()),
    connectedMqtt(published),
    { record: async (...args) => audits.push(args) },
    { evaluateRoom: async () => [] },
    { publish: () => undefined },
  );

  const room = await service.setVavOpening("sala-1", 41.6);
  assert.equal(room.vav.abertura, 42);
  assert.deepEqual(published[0], { topic: "hvac/sala/1/vav/set", payload: { abertura: 42 } });
  assert.equal(audits[0][0], "vav");
  await assert.rejects(() => service.setpoint("sala-1", 31), /setpoint deve estar entre 16 e 30/);
});

test("ClimatizersService maps patch to database columns and publishes device command", async () => {
  const { repository } = createFakeRepository();
  const published = [];
  const audits = [];
  const state = new StateService(repository, connectedMqtt());
  const service = new ClimatizersService(repository, state, connectedMqtt(published), { record: async (...args) => audits.push(args) });

  const result = await service.update("clima-1", { ligado: false, tempInsuflamento: 16 });
  assert.equal(result.ligado, false);
  assert.equal(result.tempInsuflamento, 16);
  assert.deepEqual(published[0], { topic: "hvac/clima/1/set", payload: { ligado: false, tempInsuflamento: 16 } });
  assert.equal(audits.length, 2);
});

test("BathroomsService derives exhaust with OR and publishes operator changes", async () => {
  const { repository } = createFakeRepository();
  const published = [];
  const service = new BathroomsService(repository, connectedMqtt(published), { record: async () => undefined });

  const result = await service.update("ban-1", true);
  assert.equal(result.exaustao.ligada, true);
  assert.deepEqual(published[0], { topic: "hvac/banheiro/1/luz", payload: { luz: true } });
  await service.update("ban-1", false);
  assert.equal((await service.list()).find((bathroom) => bathroom.id === "ban-1").luz, false);
});

test("TelemetryService validates, persists once, evaluates alerts, audits, and emits after persistence", async () => {
  const { repository, readings } = createFakeRepository();
  const calls = [];
  const state = new StateService(repository, connectedMqtt());
  const service = new TelemetryService(
    repository,
    state,
    { evaluateRoom: async (...args) => calls.push(["alert", ...args]) },
    { record: async (...args) => calls.push(["audit", ...args]) },
    { publish: (...args) => calls.push(["event", ...args]) },
  );

  const response = await service.ingest({ salaId: "sala-1", temperatura: 22.8, umidade: 52, co2: 700 }, "MQTT", "packet-1");
  assert.equal(response.ok, true);
  assert.equal(readings.length, 3);
  assert.equal(calls.at(-1)[0], "event");
  assert.equal(calls.at(-1)[1], "telemetry.updated");
  assert.deepEqual(calls.at(-1)[2].source, "MQTT");

  const duplicate = await service.ingest({ salaId: "sala-1", temperatura: 22.8, umidade: 52, co2: 700 }, "MQTT", "packet-1");
  assert.equal(duplicate.ok, true);
  assert.equal(calls.filter((call) => call[0] === "event").length, 1);
});

test("AlertsService deduplicates active alerts and acknowledgement emits update", async () => {
  const { repository } = createFakeRepository();
  const realtime = [];
  const service = new AlertsService(
    repository,
    { sendAlert: async () => undefined },
    { record: async () => undefined },
    { publish: (...args) => realtime.push(args) },
  );
  const room = {
    id: "sala-1", nome: "Sala 1", climatizadorId: "clima-1", setpoint: 22,
    temperatura: 29, umidade: 50, co2: 700,
    vav: { abertura: 40, estado: "ok", modo: "auto", motivo: "estavel" },
    ultimaLeitura: "2026-08-31T12:00:00.000Z",
    status: { temperatura: "critico", umidade: "normal", co2: "normal" },
  };
  const thresholds = { temperatura: { min: 20, max: 26, unit: "C" }, umidade: { min: 40, max: 60, unit: "%" }, co2: { warn: 800, critical: 1000, unit: "ppm" } };

  const first = await service.evaluateRoom(room, thresholds);
  const second = await service.evaluateRoom(room, thresholds);
  assert.equal(first.length, 1);
  assert.equal(second.length, 0);
  assert.equal(realtime[0][0], "alert.created");
  const list = await service.acknowledge(first[0].id);
  assert.equal(list[0].reconhecido, true);
  assert.equal(realtime.at(-1)[0], "alert.updated");
});

test("ThresholdsService rejects invalid ranges and persists valid updates", async () => {
  const { repository } = createFakeRepository();
  const service = new ThresholdsService(
    repository,
    new StateService(repository, connectedMqtt()),
    { evaluateRoom: async () => undefined },
    { record: async () => undefined },
  );

  await assert.rejects(() => service.update("sala-1", { temperatura: { min: 25, max: 20 } }), /faixas de alerta invalidas/);
  const updated = await service.update("sala-1", { co2: { warn: 850, critical: 1100 } });
  assert.equal(updated["sala-1"].co2.warn, 850);
  assert.equal(updated["sala-1"].co2.critical, 1100);
});

test("NotificationsService sends eligible ntfy alert and records delivery", async () => {
  const { repository } = createFakeRepository();
  const previousFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url, options) => {
    requests.push({ url, options });
    return new Response(null, { status: 200 });
  };
  try {
    const service = new NotificationsService(repository, { record: async () => undefined });
    await service.sendAlert({ id: "alt-1", level: "critico", tipo: "co2", mensagem: "CO2 alto", salaId: "sala-1", ts: "2026-08-31T12:00:00.000Z", reconhecido: false });
    assert.equal(requests[0].url, "https://ntfy.sh/tcc-hvac-alertas");
    assert.equal(requests[0].options.headers.Priority, "urgent");
    assert.equal((await service.listLog()).length, 1);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("Alerts and state mappers tolerate missing optional persisted rows", () => {
  const alert = mapAlert({ id: "alt-1", level: "atencao", alert_type: "co2", message: "CO2", room_id: null, sensor_id: null, alert_key: "sys:co2:atencao", acknowledged: false, acknowledged_at: null, resolved_at: null, occurred_at: "2026-08-31T12:00:00.000Z" });
  assert.deepEqual(alert, { id: "alt-1", level: "atencao", tipo: "co2", mensagem: "CO2", salaId: null, ts: "2026-08-31T12:00:00.000Z", reconhecido: false, key: "sys:co2:atencao" });
});
