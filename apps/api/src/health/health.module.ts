import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module.js";
import { MqttModule } from "../mqtt/mqtt.module.js";
import { OperationsModule } from "../operations/operations.module.js";
import { HealthController } from "./health.controller.js";

@Module({
  imports: [DatabaseModule, MqttModule, OperationsModule],
  controllers: [HealthController],
})
export class HealthModule {}
