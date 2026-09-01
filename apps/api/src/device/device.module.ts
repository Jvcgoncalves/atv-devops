import { Module } from "@nestjs/common";
import { BathroomsModule } from "../bathrooms/bathrooms.module.js";
import { RoomsModule } from "../rooms/rooms.module.js";
import { DeviceController } from "./device.controller.js";

@Module({
  imports: [RoomsModule, BathroomsModule],
  controllers: [DeviceController],
})
export class DeviceModule {}
