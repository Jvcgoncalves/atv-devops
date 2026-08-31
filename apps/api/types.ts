export interface SensorRow {
  id_sensor: number;
  tipo: string;
  unidade: string | null;
  id_sala: number;
}

export interface RoomRow {
  id_sala: number;
  nome: string;
}

export interface ThresholdRow {
  id_limite: number;
  tipo: string;
  valor_min: number | null;
  valor_max: number | null;
  id_sala: number;
}

export interface TelemetryInsert {
  id_sensor: number;
  valor: number;
  qualidade?: string | null;
}

export interface TelemetryResult {
  ok: boolean;
  id_leitura?: number | bigint;
  erro?: string;
}

export interface CrudColumn {
  name: string;
}

export interface CountRow {
  c: number;
}
