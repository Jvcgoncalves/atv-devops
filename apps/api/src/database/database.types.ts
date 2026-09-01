import type { Metric, TelemetrySource } from "@hvac/contracts";

export interface ClimatizerRow {
  id: string;
  name: string;
  is_on: boolean;
  supply_air_temperature: number;
}

export interface RoomRow {
  id: string;
  name: string;
  floor: string | null;
  climatizer_id: string;
  setpoint: number;
  current_temperature: number | null;
  current_humidity: number | null;
  current_co2: number | null;
  last_reading_at: string | null;
  telemetry_source: TelemetrySource;
  updated_at?: string;
}

export interface VavRow {
  id: string;
  room_id: string;
  state: "ok" | "falha";
  opening: number;
  airflow: number | null;
  mode: "auto" | "manual";
  reason: "estavel" | "resfriamento" | "ventilacao" | "manual" | "sem_frio";
}

export interface SensorRow {
  id: string;
  room_id: string;
  metric: Metric;
  unit: string;
  status: "ativo" | "inativo" | "falha";
  last_seen_at: string | null;
}

export interface ThresholdRow {
  id: string;
  room_id: string;
  metric: Metric;
  min_value: number | null;
  max_value: number | null;
  warn_value: number | null;
  critical_value: number | null;
  unit: string;
}

export interface ReadingRow {
  id: string;
  sensor_id: string;
  room_id: string;
  value: number;
  quality: "good" | "degraded" | "bad" | "unknown";
  source: TelemetrySource;
  source_message_id: string | null;
  recorded_at: string;
}

export interface AlertRow {
  id: string;
  level: "info" | "atencao" | "critico";
  alert_type: "temperatura" | "umidade" | "co2" | "vav" | "incendio";
  message: string;
  room_id: string | null;
  sensor_id: string | null;
  alert_key: string;
  acknowledged: boolean;
  acknowledged_at: string | null;
  resolved_at: string | null;
  occurred_at: string;
}

export interface BathroomRow {
  id: string;
  name: string;
  light_on: boolean;
}

export interface NtfyConfigRow {
  id: "default";
  enabled: boolean;
  server_url: string;
  topic: string;
  min_level: "atencao" | "critico";
}

export interface NtfyLogRow {
  id: string;
  alert_id: string | null;
  sent_at: string;
  url: string;
  priority: "urgent" | "high";
  title: string;
  message: string;
  tags: string[];
}

export interface AuditEventRow {
  id: string;
  category: "alerta" | "reconhecimento" | "parametro" | "setpoint" | "vav" | "climatizador" | "exaustao" | "registro";
  description: string;
  room_id: string | null;
  origin: "sistema" | "operador" | "dispositivo";
  occurred_at: string;
}

export interface IdentificationRow {
  id: "default";
  establishment: string;
  cnes: string;
  system_name: string;
  responsible_technician: string;
  professional_registration: string;
}

export interface TelemetryPersistenceInput {
  roomId: string;
  values: Partial<Record<Metric, number>>;
  source: TelemetrySource;
  recordedAt: string;
  quality: "good" | "degraded" | "bad" | "unknown";
  sourceMessageId?: string;
}

export interface TelemetryPersistenceResult {
  ids: string[];
  duplicate: boolean;
}
