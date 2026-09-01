import assert from "node:assert/strict";
import test from "node:test";
import { appendRealtimePoint, chartTime } from "../src/api/telemetry-chart-state.ts";
import type { TelemetryRealtimeEvent } from "../src/types/ui.ts";

const event: TelemetryRealtimeEvent = {
  name: "telemetry.updated",
  envelope: {
    eventId: "evt-1",
    version: 1,
    occurredAt: "2026-08-31T12:00:01.000Z",
    data: {
      roomId: "sala-1",
      temperature: 24,
      humidity: 52,
      co2: 820,
      source: "MQTT",
      timestamp: "2026-08-31T12:00:01.000Z",
      status: { temperatura: "normal", umidade: "normal", co2: "atencao" },
    },
  },
};

test("telemetry WebSocket event appends chart point without duplicate", () => {
  const first = appendRealtimePoint([], event, "Sala 1", "temperatura");
  assert.deepEqual(first, [{ t: chartTime(event.envelope.data.timestamp), "Sala 1": 24 }]);
  assert.strictEqual(appendRealtimePoint(first, event, "Sala 1", "temperatura"), first);
});

test("telemetry WebSocket event updates same timestamp point", () => {
  const updated = appendRealtimePoint([{ t: chartTime(event.envelope.data.timestamp), "Sala 1": 22 }], event, "Sala 1", "temperatura");
  assert.deepEqual(updated, [{ t: chartTime(event.envelope.data.timestamp), "Sala 1": 24 }]);
});
