import { clamp, toFiniteNumber } from "./normalization.ts";
import { getDefaultThresholds } from "./thresholds.ts";
import type { Co2Threshold, RoomThresholds, VavReason } from "@hvac/contracts";
import type { DomainClimatizer, DomainRoom } from "../types/domain.ts";

function roomTemperature(room: DomainRoom | null | undefined): number {
  return toFiniteNumber(room?.temperatura ?? room?.temperature, 0) ?? 0;
}

function roomSetpoint(room: DomainRoom | null | undefined): number {
  return toFiniteNumber(room?.setpoint, roomTemperature(room)) ?? roomTemperature(room);
}

function co2Thresholds(thresholds?: { co2?: Pick<Co2Threshold, "warn" | "critical"> }): Pick<Co2Threshold, "warn" | "critical"> {
  return thresholds?.co2 || getDefaultThresholds().co2;
}

export function calculateCoolingDemand(room: DomainRoom | null | undefined, climatizer: DomainClimatizer | null | undefined): number {
  if (!climatizer?.ligado) return 0;
  const error = roomTemperature(room) - roomSetpoint(room);
  return clamp(Math.max(5, 40 + error * 120), 0, 100);
}

export function calculateVentilationDemand(co2: unknown, thresholds?: { co2?: Pick<Co2Threshold, "warn" | "critical"> }): number {
  const { warn, critical } = co2Thresholds(thresholds);
  const value = toFiniteNumber(co2, 0) ?? 0;
  if (value >= critical) return 100;
  if (value >= warn) {
    if (critical <= warn) return 100;
    return clamp(50 + ((value - warn) / (critical - warn)) * 50, 0, 100);
  }
  return clamp((value / warn) * 20, 0, 100);
}

export function getVavReason(room: DomainRoom | null | undefined, climatizer: DomainClimatizer | null | undefined, coolingDemand: number, ventilationDemand: number): VavReason {
  if (!climatizer?.ligado) return "sem_frio";
  if (ventilationDemand > coolingDemand) return "ventilacao";
  if (roomTemperature(room) - roomSetpoint(room) > 0.4) return "resfriamento";
  return "estavel";
}

export function calculateVavTarget(room: DomainRoom | null | undefined, climatizer: DomainClimatizer | null | undefined, thresholds?: RoomThresholds) {
  const coolingDemand = calculateCoolingDemand(room, climatizer);
  const ventilationDemand = calculateVentilationDemand(room?.co2, thresholds);
  return {
    target: clamp(Math.max(coolingDemand, ventilationDemand), 0, 100),
    motivo: getVavReason(room, climatizer, coolingDemand, ventilationDemand),
    coolingDemand,
    ventilationDemand,
  };
}

export function calculateNextVavOpening(current: unknown, target: unknown, smoothing: unknown = 0.35): number {
  const currentValue = clamp(current, 0, 100);
  const targetValue = clamp(target, 0, 100);
  const factor = clamp(smoothing, 0, 1);
  return Math.round(currentValue + (targetValue - currentValue) * factor);
}

export function isVavSetpointReachable(setpoint: unknown, climatizer: DomainClimatizer | null | undefined): boolean {
  if (!climatizer?.ligado) return false;
  const supplyTemperature = toFiniteNumber(climatizer.tempInsuflamento);
  const requested = toFiniteNumber(setpoint);
  return supplyTemperature != null && requested != null && requested >= supplyTemperature;
}
