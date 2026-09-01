import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { Test } from "@nestjs/testing";
import { ValidationPipe } from "@nestjs/common";
import { AppModule } from "../src/app.module.js";
import { HvacRepository } from "../src/database/hvac.repository.js";
import { SupabaseService } from "../src/database/supabase.service.js";
import { SUPABASE_CLIENT } from "../src/database/database.tokens.js";
import { MqttClientService } from "../src/mqtt/mqtt-client.service.js";
import { createFakeRepository } from "./fake-repository.js";

function createMqttDouble() {
  return {
    subscribe: () => () => undefined,
    publish: async () => true,
    isConnected: () => true,
  };
}

async function startApp(databaseAvailable = true) {
  process.env.MQTT_ENABLED = "false";
  const { repository } = createFakeRepository();
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(SUPABASE_CLIENT)
    .useValue({})
    .overrideProvider(SupabaseService)
    .useValue({ checkConnection: async () => databaseAvailable })
    .overrideProvider(HvacRepository)
    .useValue(repository)
    .overrideProvider(MqttClientService)
    .useValue(createMqttDouble())
    .compile();
  const app = module.createNestApplication();
  app.setGlobalPrefix("api");
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, transformOptions: { enableImplicitConversion: true } }));
  await app.listen(0);
  const address = app.getHttpServer().address();
  return { app, base: `http://127.0.0.1:${address.port}` };
}

async function request(base, path, options) {
  const response = await fetch(`${base}${path}`, { headers: { "Content-Type": "application/json" }, ...options });
  const body = response.status === 204 ? null : await response.json();
  return { response, body };
}

