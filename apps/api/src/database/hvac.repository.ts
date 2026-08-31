import { Inject, Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type {
  Alert,
  AuditCategory,
  EventSource,
  Identification,
  Metric,
  NtfyConfig,
  NtfyLogEntry,
  RoomThresholds,
  TelemetrySource,
} from "@hvac/contracts";
import { SupabaseService } from "./supabase.service.js";
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
  SensorRow,
  TelemetryPersistenceInput,
  TelemetryPersistenceResult,
  ThresholdRow,
  VavRow,
} from "./database.types.js";

@Injectable()
export class HvacRepository {
  constructor(@Inject(SupabaseService) private readonly supabase: SupabaseService) {}

  async listClimatizers(): Promise<ClimatizerRow[]> {
    const { data, error } = await this.supabase.getClient().from("climatizers").select("*").order("id");
    if (error) throw error;
    return (data ?? []) as unknown as ClimatizerRow[];
  }

  async findClimatizer(id: string): Promise<ClimatizerRow | null> {
    const { data, error } = await this.supabase.getClient().from("climatizers").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data as unknown as ClimatizerRow | null;
  }

  async updateClimatizer(id: string, patch: Record<string, unknown>): Promise<ClimatizerRow> {
    const { data, error } = await this.supabase
      .getClient()
      .from("climatizers")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return data as unknown as ClimatizerRow;
  }

  async listRooms(): Promise<RoomRow[]> {
    const { data, error } = await this.supabase.getClient().from("rooms").select("*").order("id");
    if (error) throw error;
    return (data ?? []) as unknown as RoomRow[];
  }

  async findRoom(id: string): Promise<RoomRow | null> {
    const { data, error } = await this.supabase.getClient().from("rooms").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data as unknown as RoomRow | null;
  }

  async updateRoom(id: string, patch: Record<string, unknown>): Promise<RoomRow> {
    const { data, error } = await this.supabase
      .getClient()
      .from("rooms")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return data as unknown as RoomRow;
  }

  async listVavs(): Promise<VavRow[]> {
    const { data, error } = await this.supabase.getClient().from("vavs").select("*").order("id");
    if (error) throw error;
    return (data ?? []) as unknown as VavRow[];
  }

  async findVavByRoom(roomId: string): Promise<VavRow | null> {
    const { data, error } = await this.supabase.getClient().from("vavs").select("*").eq("room_id", roomId).maybeSingle();
    if (error) throw error;
    return data as unknown as VavRow | null;
  }

  async updateVav(roomId: string, patch: Record<string, unknown>): Promise<VavRow> {
    const { data, error } = await this.supabase
      .getClient()
      .from("vavs")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("room_id", roomId)
      .select("*")
      .single();
    if (error) throw error;
    return data as unknown as VavRow;
  }

  async listSensors(roomId?: string): Promise<SensorRow[]> {
    let query = this.supabase.getClient().from("sensors").select("*").order("id");
    if (roomId) query = query.eq("room_id", roomId);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as unknown as SensorRow[];
  }

  async listThresholds(roomId?: string): Promise<ThresholdRow[]> {
    let query = this.supabase.getClient().from("alert_thresholds").select("*").order("room_id");
    if (roomId) query = query.eq("room_id", roomId);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as unknown as ThresholdRow[];
  }

  async upsertThresholds(roomId: string, thresholds: RoomThresholds): Promise<ThresholdRow[]> {
    const rows = [
      {
        id: `threshold-${roomId}-temperatura`, room_id: roomId, metric: "temperatura",
        min_value: thresholds.temperatura.min, max_value: thresholds.temperatura.max,
        warn_value: null, critical_value: null, unit: "C",
      },
      {
        id: `threshold-${roomId}-umidade`, room_id: roomId, metric: "umidade",
        min_value: thresholds.umidade.min, max_value: thresholds.umidade.max,
        warn_value: null, critical_value: null, unit: "%",
      },
      {
        id: `threshold-${roomId}-co2`, room_id: roomId, metric: "co2",
        min_value: null, max_value: null, warn_value: thresholds.co2.warn,
        critical_value: thresholds.co2.critical, unit: "ppm",
      },
    ];
    const { data, error } = await this.supabase
      .getClient()
      .from("alert_thresholds")
      .upsert(rows, { onConflict: "room_id,metric" })
      .select("*");
    if (error) throw error;
    return (data ?? []) as unknown as ThresholdRow[];
  }

  async listBathrooms(): Promise<BathroomRow[]> {
    const { data, error } = await this.supabase.getClient().from("bathrooms").select("*").order("id");
    if (error) throw error;
    return (data ?? []) as unknown as BathroomRow[];
  }

