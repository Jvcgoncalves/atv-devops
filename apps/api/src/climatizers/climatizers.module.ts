import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module.js";
import { DatabaseModule } from "../database/database.module.js";
import { MqttModule } from "../mqtt/mqtt.module.js";
import { StateModule } from "../state/state.module.js";
import { ClimatizersController } from "./climatizers.controller.js";
import { ClimatizersService } from "./climatizers.service.js";

@Module({
  imports: [DatabaseModule, StateModule, MqttModule, AuditModule],
  controllers: [ClimatizersController],
  providers: [ClimatizersService],
  exports: [ClimatizersService],
})
export class ClimatizersModule {}
