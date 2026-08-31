import { Module } from "@nestjs/common";
import { AlertsModule } from "./alerts/alerts.module.js";
import { AuditModule } from "./audit/audit.module.js";
import { BathroomsModule } from "./bathrooms/bathrooms.module.js";
import { ClimatizersModule } from "./climatizers/climatizers.module.js";
import { DatabaseModule } from "./database/database.module.js";
import { DeviceModule } from "./device/device.module.js";
import { HealthModule } from "./health/health.module.js";
import { MqttIngestionModule } from "./mqtt/mqtt-ingestion.module.js";
import { MqttModule } from "./mqtt/mqtt.module.js";
import { NotificationsModule } from "./notifications/notifications.module.js";
import { RealtimeModule } from "./realtime/realtime.module.js";
import { RoomsModule } from "./rooms/rooms.module.js";
import { StateModule } from "./state/state.module.js";
import { TelemetryModule } from "./telemetry/telemetry.module.js";
import { ThresholdsModule } from "./thresholds/thresholds.module.js";

@Module({
  imports: [
    DatabaseModule,
    MqttModule,
    StateModule,
    RealtimeModule,
    AuditModule,
    NotificationsModule,
    AlertsModule,
    TelemetryModule,
    RoomsModule,
    ClimatizersModule,
    BathroomsModule,
    ThresholdsModule,
    DeviceModule,
    MqttIngestionModule,
    HealthModule,
  ],
})
export class AppModule {}
