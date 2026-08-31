import { Controller, Delete, Get, HttpCode, HttpStatus, Inject, Param, Post } from "@nestjs/common";
import type { Alert } from "@hvac/contracts";
import { AlertsService } from "./alerts.service.js";

@Controller("alertas")
export class AlertsController {
  constructor(@Inject(AlertsService) private readonly alerts: AlertsService) {}

  @Get()
  list(): Promise<Alert[]> {
    return this.alerts.list();
  }

  @Post(":id/reconhecer")
  @HttpCode(HttpStatus.OK)
  acknowledge(@Param("id") id: string): Promise<Alert[]> {
    return this.alerts.acknowledge(id);
  }

  @Delete("reconhecidos")
  clearAcknowledged(): Promise<Alert[]> {
    return this.alerts.clearAcknowledged();
  }
}
