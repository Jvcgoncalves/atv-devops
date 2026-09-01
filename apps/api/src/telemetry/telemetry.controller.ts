import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Param, Post, Put } from "@nestjs/common";
import type { TelemetryHistoryPoint, TelemetryResponse } from "@hvac/contracts";
import { FonteExternaDto, TelemetryDto } from "../dto/telemetry.dto.js";
import { TelemetryService } from "./telemetry.service.js";

@Controller()
export class TelemetryController {
  constructor(@Inject(TelemetryService) private readonly telemetry: TelemetryService) {}

  @Get("historico/:salaId/:metrica")
  history(@Param("salaId") salaId: string, @Param("metrica") metric: string): Promise<TelemetryHistoryPoint[]> {
    return this.telemetry.history(salaId, metric);
  }

  @Post("telemetria")
  @HttpCode(HttpStatus.OK)
  ingest(@Body() body: TelemetryDto): Promise<TelemetryResponse> {
    return this.telemetry.ingest(body, "REST");
  }

  @Put("fonte-externa")
  setExternalRoom(@Body() body: FonteExternaDto): { externalRoom: string | null } {
    return this.telemetry.setExternalRoom(body.salaId);
  }
}
