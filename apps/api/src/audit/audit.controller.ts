import { Controller, Get, Inject } from "@nestjs/common";
import type { AuditEvent } from "@hvac/contracts";
import { AuditService } from "./audit.service.js";

@Controller("eventos")
export class AuditController {
  constructor(@Inject(AuditService) private readonly audit: AuditService) {}

  @Get()
  list(): Promise<AuditEvent[]> {
    return this.audit.list();
  }
}
