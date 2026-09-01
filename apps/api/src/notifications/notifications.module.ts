import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module.js";
import { DatabaseModule } from "../database/database.module.js";
import { IdentificationController, NtfyController } from "./notifications.controller.js";
import { NotificationsService } from "./notifications.service.js";

@Module({
  imports: [DatabaseModule, AuditModule],
  controllers: [NtfyController, IdentificationController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
