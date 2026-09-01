import type { Metric } from "@hvac/contracts";
import type { ChartPoint, TelemetryRealtimeEvent } from "../types/ui.ts";

const MAX_CHART_POINTS = 500;

export function chartTime(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function appendRealtimePoint(points: ChartPoint[], event: TelemetryRealtimeEvent, roomName: string, metric: Metric): ChartPoint[] {
  const data = event.envelope.data;
  const value = metric === "temperatura" ? data.temperature : metric === "umidade" ? data.humidity : data.co2;
  const t = chartTime(data.timestamp);
  const existingIndex = points.findIndex((point) => point.t === t);

  if (existingIndex >= 0) {
    if (points[existingIndex][roomName] === value) return points;
    return points.map((point, index) => index === existingIndex ? { ...point, [roomName]: value } : point);
  }

  return [...points, { t, [roomName]: value }].slice(-MAX_CHART_POINTS);
}
