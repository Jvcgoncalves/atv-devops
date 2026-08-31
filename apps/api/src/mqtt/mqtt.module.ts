import { Global, Module } from "@nestjs/common";
import { MqttClientService } from "./mqtt-client.service.js";

@Global()
@Module({
  providers: [MqttClientService],
  exports: [MqttClientService],
})
export class MqttModule {}
