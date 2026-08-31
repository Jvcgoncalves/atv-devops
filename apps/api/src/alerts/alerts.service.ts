import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { Alert, Room, RoomThresholds } from "@hvac/contracts";
import { evaluateRoomAlerts } from "@hvac/domain";
import { AuditService } from "../audit/audit.service.js";
import { HvacRepository } from "../database/hvac.repository.js";
import { mapAlert } from "../mappers/response-mappers.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import { RealtimeService } from "../realtime/realtime.service.js";

@Injectable()
export class AlertsService {
  constructor(
    @Inject(HvacRepository) private readonly repository: HvacRepository,
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(RealtimeService) private readonly realtime: RealtimeService,
  ) {}

  async list(): Promise<Alert[]> {
    return (await this.repository.listAlerts()).map(mapAlert);
  }

  async evaluateRoom(room: Room, thresholds: RoomThresholds): Promise<Alert[]> {
    const created: Alert[] = [];
    for (const candidate of evaluateRoomAlerts(room, thresholds)) {
      if (await this.repository.findActiveAlertByKey(candidate.key)) continue;
      try {
        const row = await this.repository.insertAlert({
          ...this.repository.toAlertRow({
            id: "pending",
            level: candidate.level,
            tipo: candidate.tipo,
            mensagem: candidate.mensagem,
            salaId: candidate.salaId,
            ts: new Date().toISOString(),
            reconhecido: false,
            key: candidate.key,
          }),
          id: undefined,
        });
        const alert = mapAlert(row);
        created.push(alert);
        await this.audit.record("alerta", `[${alert.level.toUpperCase()}] ${alert.mensagem}`, alert.salaId, "sistema");
        await this.notifications.sendAlert(alert);
        this.realtime.publish("alert.created", { alert });
      } catch (error) {
        if (!String(error).toLowerCase().includes("duplicate") && !String(error).toLowerCase().includes("unique")) throw error;
      }
    }
    return created;
  }

  async acknowledge(id: string): Promise<Alert[]> {
    const current = await this.repository.findAlert(id);
    if (!current) throw new NotFoundException("alerta nao encontrado");
    const alert = mapAlert(await this.repository.acknowledgeAlert(id));
    await this.audit.record("reconhecimento", `Alerta reconhecido: ${alert.mensagem}`, alert.salaId, "operador");
    this.realtime.publish("alert.updated", { alert });
    return this.list();
  }

  async clearAcknowledged(): Promise<Alert[]> {
    const removed = await this.repository.deleteAcknowledgedAlerts();
    for (const row of removed) this.realtime.publish("alert.updated", { alert: mapAlert(row) });
    return this.list();
  }
}
