import type { RoomThresholds } from "@hvac/contracts";

const DEFAULT_THRESHOLDS = Object.freeze({
  temperatura: Object.freeze({ min: 20, max: 26, unit: "C" }),
  umidade: Object.freeze({ min: 40, max: 60, unit: "%" }),
  co2: Object.freeze({ warn: 800, critical: 1000, unit: "ppm" }),
});

export function getDefaultThresholds(): RoomThresholds {
  return {
    temperatura: { ...DEFAULT_THRESHOLDS.temperatura },
    umidade: { ...DEFAULT_THRESHOLDS.umidade },
    co2: { ...DEFAULT_THRESHOLDS.co2 },
  };
}

function numberOrFallback(value: unknown, fallback: number): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function normalizeThresholds(input: unknown = {}, fallback: RoomThresholds = getDefaultThresholds()): RoomThresholds {
  const base = fallback || getDefaultThresholds();
  const source = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const temperatura = source.temperatura && typeof source.temperatura === "object" ? source.temperatura as Record<string, unknown> : {};
  const umidade = source.umidade && typeof source.umidade === "object" ? source.umidade as Record<string, unknown> : {};
  const co2 = source.co2 && typeof source.co2 === "object" ? source.co2 as Record<string, unknown> : {};
  return {
    temperatura: {
      min: numberOrFallback(temperatura.min, base.temperatura.min),
      max: numberOrFallback(temperatura.max, base.temperatura.max),
      unit: "C",
    },
    umidade: {
      min: numberOrFallback(umidade.min, base.umidade.min),
      max: numberOrFallback(umidade.max, base.umidade.max),
      unit: "%",
    },
    co2: {
      warn: numberOrFallback(co2.warn, base.co2.warn),
      critical: numberOrFallback(co2.critical, base.co2.critical),
      unit: "ppm",
    },
  };
}

export function validateThresholds(thresholds: unknown): thresholds is RoomThresholds {
  if (!thresholds || typeof thresholds !== "object") return false;
  const source = thresholds as Partial<RoomThresholds>;
  if (!source.temperatura || !source.umidade || !source.co2) return false;
  return (
    source.temperatura.min < source.temperatura.max &&
    source.umidade.min < source.umidade.max &&
    source.co2.warn < source.co2.critical
  );
}