  async findBathroom(id: string): Promise<BathroomRow | null> {
    const { data, error } = await this.supabase.getClient().from("bathrooms").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data as unknown as BathroomRow | null;
  }

  async updateBathroom(id: string, lightOn: boolean): Promise<BathroomRow> {
    const { data, error } = await this.supabase
      .getClient()
      .from("bathrooms")
      .update({ light_on: lightOn, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return data as unknown as BathroomRow;
  }

  async listAlerts(): Promise<AlertRow[]> {
    const { data, error } = await this.supabase.getClient().from("alerts").select("*").order("occurred_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as unknown as AlertRow[];
  }

  async findAlert(id: string): Promise<AlertRow | null> {
    const { data, error } = await this.supabase.getClient().from("alerts").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data as unknown as AlertRow | null;
  }

  async findActiveAlertByKey(key: string): Promise<AlertRow | null> {
    const { data, error } = await this.supabase.getClient().from("alerts").select("*").eq("alert_key", key).is("resolved_at", null).maybeSingle();
    if (error) throw error;
    return data as unknown as AlertRow | null;
  }

  async insertAlert(input: Omit<AlertRow, "id"> & { id?: string }): Promise<AlertRow> {
    const { data, error } = await this.supabase
      .getClient()
      .from("alerts")
      .insert({ id: input.id ?? randomUUID(), ...input })
      .select("*")
      .single();
    if (error) throw error;
    return data as unknown as AlertRow;
  }

  async acknowledgeAlert(id: string): Promise<AlertRow> {
    const { data, error } = await this.supabase
      .getClient()
      .from("alerts")
      .update({ acknowledged: true, acknowledged_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return data as unknown as AlertRow;
  }

  async deleteAcknowledgedAlerts(): Promise<AlertRow[]> {
    const { data: acknowledged, error: readError } = await this.supabase.getClient().from("alerts").select("*").eq("acknowledged", true);
    if (readError) throw readError;
    const rows = (acknowledged ?? []) as unknown as AlertRow[];
    if (!rows.length) return [];
    const { error } = await this.supabase.getClient().from("alerts").delete().eq("acknowledged", true);
    if (error) throw error;
    return rows;
  }

  async listReadings(roomId: string, metric: Metric, limit = 500): Promise<ReadingRow[]> {
    const sensors = await this.listSensors(roomId);
    const sensor = sensors.find((item) => item.metric === metric);
    if (!sensor) return [];
    const { data, error } = await this.supabase
      .getClient()
      .from("sensor_readings")
      .select("*")
      .eq("sensor_id", sensor.id)
      .order("recorded_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return ((data ?? []) as unknown as ReadingRow[]).reverse();
  }

  async persistTelemetry(input: TelemetryPersistenceInput): Promise<TelemetryPersistenceResult> {
    const sensors = await this.listSensors(input.roomId);
    const ids: string[] = [];
    const duplicateKeys = new Set<string>();
    let duplicateCount = 0;
    let hasNewValue = false;
    for (const metric of ["temperatura", "umidade", "co2"] as Metric[]) {
      const value = input.values[metric];
      const sensor = sensors.find((item) => item.metric === metric);
      if (value == null || !sensor) continue;
      const sourceMessageId = input.sourceMessageId ? `${input.sourceMessageId}:${metric}` : null;
      if (sourceMessageId) {
        const { data: existing, error: existingError } = await this.supabase
          .getClient()
          .from("sensor_readings")
          .select("id")
          .eq("source_message_id", sourceMessageId)
          .maybeSingle();
        if (existingError) throw existingError;
        if (existing) {
          duplicateKeys.add(sourceMessageId);
          duplicateCount += 1;
          continue;
        }
      }
      hasNewValue = true;
    }
    if (!hasNewValue) return { ids, duplicate: duplicateCount > 0 };

    const roomPatch: Record<string, unknown> = {
      last_reading_at: input.recordedAt,
      telemetry_source: input.source,
    };
    if (input.values.temperatura != null) roomPatch.current_temperature = input.values.temperatura;
    if (input.values.umidade != null) roomPatch.current_humidity = input.values.umidade;
    if (input.values.co2 != null) roomPatch.current_co2 = input.values.co2;
    await this.updateRoom(input.roomId, roomPatch);

    for (const metric of ["temperatura", "umidade", "co2"] as Metric[]) {
      const value = input.values[metric];
      const sensor = sensors.find((item) => item.metric === metric);
      if (value == null || !sensor) continue;
      const sourceMessageId = input.sourceMessageId ? `${input.sourceMessageId}:${metric}` : null;
      if (sourceMessageId && duplicateKeys.has(sourceMessageId)) continue;
      const id = randomUUID();
      const { error } = await this.supabase.getClient().from("sensor_readings").insert({
        id,
        sensor_id: sensor.id,
        room_id: input.roomId,
        value,
        quality: input.quality,
        source: input.source,
        source_message_id: sourceMessageId,
        recorded_at: input.recordedAt,
      });
      if (error) throw error;
      ids.push(id);
      const { error: sensorError } = await this.supabase
        .getClient()
        .from("sensors")
        .update({ last_seen_at: input.recordedAt, status: "ativo" })
        .eq("id", sensor.id);
      if (sensorError) throw sensorError;
    }
    return { ids, duplicate: false };
  }

  async getNtfyConfig(): Promise<NtfyConfigRow | null> {
    const { data, error } = await this.supabase.getClient().from("ntfy_config").select("*").eq("id", "default").maybeSingle();
    if (error) throw error;
    return data as unknown as NtfyConfigRow | null;
  }

  async updateNtfyConfig(patch: Record<string, unknown>): Promise<NtfyConfigRow> {
    const { data, error } = await this.supabase
      .getClient()
      .from("ntfy_config")
      .upsert({ id: "default", ...patch, updated_at: new Date().toISOString() })
      .select("*")
      .single();
    if (error) throw error;
    return data as unknown as NtfyConfigRow;
  }

  async listNtfyLogs(): Promise<NtfyLogRow[]> {
    const { data, error } = await this.supabase.getClient().from("ntfy_logs").select("*").order("sent_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as unknown as NtfyLogRow[];
  }

  async insertNtfyLog(input: Omit<NtfyLogRow, "id"> & { id?: string }): Promise<NtfyLogRow> {
    const { data, error } = await this.supabase
      .getClient()
      .from("ntfy_logs")
      .insert({ id: input.id ?? randomUUID(), ...input })
      .select("*")
      .single();
    if (error) throw error;
    return data as unknown as NtfyLogRow;
  }

  async listAuditEvents(): Promise<AuditEventRow[]> {
    const { data, error } = await this.supabase.getClient().from("audit_events").select("*").order("occurred_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as unknown as AuditEventRow[];
  }

  async insertAuditEvent(input: {
    category: AuditCategory;
    description: string;
    roomId?: string | null;
    origin?: EventSource;
  }): Promise<AuditEventRow> {
    const { data, error } = await this.supabase
      .getClient()
      .from("audit_events")
      .insert({
        id: randomUUID(),
        category: input.category,
        description: input.description,
        room_id: input.roomId ?? null,
        origin: input.origin ?? "sistema",
        occurred_at: new Date().toISOString(),
      })
      .select("*")
      .single();
    if (error) throw error;
    return data as unknown as AuditEventRow;
  }

  async getIdentification(): Promise<IdentificationRow | null> {
    const { data, error } = await this.supabase.getClient().from("identification").select("*").eq("id", "default").maybeSingle();
    if (error) throw error;
    return data as unknown as IdentificationRow | null;
  }

  async updateIdentification(patch: Record<string, unknown>): Promise<IdentificationRow> {
    const { data, error } = await this.supabase
      .getClient()
      .from("identification")
      .upsert({ id: "default", ...patch, updated_at: new Date().toISOString() })
      .select("*")
      .single();
    if (error) throw error;
    return data as unknown as IdentificationRow;
  }

  toAlertRow(alert: Alert): Omit<AlertRow, "id"> {
    return {
      level: alert.level,
      alert_type: alert.tipo,
      message: alert.mensagem,
      room_id: alert.salaId,
      sensor_id: null,
      alert_key: alert.key ?? `${alert.salaId ?? "sys"}:${alert.tipo}:${alert.level}`,
      acknowledged: alert.reconhecido,
      acknowledged_at: null,
      resolved_at: null,
      occurred_at: alert.ts,
    };
  }

  toNtfyConfigRow(config: NtfyConfig): Record<string, unknown> {
    return {
      enabled: config.enabled,
      server_url: config.server,
      topic: config.topic,
      min_level: config.minLevel,
    };
  }

  toIdentificationRow(identification: Identification): Record<string, unknown> {
    return {
      establishment: identification.estabelecimento,
      cnes: identification.cnes,
      system_name: identification.sistema,
      responsible_technician: identification.responsavelTecnico,
      professional_registration: identification.registro,
    };
  }
}
