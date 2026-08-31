import type { Alert } from "./alerts.ts";
import type { AuditEvent } from "./audit.ts";
import type { Bathroom, Climatizer, Room, SystemState, VavState } from "./system.ts";
import type { Identification, NtfyConfig, NtfyLogEntry } from "./notifications.ts";
import type { RoomThresholds, ThresholdsMap } from "./thresholds.ts";
import type { TelemetryHistoryPoint } from "./telemetry.ts";

export interface HealthResponse {
  ok: boolean;
  ts: string;
}

export interface SaveThresholdsRequest extends Partial<RoomThresholds> {}

export interface SetRoomSetpointRequest {
  setpoint: number;
}

export interface SetVavModeRequest {
  modo: "auto" | "manual";
}

export interface SetVavOpeningRequest {
  abertura: number;
}

export interface SetVavFaultRequest {
  falha: boolean;
}

export interface SetFonteExternaRequest {
  salaId: string | null;
}

export interface PostVavStateRequest {
  salaId: string;
  abertura: number;
  estado: "ok" | "falha";
}

export interface PostBathroomLightRequest {
  banheiroId: string;
  luz: boolean;
}

export interface SetClimatizerRequest {
  ligado?: boolean;
  tempInsuflamento?: number;
}

export interface SetBathroomLightRequest {
  luz: boolean;
}

export interface UpdateNtfyConfigRequest extends Partial<NtfyConfig> {}

export interface UpdateIdentificationRequest extends Partial<Identification> {}

export interface TelemetryResponse {
  ok: boolean;
  idLeitura?: string | number;
  erro?: string;
}

export interface AcknowledgeAlertResponse {
  alertas: Alert[];
}

export interface ApiContract {
  getState: SystemState;
  getHistory: TelemetryHistoryPoint[];
  getThresholds: ThresholdsMap;
  getAlerts: Alert[];
  getNtfyConfig: NtfyConfig;
  getNtfyLog: NtfyLogEntry[];
  getEvents: AuditEvent[];
  getIdentification: Identification;
  setVav: VavState;
  setClimatizer: Climatizer;
  setBathroomLight: { banheiros: Bathroom[]; exaustao: { ligada: boolean; logica: "OR" } };
  setRoomSetpoint: Room;
}
