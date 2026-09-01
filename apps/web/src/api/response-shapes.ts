import type { SystemState } from "@hvac/contracts";

const statuses = new Set(["normal", "atencao", "critico"]);
const telemetrySources = new Set(["MQTT", "REST", "MOCK", "ESP32"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isRoom(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const vav = value.vav;
  const status = value.status;
  if (!isRecord(vav) || !isRecord(status)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.nome === "string" &&
    typeof value.climatizadorId === "string" &&
    isNumber(value.setpoint) &&
    isNumber(value.temperatura) &&
    isNumber(value.umidade) &&
    isNumber(value.co2) &&
    typeof value.ultimaLeitura === "string" &&
    (value.fonte === undefined || telemetrySources.has(value.fonte as string)) &&
    isNumber(vav.abertura) &&
    (vav.estado === "ok" || vav.estado === "falha") &&
    (vav.modo === "auto" || vav.modo === "manual") &&
    typeof vav.motivo === "string" &&
    statuses.has(status.temperatura as string) &&
    statuses.has(status.umidade as string) &&
    statuses.has(status.co2 as string)
  );
}

function isClimatizer(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.nome === "string" &&
    Array.isArray(value.salas) &&
    value.salas.every((roomId) => typeof roomId === "string") &&
    typeof value.ligado === "boolean" &&
    isNumber(value.tempInsuflamento)
  );
}

function isBathroom(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return typeof value.id === "string" && typeof value.nome === "string" && typeof value.luz === "boolean";
}

export function assertSystemStateShape(value: unknown): SystemState {
  if (!isRecord(value)) throw new Error("Resposta /estado invalida: objeto esperado");
  const connection = value.conexao;
  const exhaust = value.exaustao;
  if (!isRecord(connection) || !isRecord(exhaust)) throw new Error("Resposta /estado invalida: campos obrigatorios ausentes");
  if (
    typeof value.timestamp !== "string" ||
    typeof connection.online !== "boolean" ||
    !telemetrySources.has(connection.fonte as string) ||
    !Array.isArray(value.salas) ||
    !value.salas.every(isRoom) ||
    !Array.isArray(value.climatizadores) ||
    !value.climatizadores.every(isClimatizer) ||
    !Array.isArray(value.banheiros) ||
    !value.banheiros.every(isBathroom) ||
    typeof exhaust.ligada !== "boolean" ||
    exhaust.logica !== "OR"
  ) {
    throw new Error("Resposta /estado invalida: formato incompatível com contrato");
  }
  return value as unknown as SystemState;
}
