import type { ApiMode } from "../types/ui.ts";

export const DEFAULT_API_BASE = "/api";

export function resolveApiMode(value: string | undefined): ApiMode {
  return value === "real" ? "real" : "mock";
}

export function resolveApiBase(value: string | undefined): string {
  const base = value?.trim().replace(/\/+$/, "");
  return base || DEFAULT_API_BASE;
}
