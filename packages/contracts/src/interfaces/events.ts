import type { EventName, TelemetrySource } from "../types/common.ts";
import type { Alert } from "./alerts.ts";
import type { SystemState } from "./system.ts";

export interface EventEnvelope<TData> {
  eventId: string;
  version: number;
  occurredAt: string;
  data: TData;
}

export interface TelemetryUpdatedEventData {
  roomId: string;
  temperature: number;
  humidity: number;
  co2: number;
  source: TelemetrySource;
}

export interface SystemSnapshotEventData {
  state: SystemState;
}

export interface RealtimeEventMap {
  "telemetry.updated": EventEnvelope<TelemetryUpdatedEventData>;
  "alert.created": EventEnvelope<{ alert: Alert }>;
  "alert.updated": EventEnvelope<{ alert: Alert }>;
  "device.status.changed": EventEnvelope<{ deviceId: string; online: boolean }>;
  "system.snapshot": EventEnvelope<SystemSnapshotEventData>;
}

export interface RealtimeEvent<TName extends EventName = EventName> {
  name: TName;
  envelope: RealtimeEventMap[TName];
}
