import { Body, Controller, Get, Inject, Put } from "@nestjs/common";
import type { Identification, NtfyConfig, NtfyLogEntry } from "@hvac/contracts";
import { IdentificationDto, NtfyConfigDto } from "../dto/notifications.dto.js";
import { NotificationsService } from "./notifications.service.js";

@Controller("ntfy")
export class NtfyController {
  constructor(@Inject(NotificationsService) private readonly notifications: NotificationsService) {}

  @Get()
  getConfig(): Promise<NtfyConfig> {
    return this.notifications.getConfig();
  }

  @Put()
  updateConfig(@Body() body: NtfyConfigDto): Promise<NtfyConfig> {
    return this.notifications.updateConfig(body);
  }

  @Get("log")
  getLog(): Promise<NtfyLogEntry[]> {
    return this.notifications.listLog();
  }
}

@Controller("identificacao")
export class IdentificationController {
  constructor(@Inject(NotificationsService) private readonly notifications: NotificationsService) {}

  @Get()
  getIdentification(): Promise<Identification> {
    return this.notifications.getIdentification();
  }

  @Put()
  updateIdentification(@Body() body: IdentificationDto): Promise<Identification> {
    return this.notifications.updateIdentification(body);
  }
}
