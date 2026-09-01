import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { Bathroom, ExhaustState } from "@hvac/contracts";
import { calculateExhaustState } from "@hvac/domain";
import { AuditService } from "../audit/audit.service.js";
import { HvacRepository } from "../database/hvac.repository.js";
import { MqttClientService } from "../mqtt/mqtt-client.service.js";
import { mapBathroom } from "../mappers/response-mappers.js";

@Injectable()
export class BathroomsService {
  constructor(
    @Inject(HvacRepository) private readonly repository: HvacRepository,
    @Inject(MqttClientService) private readonly mqtt: MqttClientService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async list(): Promise<Bathroom[]> {
    return (await this.repository.listBathrooms()).map(mapBathroom);
  }

  async update(id: string, lightOn: boolean, publish = true): Promise<{ banheiros: Bathroom[]; exaustao: ExhaustState }> {
    const current = await this.repository.findBathroom(id);
    if (!current) throw new NotFoundException("banheiro nao encontrado");
    await this.repository.updateBathroom(id, lightOn);
    const bathrooms = await this.list();
    const exhaust = calculateExhaustState(bathrooms);
    await this.audit.record("exaustao", `${current.name}: luz ${lightOn ? "ligada" : "desligada"} -> exaustor ${exhaust.ligada ? "LIGADO" : "DESLIGADO"} (logica OR)`, null, "operador");
    if (publish) await this.mqtt.publish(`hvac/banheiro/${this.topicId(id)}/luz`, { luz: lightOn });
    return { banheiros: bathrooms, exaustao: exhaust };
  }

  private topicId(id: string): string {
    return id.startsWith("ban-") ? id.slice(4) : id;
  }
}
