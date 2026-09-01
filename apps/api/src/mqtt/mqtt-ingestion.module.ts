import { Module } from "@nestjs/common";
import { BathroomsModule } from "../bathrooms/bathrooms.module.js";
import { RealtimeModule } from "../realtime/realtime.module.js";
import { RoomsModule } from "../rooms/rooms.module.js";
import { TelemetryModule } from "../telemetry/telemetry.module.js";
import { MqttModule } from "./mqtt.module.js";
import { MqttIngestionService } from "./mqtt-ingestion.service.js";

@Module({
  imports: [MqttModule, TelemetryModule, RoomsModule, BathroomsModule, RealtimeModule],
  providers: [MqttIngestionService],
})
export class MqttIngestionModule {}
