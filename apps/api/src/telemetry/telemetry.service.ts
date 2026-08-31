import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import type { Metric, TelemetryInput, TelemetryResponse, TelemetrySource } from "@hvac/contracts";
import { normalizeTelemetryPayload } from "@hvac/domain";
import { AlertsService } from "../alerts/alerts.service.js";
import { AuditService } from "../audit/audit.service.js";
import { HvacRepository } from "../database/hvac.repository.js";
import { mapHistory, mapThresholdRows } from "../mappers/response-mappers.js";
import { RealtimeService } from "../realtime/realtime.service.js";
import { StateService } from "../state/state.service.js";

@Injectable()
export class TelemetryService {
  private externalRoom: string | null = null;

  constructor(
    @Inject(HvacRepository) private readonly repository: HvacRepository,
    @Inject(StateService) private readonly state: StateService,
    @Inject(AlertsService) private readonly alerts: AlertsService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(RealtimeService) private readonly realtime: RealtimeService,
  ) {}

  async ingest(input: TelemetryInput, source: TelemetrySource = "REST", sourceMessageId?: string): Promise<TelemetryResponse> {
    const normalized = normalizeTelemetryPayload(input);
    if (!normalized) throw new BadRequestException("telemetria invalida");
    const room = await this.state.getRoom(normalized.salaId);
    const values = this.validateValues(normalized);
    const sensors = await this.repository.listSensors(room.id);
    if (Object.keys(values).some((metric) => !sensors.some((sensor) => sensor.metric === metric))) {
      throw new BadRequestException("sensor da metrica nao encontrado");
    }
    const recordedAt = new Date().toISOString();
    const result = await this.repository.persistTelemetry({
      roomId: room.id,
      values,
      source,
      recordedAt,
      quality: "good",
      sourceMessageId,
    });
    if (result.duplicate) return { ok: true, idLeitura: result.ids[0] };

    const updated = await this.state.getRoom(room.id);
    const thresholdRows = await this.repository.listThresholds(room.id);
    const thresholds = mapThresholdRows(thresholdRows)[room.id];
    if (thresholds) await this.alerts.evaluateRoom(updated, thresholds);
    await this.audit.record("registro", `Telemetria recebida para ${updated.nome} (${source})`, room.id, source === "MQTT" || source === "ESP32" ? "dispositivo" : "sistema");
    this.realtime.publish("telemetry.updated", {
      roomId: updated.id,
      temperature: updated.temperatura,
      humidity: updated.umidade,
      co2: updated.co2,
      source,
    });
    return { ok: true, idLeitura: result.ids[0] };
  }

  async history(roomId: string, metric: string) {
    if (!this.isMetric(metric)) throw new BadRequestException("metrica invalida");
    await this.state.getRoom(roomId);
    return mapHistory(await this.repository.listReadings(roomId, metric), metric);
  }

  setExternalRoom(roomId: string | null): { externalRoom: string | null } {
    this.externalRoom = roomId;
    return { externalRoom: this.externalRoom };
  }

  getExternalRoom(): string | null {
    return this.externalRoom;
  }

  private validateValues(input: TelemetryInput): Partial<Record<Metric, number>> {
    const values: Partial<Record<Metric, number>> = {};
    for (const metric of ["temperatura", "umidade", "co2"] as Metric[]) {
      const value = input[metric];
      if (value === undefined) continue;
      if (!Number.isFinite(value)) throw new BadRequestException("valor de telemetria invalido");
      if (metric === "temperatura" && (value < -50 || value > 80)) throw new BadRequestException("temperatura fora da faixa");
      if (metric === "umidade" && (value < 0 || value > 100)) throw new BadRequestException("umidade fora da faixa");
      if (metric === "co2" && (value < 0 || value > 100000)) throw new BadRequestException("co2 fora da faixa");
      values[metric] = value;
    }
    if (!Object.keys(values).length) throw new BadRequestException("telemetria sem metricas");
    return values;
  }

  private isMetric(metric: string): metric is Metric {
    return metric === "temperatura" || metric === "umidade" || metric === "co2";
  }
}
