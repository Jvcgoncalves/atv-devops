import { Controller, Get, Inject, Res } from "@nestjs/common";
import type { HealthResponse } from "@hvac/contracts";
import { SupabaseService } from "../database/supabase.service.js";
import { MqttClientService } from "../mqtt/mqtt-client.service.js";
import { OperationsService } from "../operations/operations.service.js";
import type { HealthResponseWriter, ReadinessResponse } from "../operations/operations.types.js";

@Controller("health")
export class HealthController {
  constructor(
    @Inject(SupabaseService) private readonly database: SupabaseService,
    @Inject(MqttClientService) private readonly mqtt: MqttClientService,
    @Inject(OperationsService) private readonly operations: OperationsService,
  ) {}

  @Get()
  getHealth(): HealthResponse {
    return { ok: true, ts: new Date().toISOString() };
  }

  @Get("ready")
  async getReadiness(@Res({ passthrough: true }) response: HealthResponseWriter): Promise<ReadinessResponse> {
    const databaseOk = await this.database.checkConnection();
    const mqttEnabled = process.env.MQTT_ENABLED !== "false";
    const mqttOk = !mqttEnabled || this.mqtt.isConnected();
    const body: ReadinessResponse = {
      ok: databaseOk && mqttOk,
      ts: new Date().toISOString(),
      checks: {
        database: databaseOk ? "ok" : "error",
        mqtt: !mqttEnabled ? "disabled" : mqttOk ? "ok" : "error",
      },
      metrics: this.operations.snapshot(),
    };
    response.statusCode = body.ok ? 200 : 503;
    return body;
  }

  @Get("metrics")
  getMetrics() {
    return this.operations.snapshot();
  }
}
