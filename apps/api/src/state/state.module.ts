import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module.js";
import { MqttModule } from "../mqtt/mqtt.module.js";
import { StateController } from "./state.controller.js";
import { StateService } from "./state.service.js";

@Module({
  imports: [DatabaseModule, MqttModule],
  controllers: [StateController],
  providers: [StateService],
  exports: [StateService],
})
export class StateModule {}
