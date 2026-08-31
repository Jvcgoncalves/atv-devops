import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { Room, VavMode } from "@hvac/contracts";
import { AlertsService } from "../alerts/alerts.service.js";
import { AuditService } from "../audit/audit.service.js";
import { HvacRepository } from "../database/hvac.repository.js";
import { MqttClientService } from "../mqtt/mqtt-client.service.js";
import { RealtimeService } from "../realtime/realtime.service.js";
import { StateService } from "../state/state.service.js";

@Injectable()
export class RoomsService {
  constructor(
    @Inject(HvacRepository) private readonly repository: HvacRepository,
    @Inject(StateService) private readonly state: StateService,
    @Inject(MqttClientService) private readonly mqtt: MqttClientService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(AlertsService) private readonly alerts: AlertsService,
    @Inject(RealtimeService) private readonly realtime: RealtimeService,
  ) {}

  async list(): Promise<Room[]> {
    return (await this.state.getState()).salas;
  }

  get(id: string): Promise<Room> {
    return this.state.getRoom(id);
  }

  async setpoint(roomId: string, setpoint: number): Promise<Room> {
    await this.requireRoom(roomId);
    if (!Number.isFinite(setpoint) || setpoint < 16 || setpoint > 30) throw new BadRequestException("setpoint deve estar entre 16 e 30");
    const room = await this.state.getRoom(roomId);
    await this.repository.updateRoom(roomId, { setpoint });
    if (room.setpoint !== setpoint) await this.audit.record("setpoint", `${room.nome}: setpoint alterado de ${room.setpoint}°C para ${setpoint}°C`, roomId, "operador");
    return this.state.getRoom(roomId);
  }

  async setVavMode(roomId: string, mode: VavMode): Promise<Room> {
    const room = await this.requireRoom(roomId);
    await this.repository.updateVav(roomId, { mode, reason: mode === "manual" ? "manual" : "estavel" });
    await this.audit.record("vav", `${room.nome}: modo da VAV alterado para ${mode.toUpperCase()}`, roomId, "operador");
    return this.state.getRoom(roomId);
  }

  async setVavOpening(roomId: string, opening: number): Promise<Room> {
    const room = await this.requireRoom(roomId);
    if (!Number.isFinite(opening) || opening < 0 || opening > 100) throw new BadRequestException("abertura deve estar entre 0 e 100");
    const value = Math.round(opening);
    await this.repository.updateVav(roomId, { opening: value, mode: "manual", reason: "manual" });
    await this.mqtt.publish(`hvac/sala/${this.topicRoomId(roomId)}/vav/set`, { abertura: value });
    await this.audit.record("vav", `${room.nome}: VAV ajustada manualmente para ${value}%`, roomId, "operador");
    return this.state.getRoom(roomId);
  }

  async setVavFault(roomId: string, fault: boolean): Promise<Room> {
    const room = await this.requireRoom(roomId);
    await this.repository.updateVav(roomId, { state: fault ? "falha" : "ok" });
    await this.audit.record("vav", `${room.nome}: falha de VAV ${fault ? "registrada" : "normalizada"}`, roomId, fault ? "sistema" : "operador");
    const updated = await this.state.getRoom(roomId);
    const thresholds = await this.repository.listThresholds(roomId);
    const threshold = thresholds.length ? (await import("../mappers/response-mappers.js")).mapThresholdRows(thresholds)[roomId] : undefined;
    if (threshold) await this.alerts.evaluateRoom(updated, threshold);
    return updated;
  }

  async ingestVavState(roomId: string, opening: number, state: "ok" | "falha"): Promise<Room> {
    const room = await this.requireRoom(roomId);
    await this.repository.updateVav(roomId, { opening, state, reason: state === "falha" ? "estavel" : room.vav.motivo });
    await this.audit.record("vav", `${room.nome}: estado recebido do dispositivo (${state}, ${opening}%)`, roomId, "dispositivo");
    const updated = await this.state.getRoom(roomId);
    const thresholds = await this.repository.listThresholds(roomId);
    if (thresholds.length) {
      const { mapThresholdRows } = await import("../mappers/response-mappers.js");
      await this.alerts.evaluateRoom(updated, mapThresholdRows(thresholds)[roomId]);
    }
    return updated;
  }

  private async requireRoom(roomId: string): Promise<Room> {
    const room = await this.state.findRoom(roomId);
    if (!room) throw new NotFoundException("sala nao encontrada");
    return room;
  }

  private topicRoomId(roomId: string): string {
    return roomId.startsWith("sala-") ? roomId.slice(5) : roomId;
  }
}
