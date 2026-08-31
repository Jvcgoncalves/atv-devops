import { Controller, Get } from "@nestjs/common";
import type { HealthResponse } from "@hvac/contracts";

@Controller("health")
export class HealthController {
  @Get()
  getHealth(): HealthResponse {
    return { ok: true, ts: new Date().toISOString() };
  }
}
