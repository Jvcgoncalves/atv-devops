import { normalizeRoomId, normalizeTelemetryPayload, toFiniteNumber } from "./normalization.ts";
import type { TelemetryInput } from "@hvac/contracts";
import type { MqttMappingInput } from "../types/domain.ts";

const PAYLOAD_KEYS = Object.freeze({
  temperatura: ["temperatura", "temperature"],
  umidade: ["umidade", "humidity"],
  co2: ["co2"],
});

function decodePayload(payload: unknown): Record<string, unknown> | null {
  if (payload && typeof payload === "object" && !ArrayBuffer.isView(payload)) return payload as Record<string, unknown>;
  try {
    const text = typeof payload === "string" ? payload : new TextDecoder().decode(payload as AllowSharedBufferSource);
    const value = JSON.parse(text);
    return value && typeof value === "object" ? value as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

export function parseMqttRoomId(topic: unknown): string | null {
  const parts = String(topic || "").split("/");
  const salaIndex = parts.indexOf("sala");
  if (salaIndex < 0 || !parts[salaIndex + 1]) return null;
  return normalizeRoomId(parts[salaIndex + 1]);
}

export function mapMqttPayloadToTelemetry({ topic, payload, defaultRoomId }: MqttMappingInput = {}): TelemetryInput | null {
  const data = decodePayload(payload);
  if (!data) return null;
  const salaId = parseMqttRoomId(topic) || normalizeRoomId(defaultRoomId);
  if (!salaId) return null;
  const mapped: Record<string, string | number> = { salaId };
  for (const [target, keys] of Object.entries(PAYLOAD_KEYS)) {
    const source = keys.find((key) => data[key] != null);
    if (!source) continue;
    const number = toFiniteNumber(data[source]);
    if (number == null) return null;
    mapped[target] = number;
  }
  return normalizeTelemetryPayload(mapped);
}

export function mapMqttMessage(topic: unknown, payload: unknown, defaultRoomId?: string | number | null): TelemetryInput | null {
  return mapMqttPayloadToTelemetry({ topic, payload, defaultRoomId });
}
