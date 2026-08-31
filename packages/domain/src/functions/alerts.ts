import { getDefaultThresholds } from "./thresholds.ts";
import { calculateRoomStatus, STATUS } from "./status.ts";
import type { AlertLevel, AlertType, RoomThresholds } from "@hvac/contracts";
import type { AlertCandidate, AlertKeyInput, DomainRoom } from "../types/domain.ts";

export function getAlertLevelRank(level: AlertLevel | string): number {
  if (level === "critico") return 2;
  if (level === "atencao") return 1;
  return 0;
}

export function shouldNotifyAlert(level: AlertLevel | string, minimumLevel: AlertLevel | string = "atencao"): boolean {
  return getAlertLevelRank(level) >= getAlertLevelRank(minimumLevel);
}

export function getAlertKey({ salaId, tipo, level }: AlertKeyInput): string {
  return `${salaId || "sys"}:${tipo}:${level}`;
}

function roomName(room: DomainRoom): string {
  return room?.nome || `Sala ${room?.id || "-"}`;
}

function formatTemperatureAlert(room: DomainRoom, thresholds: RoomThresholds): string {
  const t = thresholds.temperatura;
  return `${roomName(room)}: temperatura ${Number(room.temperatura).toFixed(1)}C fora da faixa (${t.min}-${t.max}C)`;
}

function formatHumidityAlert(room: DomainRoom, thresholds: RoomThresholds): string {
  const t = thresholds.umidade;
  return `${roomName(room)}: umidade ${Number(room.umidade).toFixed(0)}% fora da faixa (${t.min}-${t.max}%)`;
}

function formatCo2CriticalAlert(room: DomainRoom, thresholds: RoomThresholds): string {
  return `${roomName(room)}: CO2 ${Number(room.co2).toFixed(0)} ppm acima do limite (${thresholds.co2.critical} ppm)`;
}

function formatCo2WarningAlert(room: DomainRoom): string {
  return `${roomName(room)}: CO2 ${Number(room.co2).toFixed(0)} ppm em nivel moderado`;
}

function candidate(level: AlertLevel, tipo: AlertType, mensagem: string, salaId?: string | null): AlertCandidate {
  return { level, tipo, mensagem, salaId: salaId || null, key: getAlertKey({ salaId, tipo, level }) };
}

export function evaluateRoomAlerts(room: DomainRoom, thresholds: RoomThresholds = getDefaultThresholds()): AlertCandidate[] {
  const resolved = thresholds || getDefaultThresholds();
  const status = calculateRoomStatus(room, resolved);
  const result: AlertCandidate[] = [];
  if (status.temperatura === STATUS.CRITICO) {
    result.push(candidate("critico", "temperatura", formatTemperatureAlert(room, resolved), room.id));
  }
  if (status.umidade === STATUS.CRITICO) {
    result.push(candidate("critico", "umidade", formatHumidityAlert(room, resolved), room.id));
  }
  if (status.co2 === STATUS.CRITICO) {
    result.push(candidate("critico", "co2", formatCo2CriticalAlert(room, resolved), room.id));
  } else if (status.co2 === STATUS.ATENCAO) {
    result.push(candidate("atencao", "co2", formatCo2WarningAlert(room), room.id));
  }
  if (room?.vav?.estado === "falha") {
    result.push(candidate("critico", "vav", `${roomName(room)}: falha detectada na VAV`, room.id));
  }
  return result;
}

export function filterNewAlerts(candidates: AlertCandidate[], activeKeys: Set<string> | string[] = new Set()): AlertCandidate[] {
  const keys = activeKeys instanceof Set ? activeKeys : new Set(activeKeys);
  return candidates.filter((alert) => !keys.has(alert.key));
}

export function hasAlertCooldownElapsed(lastAlertAt: string | null | undefined, now = Date.now(), cooldownMs = 60000): boolean {
  if (!lastAlertAt) return true;
  const previous = new Date(lastAlertAt).getTime();
  return !Number.isFinite(previous) || now - previous >= cooldownMs;
}
