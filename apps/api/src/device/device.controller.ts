import { Body, Controller, HttpCode, HttpStatus, Inject, Post } from "@nestjs/common";
import { DeviceBathroomLightDto, DeviceVavStateDto } from "../dto/commands.dto.js";
import { BathroomsService } from "../bathrooms/bathrooms.service.js";
import { RoomsService } from "../rooms/rooms.service.js";

@Controller()
export class DeviceController {
  constructor(
    @Inject(RoomsService) private readonly rooms: RoomsService,
    @Inject(BathroomsService) private readonly bathrooms: BathroomsService,
  ) {}

  @Post("vav/estado")
  @HttpCode(HttpStatus.OK)
  async vavState(@Body() body: DeviceVavStateDto): Promise<{ ok: boolean }> {
    await this.rooms.ingestVavState(body.salaId, body.abertura, body.estado);
    return { ok: true };
  }

  @Post("banheiro/luz")
  @HttpCode(HttpStatus.OK)
  async bathroomLight(@Body() body: DeviceBathroomLightDto): Promise<{ ok: boolean }> {
    await this.bathrooms.update(body.banheiroId, body.luz, false);
    return { ok: true };
  }
}
