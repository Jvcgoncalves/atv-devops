import type { Metric, TelemetrySource } from "../types/common.ts";

export interface TelemetryReading {
  salaId: string;
  temperatura: number;
  umidade: number;
  co2: number;
  fonte?: TelemetrySource;
  ts?: string;
}

export interface TelemetryInput {
  salaId: string;
  temperatura?: number;
  umidade?: number;
  co2?: number;
}

export interface MqttTelemetryPayload {
  temperatura?: number;
  temperature?: number;
  umidade?: number;
  humidity?: number;
  co2?: number;
}

export interface TelemetryHistoryPoint {
  t: string;
  value: number;
  metric?: Metric;
}
