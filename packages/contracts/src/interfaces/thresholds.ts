import type { Metric } from "../types/common.ts";

export interface TemperatureThreshold {
  min: number;
  max: number;
  unit: "C";
}

export interface HumidityThreshold {
  min: number;
  max: number;
  unit: "%";
}

export interface Co2Threshold {
  warn: number;
  critical: number;
  unit: "ppm";
}

export interface RoomThresholds {
  temperatura: TemperatureThreshold;
  umidade: HumidityThreshold;
  co2: Co2Threshold;
}

export interface ThresholdsMap {
  [roomId: string]: RoomThresholds;
}

export interface Thresholds {
  [roomId: string]: RoomThresholds;
}

export interface ThresholdRangeByMetric {
  metric: Metric;
  min?: number;
  max?: number;
  warn?: number;
  critical?: number;
}
