import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import type { RoomThresholds, ThresholdsMap } from "@hvac/contracts";
import { normalizeThresholds, validateThresholds } from "@hvac/domain";
import { AlertsService } from "../alerts/alerts.service.js";
import { AuditService } from "../audit/audit.service.js";
import { HvacRepository } from "../database/hvac.repository.js";
import { mapThresholdRows } from "../mappers/response-mappers.js";
import { StateService } from "../state/state.service.js";

@Injectable()
export class ThresholdsService {
  constructor(
    @Inject(HvacRepository) private readonly repository: HvacRepository,
    @Inject(StateService) private readonly state: StateService,
    @Inject(AlertsService) private readonly alerts: AlertsService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async getAll(): Promise<ThresholdsMap> {
    return mapThresholdRows(await this.repository.listThresholds());
  }

  async update(roomId: string, patch: unknown): Promise<ThresholdsMap> {
    const room = await this.state.getRoom(roomId);
    const currentRows = await this.repository.listThresholds(roomId);
    const current = currentRows.length ? mapThresholdRows(currentRows)[roomId] : undefined;
    const next = normalizeThresholds(patch, current);
    if (!validateThresholds(next)) throw new BadRequestException("faixas de alerta invalidas");
    await this.repository.upsertThresholds(roomId, next);
    await this.audit.record("parametro", `Faixas de alerta de ${room.nome} alteradas`, roomId, "operador");
    await this.alerts.evaluateRoom(room, next);
    return this.getAll();
  }
}
