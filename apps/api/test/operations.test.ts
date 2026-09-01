import assert from "node:assert/strict";
import test from "node:test";
import { OperationsService } from "../src/operations/operations.service.js";

test("operations snapshot tracks telemetry, alerts, MQTT reconnects, and errors", () => {
  const operations = new OperationsService();

  operations.recordTelemetryReceived();
  operations.recordTelemetryPersisted(3);
  operations.recordTelemetryDuplicate();
  operations.recordTelemetryRejected();
  operations.recordAlertCreated();
  operations.recordAlertError(new Error("alert write failed"));
  operations.recordMqttConnected();
  operations.recordMqttDisconnected();
  operations.recordMqttConnected();
  operations.recordMqttMessage();
  operations.recordMqttError(new Error("broker unavailable"));
  operations.recordDatabaseError(new Error("database unavailable"));

  const snapshot = operations.snapshot();
  assert.deepEqual(snapshot.telemetry, {
    received: 1,
    persisted: 3,
    duplicates: 1,
    rejected: 1,
    lastReceivedAt: snapshot.telemetry.lastReceivedAt,
    lastPersistedAt: snapshot.telemetry.lastPersistedAt,
  });
  assert.equal(snapshot.alerts.created, 1);
  assert.equal(snapshot.alerts.errors, 1);
  assert.equal(snapshot.mqtt.reconnects, 1);
  assert.equal(snapshot.mqtt.messages, 1);
  assert.equal(snapshot.mqtt.errors, 1);
  assert.equal(snapshot.mqtt.connected, true);
  assert.equal(snapshot.database.errors, 1);
  assert.equal(snapshot.database.lastError, "database unavailable");
});
