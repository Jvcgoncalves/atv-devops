import { Body, Controller, Get, Inject, Param, Put } from "@nestjs/common";
import type { Climatizer } from "@hvac/contracts";
import { ClimatizerPatchDto } from "../dto/commands.dto.js";
import { ClimatizersService } from "./climatizers.service.js";

@Controller("climatizadores")
export class ClimatizersController {
  constructor(@Inject(ClimatizersService) private readonly climatizers: ClimatizersService) {}

  @Get()
  list(): Promise<Climatizer[]> {
    return this.climatizers.list();
  }

  @Put(":id")
  update(@Param("id") id: string, @Body() body: ClimatizerPatchDto): Promise<Climatizer> {
    return this.climatizers.update(id, body);
  }
}
