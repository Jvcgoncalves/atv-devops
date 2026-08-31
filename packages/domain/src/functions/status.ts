import { getDefaultThresholds } from "./thresholds.ts";
import type { RoomThresholds, Status } from "@hvac/contracts";
import type { DomainRoom, RoomStatus, StatusMap } from "../types/domain.ts";

export const STATUS = Object.freeze({
  NORMAL: "normal",
  ATENCAO: "atencao",
  CRITICO: "critico",
});

function resolveThresholds(thresholds: RoomThresholds | undefined): RoomThresholds {
  return thresholds || getDefaultThresholds();
}

function finite(value: unknown): boolean {
  return Number.isFinite(Number(value));
}

export function getTemperatureStatus(value: unknown, thresholds?: RoomThresholds): Status {
  const { min, max } = resolveThresholds(thresholds).temperatura;
  const number = Number(value);
  if (!finite(number) || number < min || number > max) return STATUS.CRITICO;
  if (number < min + 1 || number > max - 1) return STATUS.ATENCAO;
  return STATUS.NORMAL;
}

export function getHumidityStatus(value: unknown, thresholds?: RoomThresholds): Status {
  const { min, max } = resolveThresholds(thresholds).umidade;
  const number = Number(value);
  if (!finite(number) || number < min || number > max) return STATUS.CRITICO;
  if (number < min + 5 || number > max - 5) return STATUS.ATENCAO;
  return STATUS.NORMAL;
}

export function getCo2Status(value: unknown, thresholds?: RoomThresholds): Status {
  const { warn, critical } = resolveThresholds(thresholds).co2;
  const number = Number(value);
  if (!finite(number) || number >= critical) return STATUS.CRITICO;
  if (number >= warn) return STATUS.ATENCAO;
  return STATUS.NORMAL;
}

export function calculateRoomStatus(room: DomainRoom, thresholds?: RoomThresholds): RoomStatus {
  const resolved = resolveThresholds(thresholds);
  return {
    temperatura: getTemperatureStatus(room.temperatura, resolved),
    umidade: getHumidityStatus(room.umidade, resolved),
    co2: getCo2Status(room.co2, resolved),
  };
}

export function getWorstStatus(status: StatusMap | null | undefined): Status {
  const values = Object.values(status || {});
  if (values.includes(STATUS.CRITICO)) return STATUS.CRITICO;
  if (values.includes(STATUS.ATENCAO)) return STATUS.ATENCAO;
  return STATUS.NORMAL;
}
