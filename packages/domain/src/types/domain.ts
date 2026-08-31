import type {
  AlertLevel,
  AlertType,
  Climatizer,
  Metric,
  RoomThresholds,
  Status,
  TelemetryInput,
  VavMode,
  VavReason,
  VavStatus,
} from "@hvac/contracts";

export interface DomainRoom {
  id?: string;
  nome?: string;
  setpoint?: number;
  temperatura?: number;
  temperature?: number;
  umidade?: number;
  co2?: number;
  vav?: {
    abertura?: number;
    estado?: VavStatus | string;
    modo?: VavMode | string;
    motivo?: VavReason | string;
  } | null;
}

export interface DomainClimatizer {
  ligado?: boolean;
  tempInsuflamento?: number;
}

export interface AlertKeyInput {
  salaId?: string | null;
  tipo: AlertType | string;
  level: AlertLevel | string;
}

export interface AlertCandidate {
  level: AlertLevel;
  tipo: AlertType;
  mensagem: string;
  salaId: string | null;
  key: string;
}

export interface StatusMap {
  temperatura?: Status;
  umidade?: Status;
  co2?: Status;
  [key: string]: Status | undefined;
}

export interface RoomStatus {
  temperatura: Status;
  umidade: Status;
  co2: Status;
}

export interface MqttMappingInput {
  topic?: unknown;
  payload?: unknown;
  defaultRoomId?: string | number | null;
}

export type DomainThresholds = RoomThresholds;
export type DomainMetric = Metric;
export type DomainTelemetryInput = TelemetryInput;
