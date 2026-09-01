import { Module } from "@nestjs/common";
import { AlertsModule } from "../alerts/alerts.module.js";
import { AuditModule } from "../audit/audit.module.js";
import { DatabaseModule } from "../database/database.module.js";
import { MqttModule } from "../mqtt/mqtt.module.js";
import { RealtimeModule } from "../realtime/realtime.module.js";
import { StateModule } from "../state/state.module.js";
import { RoomsController } from "./rooms.controller.js";
import { RoomsService } from "./rooms.service.js";

@Module({
  imports: [DatabaseModule, StateModule, MqttModule, AuditModule, AlertsModule, RealtimeModule],
  controllers: [RoomsController],
  providers: [RoomsService],
  exports: [RoomsService],
})
export class RoomsModule {}
