import { Injectable, Logger } from "@nestjs/common";
import type { OperationsSnapshot } from "./operations.types.js";

@Injectable()
export class OperationsService {
  private readonly logger = new Logger(OperationsService.name);
  private readonly startedAt = new Date().toISOString();
  private readonly telemetry = {
    received: 0,
    persisted: 0,
    duplicates: 0,
    rejected: 0,
    lastReceivedAt: null as string | null,
    lastPersistedAt: null as string | null,
  };
  private readonly alerts = {
    created: 0,
    errors: 0,
    lastCreatedAt: null as string | null,
    lastErrorAt: null as string | null,
  };
  private readonly mqtt = {
    connected: false,
    reconnects: 0,
    messages: 0,
    errors: 0,
    lastConnectedAt: null as string | null,
    lastDisconnectedAt: null as string | null,
    lastError: null as string | null,
    everConnected: false,
  };
  private readonly database = {
    errors: 0,
    lastErrorAt: null as string | null,
    lastError: null as string | null,
  };

  recordTelemetryReceived(): void {
    this.telemetry.received += 1;
    this.telemetry.lastReceivedAt = new Date().toISOString();
  }

  recordTelemetryPersisted(count: number): void {
    this.telemetry.persisted += count;
    this.telemetry.lastPersistedAt = new Date().toISOString();
  }

  recordTelemetryDuplicate(): void {
    this.telemetry.duplicates += 1;
  }

  recordTelemetryRejected(): void {
    this.telemetry.rejected += 1;
  }

  recordAlertCreated(): void {
    this.alerts.created += 1;
    this.alerts.lastCreatedAt = new Date().toISOString();
  }

  recordAlertError(error: unknown): void {
    this.alerts.errors += 1;
    this.alerts.lastErrorAt = new Date().toISOString();
    this.logger.error(JSON.stringify({ event: "alert_error", error: this.errorMessage(error) }));
  }

  recordMqttConnected(): void {
    if (this.mqtt.everConnected) this.mqtt.reconnects += 1;
    this.mqtt.everConnected = true;
    this.mqtt.connected = true;
    this.mqtt.lastConnectedAt = new Date().toISOString();
  }

  recordMqttDisconnected(): void {
    this.mqtt.connected = false;
    this.mqtt.lastDisconnectedAt = new Date().toISOString();
  }

  recordMqttMessage(): void {
    this.mqtt.messages += 1;
  }

  recordMqttError(error: unknown): void {
    this.mqtt.errors += 1;
    this.mqtt.lastError = this.errorMessage(error);
    this.logger.error(JSON.stringify({ event: "mqtt_error", error: this.mqtt.lastError }));
  }

  recordDatabaseError(error: unknown): void {
    this.database.errors += 1;
    this.database.lastErrorAt = new Date().toISOString();
    this.database.lastError = this.errorMessage(error);
    this.logger.error(JSON.stringify({ event: "database_error", error: this.database.lastError }));
  }

  snapshot(): OperationsSnapshot {
    return {
      startedAt: this.startedAt,
      telemetry: { ...this.telemetry },
      alerts: { ...this.alerts },
      mqtt: {
        enabled: process.env.MQTT_ENABLED !== "false",
        connected: this.mqtt.connected,
        reconnects: this.mqtt.reconnects,
        messages: this.mqtt.messages,
        errors: this.mqtt.errors,
        lastConnectedAt: this.mqtt.lastConnectedAt,
        lastDisconnectedAt: this.mqtt.lastDisconnectedAt,
        lastError: this.mqtt.lastError,
      },
      database: { ...this.database },
    };
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
