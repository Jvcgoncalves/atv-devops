import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { Climatizer, SetClimatizerRequest } from "@hvac/contracts";
import { AuditService } from "../audit/audit.service.js";
import { HvacRepository } from "../database/hvac.repository.js";
import { MqttClientService } from "../mqtt/mqtt-client.service.js";
import { StateService } from "../state/state.service.js";

@Injectable()
export class ClimatizersService {
  constructor(
    @Inject(HvacRepository) private readonly repository: HvacRepository,
    @Inject(StateService) private readonly state: StateService,
    @Inject(MqttClientService) private readonly mqtt: MqttClientService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async list(): Promise<Climatizer[]> {
    return (await this.state.getState()).climatizadores;
  }

  async update(id: string, patch: SetClimatizerRequest): Promise<Climatizer> {
    const current = await this.repository.findClimatizer(id);
    if (!current) throw new NotFoundException("climatizador nao encontrado");
    if (patch.ligado === undefined && patch.tempInsuflamento === undefined) throw new BadRequestException("nenhuma alteracao informada");
    if (patch.tempInsuflamento !== undefined && (!Number.isFinite(patch.tempInsuflamento) || patch.tempInsuflamento < -50 || patch.tempInsuflamento > 80)) {
      throw new BadRequestException("temperatura de insuflamento deve estar entre -50 e 80");
    }
    const updated = await this.repository.updateClimatizer(id, {
      ...(patch.ligado === undefined ? {} : { is_on: patch.ligado }),
      ...(patch.tempInsuflamento === undefined ? {} : { supply_air_temperature: patch.tempInsuflamento }),
    });
    if (patch.ligado !== undefined) await this.audit.record("climatizador", `${updated.name} ${updated.is_on ? "ligado" : "desligado"}`, null, "operador");
    if (patch.tempInsuflamento !== undefined) await this.audit.record("climatizador", `${updated.name}: temperatura de insuflamento ajustada para ${updated.supply_air_temperature}°C`, null, "operador");
    await this.mqtt.publish(`hvac/clima/${this.topicId(id)}/set`, { ligado: updated.is_on, tempInsuflamento: updated.supply_air_temperature });
    return this.state.getClimatizer(id);
  }

  private topicId(id: string): string {
    return id.startsWith("clima-") ? id.slice(6) : id;
  }
}
