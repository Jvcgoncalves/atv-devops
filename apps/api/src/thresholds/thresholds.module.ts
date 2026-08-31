import { Module } from "@nestjs/common";
import { AlertsModule } from "../alerts/alerts.module.js";
import { AuditModule } from "../audit/audit.module.js";
import { DatabaseModule } from "../database/database.module.js";
import { StateModule } from "../state/state.module.js";
import { ThresholdsController } from "./thresholds.controller.js";
import { ThresholdsService } from "./thresholds.service.js";

@Module({
  imports: [DatabaseModule, StateModule, AlertsModule, AuditModule],
  controllers: [ThresholdsController],
  providers: [ThresholdsService],
  exports: [ThresholdsService],
})
export class ThresholdsModule {}