test("Nest HTTP routes preserve client paths, verbs, payload names, and validation errors", async () => {
  const { app, base } = await startApp();
  try {
    const health = await request(base, "/api/health");
    assert.equal(health.response.status, 200);
    assert.equal(health.body.ok, true);
    assert.ok(Number.isFinite(Date.parse(health.body.ts)));

    const readiness = await request(base, "/api/health/ready");
    assert.equal(readiness.response.status, 200);
    assert.deepEqual(readiness.body.checks, { database: "ok", mqtt: "disabled" });
    const metrics = await request(base, "/api/health/metrics");
    assert.equal(metrics.response.status, 200);
    assert.equal(metrics.body.database.errors, 0);

    const state = await request(base, "/api/estado");
    assert.equal(state.response.status, 200);
    assert.deepEqual(Object.keys(state.body).sort(), ["banheiros", "climatizadores", "conexao", "exaustao", "salas", "timestamp"].sort());
    assert.equal(state.body.salas[0].climatizadorId, "clima-1");
    assert.equal(state.body.banheiros[0].luz, false);

    const history = await request(base, "/api/historico/sala-1/temperatura");
    assert.equal(history.response.status, 200);
    assert.deepEqual(history.body, []);

    for (const path of ["/api/parametros", "/api/alertas", "/api/ntfy", "/api/ntfy/log", "/api/eventos", "/api/identificacao", "/api/salas", "/api/climatizadores", "/api/banheiros"]) {
      const result = await request(base, path);
      assert.equal(result.response.status, 200, path);
    }

    const thresholds = await request(base, "/api/parametros/sala-1", { method: "PUT", body: JSON.stringify({ co2: { warn: 850, critical: 1100 } }) });
    assert.equal(thresholds.response.status, 200);
    assert.equal(thresholds.body["sala-1"].co2.critical, 1100);

    const setpoint = await request(base, "/api/salas/sala-1/setpoint", { method: "PUT", body: JSON.stringify({ setpoint: 24 }) });
    assert.equal(setpoint.response.status, 200);
    assert.equal(setpoint.body.setpoint, 24);

    const vavMode = await request(base, "/api/salas/sala-1/vav/modo", { method: "PUT", body: JSON.stringify({ modo: "manual" }) });
    assert.equal(vavMode.response.status, 200);
    assert.equal(vavMode.body.vav.modo, "manual");
    const vav = await request(base, "/api/salas/sala-1/vav", { method: "PUT", body: JSON.stringify({ abertura: 55 }) });
    assert.equal(vav.response.status, 200);
    assert.equal(vav.body.vav.abertura, 55);
    const fault = await request(base, "/api/salas/sala-1/vav/falha", { method: "PUT", body: JSON.stringify({ falha: true }) });
    assert.equal(fault.response.status, 200);
    assert.equal(fault.body.vav.estado, "falha");

    const climatizer = await request(base, "/api/climatizadores/clima-1", { method: "PUT", body: JSON.stringify({ ligado: false }) });
    assert.equal(climatizer.response.status, 200);
    assert.equal(climatizer.body.ligado, false);
    const bathroom = await request(base, "/api/banheiros/ban-1", { method: "PUT", body: JSON.stringify({ luz: true }) });
    assert.equal(bathroom.response.status, 200);
    assert.deepEqual(bathroom.body.exaustao, { ligada: true, logica: "OR" });

    const ntfy = await request(base, "/api/ntfy", { method: "PUT", body: JSON.stringify({ enabled: false, topic: "new-topic" }) });
    assert.equal(ntfy.response.status, 200);
    assert.equal(ntfy.body.topic, "new-topic");
    const identification = await request(base, "/api/identificacao", { method: "PUT", body: JSON.stringify({ estabelecimento: "EAS" }) });
    assert.equal(identification.response.status, 200);
    assert.equal(identification.body.estabelecimento, "EAS");

    const telemetry = await request(base, "/api/telemetria", { method: "POST", body: JSON.stringify({ salaId: "sala-1", temperatura: 23, umidade: 52, co2: 700 }) });
    assert.equal(telemetry.response.status, 200);
    assert.equal(telemetry.body.ok, true);
    const external = await request(base, "/api/fonte-externa", { method: "PUT", body: JSON.stringify({ salaId: "sala-1" }) });
    assert.deepEqual(external.body, { externalRoom: "sala-1" });

    const alarming = await request(base, "/api/telemetria", { method: "POST", body: JSON.stringify({ salaId: "sala-1", co2: 1200 }) });
    assert.equal(alarming.response.status, 200);
    const alerts = await request(base, "/api/alertas");
    const co2Alert = alerts.body.find((alert) => alert.tipo === "co2");
    assert.ok(co2Alert);
    const acknowledged = await request(base, `/api/alertas/${co2Alert.id}/reconhecer`, { method: "POST" });
    assert.equal(acknowledged.response.status, 200);
    assert.equal(acknowledged.body.find((alert) => alert.id === co2Alert.id).reconhecido, true);
    const cleared = await request(base, "/api/alertas/reconhecidos", { method: "DELETE" });
    assert.equal(cleared.body.some((alert) => alert.id === co2Alert.id), false);

    const deviceVav = await request(base, "/api/vav/estado", { method: "POST", body: JSON.stringify({ salaId: "sala-1", abertura: 60, estado: "ok" }) });
    assert.deepEqual(deviceVav.body, { ok: true });
    const deviceBathroom = await request(base, "/api/banheiro/luz", { method: "POST", body: JSON.stringify({ banheiroId: "ban-1", luz: false }) });
    assert.deepEqual(deviceBathroom.body, { ok: true });

    const invalid = await request(base, "/api/telemetria", { method: "POST", body: JSON.stringify({ salaId: "sala-1", temperatura: 999, extra: true }) });
    assert.equal(invalid.response.status, 400);
    assert.equal(invalid.body.error, "Bad Request");
    assert.ok(invalid.body.message.length > 0);
  } finally {
    await app.close();
  }
});

test("readiness returns 503 when Supabase is unavailable", async () => {
  const { app, base } = await startApp(false);
  try {
    const readiness = await request(base, "/api/health/ready");
    assert.equal(readiness.response.status, 503);
    assert.equal(readiness.body.ok, false);
    assert.equal(readiness.body.checks.database, "error");
  } finally {
    await app.close();
  }
});
