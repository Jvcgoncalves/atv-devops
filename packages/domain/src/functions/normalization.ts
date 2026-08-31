import { normalizeThresholds } from "./thresholds.ts";
import type { RoomThresholds, TelemetryInput } from "@hvac/contracts";

export function clamp(value: unknown, min: number, max: number): number {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.max(min, Math.min(max, number));
}

export function toFiniteNumber(value: unknown, fallback: number | null = null): number | null {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function normalizeRoomId(value: unknown): string | null {
  if (value == null || String(value).trim() === "") return null;
  const raw = String(value).trim();
  return raw.startsWith("sala-") ? raw : `sala-${raw}`;
}

export function normalizeTelemetryPayload(payload: unknown): TelemetryInput | null {
  if (!payload || typeof payload !== "object") return null;
  const inputRecord = payload as Record<string, unknown>;
  const salaId = normalizeRoomId(inputRecord.salaId ?? inputRecord.roomId);
  if (!salaId) return null;
  const result: Record<string, string | number> = { salaId };
  for (const [target, sourceKey] of Object.entries({
    temperatura: "temperatura",
    umidade: "umidade",
    co2: "co2",
  })) {
    if (inputRecord[sourceKey] == null) continue;
    const number = toFiniteNumber(inputRecord[sourceKey]);
    if (number == null) return null;
    result[target] = number;
  }
  return Object.keys(result).length > 1 ? result as unknown as TelemetryInput : null;
}

export function normalizeRoomThresholds(input: unknown, fallback: RoomThresholds): RoomThresholds {
  return normalizeThresholds(input, fallback);
}
