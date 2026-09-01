import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module.js";
import { DatabaseModule } from "../database/database.module.js";
import { MqttModule } from "../mqtt/mqtt.module.js";
import { BathroomsController } from "./bathrooms.controller.js";
import { BathroomsService } from "./bathrooms.service.js";

@Module({
  imports: [DatabaseModule, MqttModule, AuditModule],
  controllers: [BathroomsController],
  providers: [BathroomsService],
  exports: [BathroomsService],
})
export class BathroomsModule {}
