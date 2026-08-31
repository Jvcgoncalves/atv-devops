import { Module } from "@nestjs/common";
import { AlertsModule } from "../alerts/alerts.module.js";
import { AuditModule } from "../audit/audit.module.js";
import { DatabaseModule } from "../database/database.module.js";
import { RealtimeModule } from "../realtime/realtime.module.js";
import { StateModule } from "../state/state.module.js";
import { TelemetryController } from "./telemetry.controller.js";
import { TelemetryService } from "./telemetry.service.js";

@Module({
  imports: [DatabaseModule, StateModule, AlertsModule, AuditModule, RealtimeModule],
  controllers: [TelemetryController],
  providers: [TelemetryService],
  exports: [TelemetryService],
})
export class TelemetryModule {}
