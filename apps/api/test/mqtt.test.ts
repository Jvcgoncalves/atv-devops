import assert from "node:assert/strict";
import test from "node:test";
import { MqttIngestionService } from "../src/mqtt/mqtt-ingestion.service.js";

const message = (topic, body, messageId = 7) => ({ topic, payload: Buffer.from(JSON.stringify(body)), messageId });
const settle = () => new Promise((resolve) => setImmediate(resolve));

function createHarness() {
  let listener;
  const calls = { telemetry: [], vav: [], bathroom: [], realtime: [] };
  const mqtt = { subscribe: (callback) => { listener = callback; return () => undefined; } };
  const service = new MqttIngestionService(
    mqtt,
    { ingest: async (...args) => calls.telemetry.push(args) },
    { ingestVavState: async (...args) => calls.vav.push(args) },
    { update: async (...args) => calls.bathroom.push(args) },
    { publish: (...args) => calls.realtime.push(args) },
  );
  service.onModuleInit();
  return { listener, calls };
}

test("MQTT maps telemetry topic and payload to one ingestion call", async () => {
  const harness = createHarness();
  await harness.listener(message("hvac/sala/1/telemetria", { temperatura: 22.5, umidade: 50, co2: 700 }));
  await settle();
  assert.deepEqual(harness.calls.telemetry[0], [{ salaId: "sala-1", temperatura: 22.5, umidade: 50, co2: 700 }, "MQTT", "hvac/sala/1/telemetria:7"]);
});

test("MQTT routes VAV, bathroom, status, and malformed messages without cross-routing", async () => {
  const harness = createHarness();
  await harness.listener(message("hvac/sala/1/vav", { abertura: 60, estado: "ok" }));
  await harness.listener(message("hvac/banheiro/1/luz", { luz: true }));
  await harness.listener(message("hvac/status", { online: false }));
  await harness.listener({ topic: "hvac/sala/1/telemetria", payload: Buffer.from("bad"), messageId: 8 });
  await settle();

  assert.deepEqual(harness.calls.vav, [["sala-1", 60, "ok"]]);
  assert.deepEqual(harness.calls.bathroom, [["ban-1", true, false]]);
  assert.deepEqual(harness.calls.realtime, [["device.status.changed", { deviceId: "hvac/status", online: false }]]);
  assert.equal(harness.calls.telemetry.length, 0);
});
