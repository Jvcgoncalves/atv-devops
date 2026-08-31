import { Inject, Injectable } from "@nestjs/common";
import type { AuditCategory, AuditEvent, EventSource } from "@hvac/contracts";
import { HvacRepository } from "../database/hvac.repository.js";
import { mapAuditEvent } from "../mappers/response-mappers.js";

@Injectable()
export class AuditService {
  constructor(@Inject(HvacRepository) private readonly repository: HvacRepository) {}

  async list(): Promise<AuditEvent[]> {
    return (await this.repository.listAuditEvents()).map(mapAuditEvent);
  }

  async record(category: AuditCategory, description: string, roomId: string | null = null, origin: EventSource = "sistema"): Promise<AuditEvent> {
    return mapAuditEvent(await this.repository.insertAuditEvent({ category, description, roomId, origin }));
  }
}
