import { Body, Controller, Get, Inject, Param, Put } from "@nestjs/common";
import type { ThresholdsMap } from "@hvac/contracts";
import { SaveThresholdsDto } from "../dto/thresholds.dto.js";
import { ThresholdsService } from "./thresholds.service.js";

@Controller("parametros")
export class ThresholdsController {
  constructor(@Inject(ThresholdsService) private readonly thresholds: ThresholdsService) {}

  @Get()
  getAll(): Promise<ThresholdsMap> {
    return this.thresholds.getAll();
  }

  @Put(":salaId")
  update(@Param("salaId") salaId: string, @Body() body: SaveThresholdsDto): Promise<ThresholdsMap> {
    return this.thresholds.update(salaId, body);
  }
}
