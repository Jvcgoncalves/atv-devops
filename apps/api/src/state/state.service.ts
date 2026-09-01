import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { Room, SystemState } from "@hvac/contracts";
import { HvacRepository } from "../database/hvac.repository.js";
import { mapBathroom, mapClimatizer, mapRoom, mapSystemState, mapThresholdRows } from "../mappers/response-mappers.js";
import { MqttClientService } from "../mqtt/mqtt-client.service.js";

@Injectable()
export class StateService {
  constructor(
    @Inject(HvacRepository) private readonly repository: HvacRepository,
    @Inject(MqttClientService) private readonly mqtt: MqttClientService,
  ) {}

  async getState(): Promise<SystemState> {
    const [roomRows, climatizerRows, vavRows, thresholdRows, bathroomRows] = await Promise.all([
      this.repository.listRooms(),
      this.repository.listClimatizers(),
      this.repository.listVavs(),
      this.repository.listThresholds(),
      this.repository.listBathrooms(),
    ]);
    const thresholds = mapThresholdRows(thresholdRows);
    const rooms = roomRows.map((room) => mapRoom(room, vavRows.find((vav) => vav.room_id === room.id) ?? null, thresholds[room.id]));
    const climatizers = climatizerRows.map((climatizer) => mapClimatizer(climatizer, roomRows));
    const bathrooms = bathroomRows.map(mapBathroom);
    const fallbackSource = roomRows.some((room) => room.telemetry_source === "REST") ? "REST" : "MQTT";
    return mapSystemState(rooms, climatizers, bathrooms, this.mqtt.isConnected() || roomRows.length > 0, this.mqtt.isConnected() ? "MQTT" : fallbackSource);
  }

  async findRoom(id: string): Promise<Room | null> {
    const row = await this.repository.findRoom(id);
    if (!row) return null;
    const [vav, thresholds] = await Promise.all([
      this.repository.findVavByRoom(id),
      this.repository.listThresholds(id),
    ]);
    return mapRoom(row, vav, mapThresholdRows(thresholds)[id]);
  }

  async getRoom(id: string): Promise<Room> {
    const room = await this.findRoom(id);
    if (!room) throw new NotFoundException("sala nao encontrada");
    return room;
  }

  async getClimatizer(id: string) {
    const rows = await this.repository.listRooms();
    const climatizer = await this.repository.findClimatizer(id);
    if (!climatizer) throw new NotFoundException("climatizador nao encontrado");
    return mapClimatizer(climatizer, rows);
  }
}
