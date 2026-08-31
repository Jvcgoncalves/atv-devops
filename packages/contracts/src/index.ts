export type {
  AlertLevel,
  AlertType,
  AuditCategory,
  EventName,
  EventSource,
  Metric,
  TelemetrySource,
  VavMode,
  VavReason,
  VavStatus,
  Status,
} from "./types/common.ts";

export type {
  ApiContract,
  AcknowledgeAlertResponse,
  HealthResponse,
  SaveThresholdsRequest,
  SetBathroomLightRequest,
  SetClimatizerRequest,
  SetFonteExternaRequest,
  SetRoomSetpointRequest,
  SetVavFaultRequest,
  SetVavModeRequest,
  SetVavOpeningRequest,
  PostBathroomLightRequest,
  PostVavStateRequest,
  TelemetryResponse,
  UpdateIdentificationRequest,
  UpdateNtfyConfigRequest,
} from "./interfaces/api.ts";

export type { Alert, AlertEventData } from "./interfaces/alerts.ts";
export type { AuditEvent } from "./interfaces/audit.ts";

export type {
  Bathroom,
  Climatizer,
  ConnectionState,
  ExhaustState,
  Room,
  SystemState,
  VavState,
} from "./interfaces/system.ts";

export type {
  EventEnvelope,
  RealtimeEvent,
  RealtimeEventMap,
  SystemSnapshotEventData,
  TelemetryUpdatedEventData,
} from "./interfaces/events.ts";

export type { Identification, NtfyConfig, NtfyLogEntry, NotificationHeaders } from "./interfaces/notifications.ts";

export type {
  Co2Threshold,
  HumidityThreshold,
  RoomThresholds,
  TemperatureThreshold,
  ThresholdRangeByMetric,
  Thresholds,
  ThresholdsMap,
} from "./interfaces/thresholds.ts";

export type {
  MqttTelemetryPayload,
  TelemetryHistoryPoint,
  TelemetryInput,
  TelemetryReading,
} from "./interfaces/telemetry.ts";

export type {
  MqttBathroomLightPayload,
  MqttClimatizerCommand,
  MqttDeviceStatusPayload,
  MqttVavCommand,
  MqttVavStatePayload,
} from "./interfaces/mqtt.ts";
