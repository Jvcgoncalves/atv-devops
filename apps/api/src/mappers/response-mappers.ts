import { calculateExhaustState, calculateRoomStatus, getDefaultThresholds } from "@hvac/domain";
import type {
  Alert,
  AuditEvent,
  Bathroom,
  Climatizer,
  Identification,
  NtfyConfig,
  NtfyLogEntry,
  Room,
  RoomThresholds,
  SystemState,
  ThresholdsMap,
  TelemetryHistoryPoint,
  VavState,
} from "@hvac/contracts";
import type {
  AlertRow,
  AuditEventRow,
  BathroomRow,
  ClimatizerRow,
  IdentificationRow,
  NtfyConfigRow,
  NtfyLogRow,
  ReadingRow,
  RoomRow,
  ThresholdRow,
  VavRow,
} from "../database/database.types.js";

function numberValue(value: number | null | undefined, fallback = 0): number {
  return value == null || !Number.isFinite(Number(value)) ? fallback : Number(value);
}

export function mapVav(row: VavRow | null): VavState {
  return {
    abertura: numberValue(row?.opening),
    estado: row?.state ?? "ok",
    modo: row?.mode ?? "auto",
    motivo: row?.reason ?? "estavel",
  };
}

export function mapThresholdRows(rows: ThresholdRow[]): ThresholdsMap {
  const result: ThresholdsMap = {};
  for (const row of rows) {
    const current = result[row.room_id] ?? getDefaultThresholds();
    if (row.metric === "temperatura") {
      current.temperatura = { min: numberValue(row.min_value, current.temperatura.min), max: numberValue(row.max_value, current.temperatura.max), unit: "C" };
    } else if (row.metric === "umidade") {
      current.umidade = { min: numberValue(row.min_value, current.umidade.min), max: numberValue(row.max_value, current.umidade.max), unit: "%" };
    } else {
      current.co2 = { warn: numberValue(row.warn_value, current.co2.warn), critical: numberValue(row.critical_value, current.co2.critical), unit: "ppm" };
    }
    result[row.room_id] = current;
  }
  return result;
}

export function mapRoom(row: RoomRow, vav: VavRow | null, thresholds: RoomThresholds | undefined): Room {
  const temperature = numberValue(row.current_temperature);
  const humidity = numberValue(row.current_humidity);
  const co2 = numberValue(row.current_co2);
  const room = {
    id: row.id,
    nome: row.name,
    climatizadorId: row.climatizer_id,
    setpoint: numberValue(row.setpoint, 23),
    temperatura: temperature,
    umidade: humidity,
    co2,
    vav: mapVav(vav),
    ultimaLeitura: row.last_reading_at ?? row.updated_at ?? new Date(0).toISOString(),
    status: calculateRoomStatus({ id: row.id, nome: row.name, setpoint: row.setpoint, temperatura: temperature, umidade: humidity, co2, vav: mapVav(vav) }, thresholds ?? getDefaultThresholds()),
    fonte: row.telemetry_source,
  };
  return room;
}

export function mapClimatizer(row: ClimatizerRow, rooms: RoomRow[]): Climatizer {
  return {
    id: row.id,
    nome: row.name,
    salas: rooms.filter((room) => room.climatizer_id === row.id).map((room) => room.id),
    ligado: row.is_on,
    tempInsuflamento: numberValue(row.supply_air_temperature, 15),
  };
}

export function mapBathroom(row: BathroomRow): Bathroom {
  return { id: row.id, nome: row.name, luz: row.light_on };
}

export function mapAlert(row: AlertRow): Alert {
  return {
    id: row.id,
    level: row.level,
    tipo: row.alert_type,
    mensagem: row.message,
    salaId: row.room_id,
    ts: row.occurred_at,
    reconhecido: row.acknowledged,
    key: row.alert_key,
  };
}

export function mapHistory(rows: ReadingRow[], metric: string): TelemetryHistoryPoint[] {
  return rows.map((row) => ({ t: row.recorded_at, value: numberValue(row.value), metric: metric as TelemetryHistoryPoint["metric"] }));
}

export function mapNtfyConfig(row: NtfyConfigRow | null): NtfyConfig {
  return {
    enabled: row?.enabled ?? true,
    server: row?.server_url ?? "https://ntfy.sh",
    topic: row?.topic ?? "tcc-hvac-alertas",
    minLevel: row?.min_level ?? "atencao",
  };
}

export function mapNtfyLog(row: NtfyLogRow): NtfyLogEntry {
  return { id: row.id, ts: row.sent_at, url: row.url, priority: row.priority, title: row.title, message: row.message, tags: row.tags ?? [] };
}

export function mapAuditEvent(row: AuditEventRow): AuditEvent {
  return { id: row.id, ts: row.occurred_at, categoria: row.category, descricao: row.description, salaId: row.room_id, origem: row.origin };
}

export function mapIdentification(row: IdentificationRow | null): Identification {
  return {
    estabelecimento: row?.establishment ?? "",
    cnes: row?.cnes ?? "",
    sistema: row?.system_name ?? "Sistema de Automacao HVAC",
    responsavelTecnico: row?.responsible_technician ?? "",
    registro: row?.professional_registration ?? "",
  };
}

export function mapSystemState(
  rooms: Room[],
  climatizers: Climatizer[],
  bathrooms: Bathroom[],
  online: boolean,
  source: SystemState["conexao"]["fonte"],
  timestamp = new Date().toISOString(),
): SystemState {
  return {
    timestamp,
    conexao: { online, fonte: source },
    salas: rooms,
    climatizadores: climatizers,
    banheiros: bathrooms,
    exaustao: calculateExhaustState(bathrooms),
  };
}
