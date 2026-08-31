import { Body, Controller, Get, Inject, Param, Put } from "@nestjs/common";
import type { Bathroom, ExhaustState } from "@hvac/contracts";
import { BathroomLightDto } from "../dto/commands.dto.js";
import { BathroomsService } from "./bathrooms.service.js";

@Controller("banheiros")
export class BathroomsController {
  constructor(@Inject(BathroomsService) private readonly bathrooms: BathroomsService) {}

  @Get()
  list(): Promise<Bathroom[]> {
    return this.bathrooms.list();
  }

  @Put(":id")
  update(@Param("id") id: string, @Body() body: BathroomLightDto): Promise<{ banheiros: Bathroom[]; exaustao: ExhaustState }> {
    return this.bathrooms.update(id, body.luz);
  }
}
