import type { Status, TelemetrySource, VavMode, VavReason, VavStatus } from "../types/common.ts";

export interface VavState {
  abertura: number;
  estado: VavStatus;
  modo: VavMode;
  motivo: VavReason;
}

export interface Room {
  id: string;
  nome: string;
  climatizadorId: string;
  setpoint: number;
  temperatura: number;
  umidade: number;
  co2: number;
  vav: VavState;
  ultimaLeitura: string;
  status: {
    temperatura: Status;
    umidade: Status;
    co2: Status;
  };
  fonte?: TelemetrySource;
}

export interface Climatizer {
  id: string;
  nome: string;
  salas: string[];
  ligado: boolean;
  tempInsuflamento: number;
}

export interface Bathroom {
  id: string;
  nome: string;
  luz: boolean;
}

export interface ExhaustState {
  ligada: boolean;
  logica: "OR";
}

export interface ConnectionState {
  online: boolean;
  fonte: TelemetrySource;
}

export interface SystemState {
  timestamp: string;
  conexao: ConnectionState;
  salas: Room[];
  climatizadores: Climatizer[];
  banheiros: Bathroom[];
  exaustao: ExhaustState;
}
