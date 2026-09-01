import assert from "node:assert/strict";
import test from "node:test";
import { applyRealtimeEvent } from "../src/api/realtime-state.ts";

const state = {
  timestamp: "2026-08-31T12:00:00.000Z",
  conexao: { online: true, fonte: "MQTT" },
  salas: [{
    id: "sala-1", nome: "Sala 1", climatizadorId: "clima-1", setpoint: 22,
    temperatura: 22, umidade: 50, co2: 700,
    vav: { abertura: 40, estado: "ok", modo: "auto", motivo: "estavel" },
    ultimaLeitura: "2026-08-31T12:00:00.000Z",
    status: { temperatura: "normal", umidade: "normal", co2: "normal" }, fonte: "MQTT",
  }],
  climatizadores: [], banheiros: [], exaustao: { ligada: false, logica: "OR" },
};

const alert = { id: "alt-1", level: "atencao", tipo: "co2", mensagem: "CO2 alto", salaId: "sala-1", ts: "2026-08-31T12:00:00.000Z", reconhecido: false };

function current() {
  return { state, alerts: [], liveData: null, liveTs: null, version: 0 };
}

function event(name, version, data) {
  return { name, envelope: { eventId: `evt-${version}`, version, occurredAt: "2026-08-31T12:00:01.000Z", data } };
}

test("telemetry event updates room and selected live data", () => {
  const next = applyRealtimeEvent(current(), event("telemetry.updated", 1, {
    roomId: "sala-1", temperature: 24, humidity: 52, co2: 820, source: "MQTT",
    timestamp: "2026-08-31T12:00:01.000Z", status: { temperatura: "normal", umidade: "normal", co2: "atencao" },
  }), "sala-1");

  assert.equal(next.state.salas[0].temperatura, 24);
  assert.equal(next.state.salas[0].status.co2, "atencao");
  assert.deepEqual(next.liveData, { temperature: 24, humidity: 52, co2: 820 });
  assert.equal(next.version, 1);
});

test("duplicate and older events are ignored; alert updates and removals are applied", () => {
  const created = applyRealtimeEvent(current(), event("alert.created", 2, { alert }), "sala-1");
  const duplicate = applyRealtimeEvent(created, event("alert.created", 2, { alert }), "sala-1");
  assert.equal(duplicate, created);

  const updated = applyRealtimeEvent(created, event("alert.updated", 3, { alert: { ...alert, reconhecido: true }, action: "updated" }), "sala-1");
  assert.equal(updated.alerts[0].reconhecido, true);
  const removed = applyRealtimeEvent(updated, event("alert.updated", 4, { alert: updated.alerts[0], action: "removed" }), "sala-1");
  assert.equal(removed.alerts.length, 0);
  assert.equal(applyRealtimeEvent(removed, event("alert.created", 1, { alert }), "sala-1"), removed);
});

test("snapshot replaces state and device event updates connectivity", () => {
  const replacement = { ...state, timestamp: "2026-08-31T12:01:00.000Z", salas: [] };
  const snapshot = applyRealtimeEvent(current(), event("system.snapshot", 5, { state: replacement }), "sala-1");
  assert.equal(snapshot.state.salas.length, 0);
  const offline = applyRealtimeEvent(current(), event("device.status.changed", 1, { deviceId: "hvac/status", online: false }), "sala-1");
  assert.equal(offline.state.conexao.online, false);
});
