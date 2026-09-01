import type { ReactNode } from "react";
import type {
  Alert,
  AuditEvent,
  Bathroom,
  Climatizer,
  ExhaustState,
  Identification,
  Metric,
  NtfyConfig,
  NtfyLogEntry,
  Room,
  RoomThresholds,
  RealtimeEvent,
  SaveThresholdsRequest,
  SetClimatizerRequest,
  Status,
  SystemState,
  TelemetryHistoryPoint,
  TelemetryInput,
  TelemetryResponse,
  ThresholdsMap,
  VavMode,
} from "@hvac/contracts";

export type ApiMode = "mock" | "real";
export type HistoryMetric = Metric;
export type RoomStatus = Record<Metric, Status>;
export type TelemetryRealtimeEvent = RealtimeEvent<"telemetry.updated">;

export interface SimulatedRoom extends Omit<Room, "status" | "fonte"> {
  fonte?: "MOCK" | "ESP32";
}

export type HistoryState = Record<string, Record<Metric, TelemetryHistoryPoint[]>>;

export interface NtfyLogEntryDraft extends NtfyLogEntry {}

export interface LiveTelemetryData {
  temperature?: number;
  humidity?: number;
  co2?: number;
  co?: number;
  pm25?: number;
  status?: number;
  override?: boolean;
  [key: string]: unknown;
}

export interface LiveStatus {
  connected: boolean;
  connecting: boolean;
  lastData: LiveTelemetryData | null;
  lastTs: string | null;
  error: string | null;
  url: string;
  topic: string;
}

export interface RealtimeConnectionState {
  connected: boolean;
  connecting: boolean;
  error: string | null;
  url: string;
}

export interface RealtimeClient {
  subscribe(listener: (event: RealtimeEvent) => void): () => void;
  subscribeConnection(listener: (state: RealtimeConnectionState) => void): () => void;
  disconnect(): void;
}

export interface LiveConfig {
  enabled: boolean;
  salaAlvo: string;
}

export interface MockApi {
  getSystemState(): SystemState;
  getHistory(roomId: string, metric: Metric): TelemetryHistoryPoint[];
  getThresholds(): ThresholdsMap;
  saveThresholds(salaId: string, next: SaveThresholdsRequest): ThresholdsMap;
  getAlerts(): Alert[];
  acknowledgeAlert(id: string): Alert[];
  clearAcknowledged(): Alert[];
  setVav(roomId: string, abertura: number): SimulatedRoom | undefined;
  setVavMode(roomId: string, modo: VavMode): SimulatedRoom | undefined;
  setVavFault(roomId: string, falha: boolean): SimulatedRoom | undefined;
  setRoomSetpoint(roomId: string, setpoint: number): SimulatedRoom | undefined;
  setClimatizador(id: string, patch: SetClimatizerRequest): Climatizer | undefined;
  setBathroomLight(id: string, luz: boolean): { banheiros: Bathroom[]; exaustao: ExhaustState };
  getNtfyConfig(): NtfyConfig;
  saveNtfyConfig(next: Partial<NtfyConfig>): NtfyConfig;
  getNtfyLog(): NtfyLogEntry[];
  getEvents(): AuditEvent[];
  getIdentificacao(): Identification;
  saveIdentificacao(next: Partial<Identification>): Identification;
  ingestTelemetry(payload: TelemetryInput): TelemetryResponse;
  setFonteExterna(salaId: string | null): { externalRoom: string | null };
}

export interface ApiClient {
  mode: ApiMode;
  getSystemState(): Promise<SystemState>;
  getHistory(roomId: string, metric: Metric): Promise<TelemetryHistoryPoint[]>;
  getThresholds(): Promise<ThresholdsMap>;
  saveThresholds(salaId: string, next: SaveThresholdsRequest): Promise<ThresholdsMap>;
  getAlerts(): Promise<Alert[]>;
  acknowledgeAlert(id: string): Promise<Alert[]>;
  clearAcknowledged(): Promise<Alert[]>;
  setVav(roomId: string, abertura: number): Promise<unknown>;
  setVavMode(roomId: string, modo: VavMode): Promise<unknown>;
  setRoomSetpoint(roomId: string, setpoint: number): Promise<unknown>;
  setVavFault(roomId: string, falha: boolean): Promise<unknown>;
  setClimatizador(id: string, patch: SetClimatizerRequest): Promise<unknown>;
  setBathroomLight(id: string, luz: boolean): Promise<unknown>;
  getNtfyConfig(): Promise<NtfyConfig>;
  saveNtfyConfig(next: Partial<NtfyConfig>): Promise<NtfyConfig>;
  getNtfyLog(): Promise<NtfyLogEntry[]>;
  getEvents(): Promise<AuditEvent[]>;
  getIdentificacao(): Promise<Identification>;
  saveIdentificacao(next: Partial<Identification>): Promise<Identification>;
  ingestTelemetry(payload: TelemetryInput): Promise<TelemetryResponse>;
  setFonteExterna(salaId: string | null): Promise<{ externalRoom: string | null }>;
}

export interface LiveStatusState extends LiveStatus {}

export interface ConfigActions {
  saveThresholds(salaId: string, next: RoomThresholds): Promise<ThresholdsMap>;
  setVav(roomId: string, abertura: number): Promise<void>;
  setVavMode(roomId: string, modo: VavMode): Promise<void>;
  setRoomSetpoint(roomId: string, setpoint: number): Promise<void>;
  setVavFault(roomId: string, falha: boolean): Promise<void>;
  setClimatizador(id: string, patch: SetClimatizerRequest): Promise<void>;
  setBathroomLight(id: string, luz: boolean): Promise<void>;
  acknowledgeAlert(id: string): Promise<void>;
  clearAcknowledged(): Promise<void>;
}

export interface ConfigContextValue extends ConfigActions {
  state: SystemState | null;
  alerts: Alert[];
  lastTelemetryEvent: TelemetryRealtimeEvent | null;
  thresholds: ThresholdsMap | null;
  error: string | null;
  mode: ApiMode;
  refresh(): Promise<void>;
  liveConfig: LiveConfig;
  liveStatus: LiveStatus;
  setLiveConfig(patch: Partial<LiveConfig>): void;
}

export interface RealtimeUiState {
  state: SystemState | null;
  alerts: Alert[];
  liveData: LiveTelemetryData | null;
  liveTs: string | null;
  version: number;
}

export interface PageProps {
  title: string;
  children: ReactNode;
}

export interface ToggleProps {
  checked: boolean;
  onChange(value: boolean): void;
}

export interface RoomCardProps {
  room: Room;
  climatizador?: Climatizer;
}

export interface MetricProps {
  label: string;
  icon: string;
  value: number;
  unit: string;
  status: Status;
  digits?: number;
}

export interface StatusBadgeProps {
  status: Status;
}

export interface ClimatizadorPanelProps {
  climatizador: Climatizer;
  salas: Room[];
}

export interface BathroomExhaustProps {
  banheiros: Bathroom[];
  exaustao: ExhaustState;
}

export interface TelemetryChartProps {
  salas: Room[];
  thresholds: ThresholdsMap | null;
  lastTelemetryEvent: TelemetryRealtimeEvent | null;
}

export interface ChartPoint {
  t: string | number;
  [key: string]: string | number | null;
}
