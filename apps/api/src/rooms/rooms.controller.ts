import { Body, Controller, Get, Inject, Param, Put } from "@nestjs/common";
import type { Room } from "@hvac/contracts";
import { SetpointDto, VavFaultDto, VavModeDto, VavOpeningDto } from "../dto/commands.dto.js";
import { RoomsService } from "./rooms.service.js";

@Controller("salas")
export class RoomsController {
  constructor(@Inject(RoomsService) private readonly rooms: RoomsService) {}

  @Get()
  list(): Promise<Room[]> {
    return this.rooms.list();
  }

  @Get(":salaId")
  get(@Param("salaId") salaId: string): Promise<Room> {
    return this.rooms.get(salaId);
  }

  @Put(":salaId/setpoint")
  setpoint(@Param("salaId") salaId: string, @Body() body: SetpointDto): Promise<Room> {
    return this.rooms.setpoint(salaId, body.setpoint);
  }

  @Put(":salaId/vav/modo")
  setVavMode(@Param("salaId") salaId: string, @Body() body: VavModeDto): Promise<Room> {
    return this.rooms.setVavMode(salaId, body.modo);
  }

  @Put(":salaId/vav")
  setVav(@Param("salaId") salaId: string, @Body() body: VavOpeningDto): Promise<Room> {
    return this.rooms.setVavOpening(salaId, body.abertura);
  }

  @Put(":salaId/vav/falha")
  setVavFault(@Param("salaId") salaId: string, @Body() body: VavFaultDto): Promise<Room> {
    return this.rooms.setVavFault(salaId, body.falha);
  }
}
