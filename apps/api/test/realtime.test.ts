import assert from "node:assert/strict";
import test from "node:test";
import { RealtimeGateway } from "../src/realtime/realtime.gateway.js";
import { RealtimeService } from "../src/realtime/realtime.service.js";

const state = { timestamp: "2026-08-31T12:00:00.000Z", conexao: { online: true, fonte: "MQTT" }, salas: [], climatizadores: [], banheiros: [], exaustao: { ligada: false, logica: "OR" } };

test("RealtimeService emits unique monotonic envelopes", () => {
  const service = new RealtimeService();
  const events = [];
  service.subscribe((event) => events.push(event));
  const first = service.publish("telemetry.updated", { roomId: "sala-1", temperature: 22, humidity: 50, co2: 700, source: "MQTT" });
  const second = service.publish("device.status.changed", { deviceId: "hvac/status", online: true });

  assert.equal(first.envelope.version, 1);
  assert.equal(second.envelope.version, 2);
  assert.notEqual(first.envelope.eventId, second.envelope.eventId);
  assert.equal(events.length, 2);
});

test("RealtimeGateway authenticates, sends one initial snapshot, and broadcasts later events", async () => {
  const previousToken = process.env.REALTIME_AUTH_TOKEN;
  const previousOrigins = process.env.REALTIME_ALLOWED_ORIGINS;
  process.env.REALTIME_AUTH_TOKEN = "secret";
  process.env.REALTIME_ALLOWED_ORIGINS = "http://dashboard.test";
  try {
    const realtime = new RealtimeService();
    const serverEvents = [];
    const gateway = new RealtimeGateway(realtime, { getState: async () => state });
    gateway.server = { emit: (...args) => serverEvents.push(args) };
    gateway.onModuleInit();
    const clientEvents = [];
    const client = { handshake: { auth: { token: "secret" }, headers: { origin: "http://dashboard.test" } }, emit: (...args) => clientEvents.push(args), disconnect: () => { throw new Error("valid client disconnected"); } };
    await gateway.handleConnection(client);
    assert.equal(clientEvents.length, 1);
    assert.equal(clientEvents[0][0], "system.snapshot");
    assert.equal(serverEvents.length, 0);

    realtime.publish("telemetry.updated", { roomId: "sala-1", temperature: 22, humidity: 50, co2: 700, source: "MQTT" });
    assert.equal(serverEvents.length, 1);
    assert.equal(serverEvents[0][0], "telemetry.updated");

    const rejected = { handshake: { auth: { token: "wrong" }, headers: { origin: "http://dashboard.test" } }, emit: () => undefined, disconnect: () => { rejected.disconnected = true; } };
    await gateway.handleConnection(rejected);
    assert.equal(rejected.disconnected, true);
  } finally {
    if (previousToken === undefined) delete process.env.REALTIME_AUTH_TOKEN;
    else process.env.REALTIME_AUTH_TOKEN = previousToken;
    if (previousOrigins === undefined) delete process.env.REALTIME_ALLOWED_ORIGINS;
    else process.env.REALTIME_ALLOWED_ORIGINS = previousOrigins;
  }
});
