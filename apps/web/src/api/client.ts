import { mock, startSimulation } from "./mockBackend.ts";
import { resolveApiBase, resolveApiMode } from "./runtime-config.ts";
import { assertSystemStateShape } from "./response-shapes.ts";
import type { ApiClient } from "../types/ui.ts";
import type { ApiMode } from "../types/ui.ts";
import type {
  Metric,
  SaveThresholdsRequest,
  SetClimatizerRequest,
  TelemetryInput,
  UpdateIdentificationRequest,
  UpdateNtfyConfigRequest,
  SystemState,
} from "@hvac/contracts";

const MODE: ApiMode = resolveApiMode(import.meta.env?.VITE_API_MODE);
const BASE = resolveApiBase(import.meta.env?.VITE_API_BASE);

if (MODE === "mock") startSimulation();

async function http<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} em ${path}`);
  if (res.status === 204) return null as T;
  return res.json();
}

// Pequeno atraso para simular latencia de rede no modo mock.
const tick = <T,>(value: T): Promise<T> => new Promise((resolve) => setTimeout(() => resolve(value), 120));

export const api: ApiClient = {
  mode: MODE,

  // GET /api/estado  -> estado completo do sistema
  getSystemState() {
    return MODE === "mock"
      ? tick(assertSystemStateShape(mock.getSystemState()))
      : http<unknown>("/estado").then(assertSystemStateShape);
  },

  // GET /api/historico/:salaId/:metrica
  getHistory(roomId: string, metric: Metric) {
    return MODE === "mock"
      ? tick(mock.getHistory(roomId, metric))
      : http(`/historico/${roomId}/${metric}`);
  },

  // GET /api/parametros  -> mapa { salaId: { temperatura, umidade, co2 } }
  getThresholds() {
    return MODE === "mock" ? tick(mock.getThresholds()) : http("/parametros");
  },

  // PUT /api/parametros/:salaId  -> atualiza as faixas de uma sala
  saveThresholds(salaId: string, next: SaveThresholdsRequest) {
    return MODE === "mock"
      ? tick(mock.saveThresholds(salaId, next))
      : http(`/parametros/${salaId}`, { method: "PUT", body: JSON.stringify(next) });
  },

  // GET /api/alertas
  getAlerts() {
    return MODE === "mock" ? tick(mock.getAlerts()) : http("/alertas");
  },

  // POST /api/alertas/:id/reconhecer
  acknowledgeAlert(id: string) {
    return MODE === "mock"
      ? tick(mock.acknowledgeAlert(id))
      : http(`/alertas/${id}/reconhecer`, { method: "POST" });
  },

  // DELETE /api/alertas/reconhecidos
  clearAcknowledged() {
    return MODE === "mock"
      ? tick(mock.clearAcknowledged())
      : http("/alertas/reconhecidos", { method: "DELETE" });
  },

  // PUT /api/salas/:salaId/vav   { abertura }  (override manual)
  setVav(roomId: string, abertura: number) {
    return MODE === "mock"
      ? tick(mock.setVav(roomId, abertura))
      : http(`/salas/${roomId}/vav`, { method: "PUT", body: JSON.stringify({ abertura }) });
  },

  // PUT /api/salas/:salaId/vav/modo   { modo: "auto" | "manual" }
  setVavMode(roomId: string, modo: "auto" | "manual") {
    return MODE === "mock"
      ? tick(mock.setVavMode(roomId, modo))
      : http(`/salas/${roomId}/vav/modo`, { method: "PUT", body: JSON.stringify({ modo }) });
  },

  // PUT /api/salas/:salaId/setpoint   { setpoint }  (alvo de temperatura da sala)
  setRoomSetpoint(roomId: string, setpoint: number) {
    return MODE === "mock"
      ? tick(mock.setRoomSetpoint(roomId, setpoint))
      : http(`/salas/${roomId}/setpoint`, { method: "PUT", body: JSON.stringify({ setpoint }) });
  },

  // (demo) forca falha de VAV - util para testar o alerta de falha
  setVavFault(roomId: string, falha: boolean) {
    return MODE === "mock"
      ? tick(mock.setVavFault(roomId, falha))
      : http(`/salas/${roomId}/vav/falha`, { method: "PUT", body: JSON.stringify({ falha }) });
  },

  // PUT /api/climatizadores/:id   { ligado, setpoint }
  setClimatizador(id: string, patch: SetClimatizerRequest) {
    return MODE === "mock"
      ? tick(mock.setClimatizador(id, patch))
      : http(`/climatizadores/${id}`, { method: "PUT", body: JSON.stringify(patch) });
  },

  // PUT /api/banheiros/:id   { luz }  (dispara intertravamento OR da exaustao)
  setBathroomLight(id: string, luz: boolean) {
    return MODE === "mock"
      ? tick(mock.setBathroomLight(id, luz))
      : http(`/banheiros/${id}`, { method: "PUT", body: JSON.stringify({ luz }) });
  },

  // GET / PUT /api/ntfy
  getNtfyConfig() {
    return MODE === "mock" ? tick(mock.getNtfyConfig()) : http("/ntfy");
  },
  saveNtfyConfig(next: UpdateNtfyConfigRequest) {
    return MODE === "mock"
      ? tick(mock.saveNtfyConfig(next))
      : http("/ntfy", { method: "PUT", body: JSON.stringify(next) });
  },
  // GET /api/ntfy/log  -> notificacoes enviadas
  getNtfyLog() {
    return MODE === "mock" ? tick(mock.getNtfyLog()) : http("/ntfy/log");
  },

  // GET /api/eventos  -> log de auditoria (rastreabilidade)
  getEvents() {
    return MODE === "mock" ? tick(mock.getEvents()) : http("/eventos");
  },

  // GET / PUT /api/identificacao  -> dados do estabelecimento / responsavel tecnico
  getIdentificacao() {
    return MODE === "mock" ? tick(mock.getIdentificacao()) : http("/identificacao");
  },
  saveIdentificacao(next: UpdateIdentificationRequest) {
    return MODE === "mock"
      ? tick(mock.saveIdentificacao(next))
      : http("/identificacao", { method: "PUT", body: JSON.stringify(next) });
  },

  // POST /api/telemetria  -> injeta leitura de sensor (ESP32) numa sala
  ingestTelemetry(payload: TelemetryInput) {
    return MODE === "mock"
      ? tick(mock.ingestTelemetry(payload))
      : http("/telemetria", { method: "POST", body: JSON.stringify(payload) });
  },
  // PUT /api/fonte-externa  -> define qual sala usa dados reais do ESP32
  setFonteExterna(salaId: string | null) {
    return MODE === "mock"
      ? tick(mock.setFonteExterna(salaId))
      : http("/fonte-externa", { method: "PUT", body: JSON.stringify({ salaId }) });
  },
};
