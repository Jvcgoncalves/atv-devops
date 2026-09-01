import { Inject, Injectable, Logger, Optional } from "@nestjs/common";
import { mapMqttPayloadToTelemetry, normalizeRoomId } from "@hvac/domain";
import { BathroomsService } from "../bathrooms/bathrooms.service.js";
import { RealtimeService } from "../realtime/realtime.service.js";
import { RoomsService } from "../rooms/rooms.service.js";
import { TelemetryService } from "../telemetry/telemetry.service.js";
import { MqttClientService } from "./mqtt-client.service.js";
import type { MqttMessage } from "./mqtt.types.js";
import { OperationsService } from "../operations/operations.service.js";

@Injectable()
export class MqttIngestionService {
  private readonly logger = new Logger(MqttIngestionService.name);
  private messageQueue = Promise.resolve();

  constructor(
    @Inject(MqttClientService) private readonly mqtt: MqttClientService,
    @Inject(TelemetryService) private readonly telemetry: TelemetryService,
    @Inject(RoomsService) private readonly rooms: RoomsService,
    @Inject(BathroomsService) private readonly bathrooms: BathroomsService,
    @Inject(RealtimeService) private readonly realtime: RealtimeService,
    @Optional() @Inject(OperationsService) private readonly operations?: OperationsService,
  ) {}

  onModuleInit(): void {
    this.mqtt.subscribe((message) => {
      this.messageQueue = this.messageQueue
        .then(() => this.handle(message))
        .catch((error) => {
          this.logger.error(`MQTT queue failure: ${error instanceof Error ? error.message : String(error)}`);
        });
    });
  }

  private async handle(message: MqttMessage): Promise<void> {
    try {
      if (!message || typeof message.topic !== "string" || !Buffer.isBuffer(message.payload)) return;
      if (this.handleStatus(message)) return;
      if (await this.handleVav(message)) return;
      if (await this.handleBathroom(message)) return;
      if (!this.isTelemetryTopic(message.topic)) return;
      const telemetry = mapMqttPayloadToTelemetry({
        topic: message.topic,
        payload: message.payload,
        defaultRoomId: process.env.MQTT_DEFAULT_ROOM_ID ?? "sala-1",
      });
      if (!telemetry) {
        this.logger.warn(`[MQTT MAP] rejected topic=${message.topic} payload=${message.payload.toString("utf8")}`);
        this.operations?.recordTelemetryRejected();
        return;
      }
      this.logger.log(`[MQTT MAP] ${JSON.stringify(telemetry)}`);
      const sourceMessageId = message.messageId == null ? undefined : `${message.topic}:${message.messageId}`;
      const result = await this.telemetry.ingest(telemetry, "MQTT", sourceMessageId);
      this.logger.log(`[MQTT INGEST] room=${telemetry.salaId} ok=${result?.ok ?? true} readingId=${result?.idLeitura ?? "-"} retain=${message.retain ?? false} dup=${message.dup ?? false}`);
    } catch (error) {
      this.logger.error(`MQTT message rejected: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private handleStatus(message: MqttMessage): boolean {
    if (!message.topic.endsWith("/status") && message.topic !== "hvac/status") return false;
    const payload = this.json(message);
    if (typeof payload?.online !== "boolean") return true;
    this.realtime.publish("device.status.changed", { deviceId: message.topic, online: payload.online });
    return true;
  }

  private async handleVav(message: MqttMessage): Promise<boolean> {
    const match = message.topic.match(/(?:^|\/)sala\/([^/]+)\/vav$/);
    if (!match) return false;
    const roomId = normalizeRoomId(match[1]);
    const payload = this.json(message);
    if (!roomId || !payload || typeof payload.abertura !== "number" || !Number.isFinite(payload.abertura) || payload.abertura < 0 || payload.abertura > 100 || (payload.estado !== "ok" && payload.estado !== "falha")) return true;
    await this.rooms.ingestVavState(roomId, payload.abertura, payload.estado);
    return true;
  }

  private async handleBathroom(message: MqttMessage): Promise<boolean> {
    const match = message.topic.match(/(?:^|\/)banheiro\/([^/]+)\/luz$/);
    if (!match) return false;
    const bathroomId = match[1].startsWith("ban-") ? match[1] : `ban-${match[1]}`;
    const payload = this.json(message);
    if (!payload || typeof payload.luz !== "boolean") return true;
    await this.bathrooms.update(bathroomId, payload.luz, false);
    return true;
  }

  private json(message: MqttMessage): Record<string, unknown> | null {
    try {
      const value: unknown = JSON.parse(message.payload.toString("utf8"));
      return value && typeof value === "object" ? value as Record<string, unknown> : null;
    } catch {
      return null;
    }
  }

  private isTelemetryTopic(topic: string): boolean {
    if (/^hvac\/sala\/[^/]+\/telemetria$/.test(topic)) return true;
    const legacyTopics = [process.env.MQTT_LEGACY_TOPIC, process.env.MQTT_TOPIC, "tcc-hvac-kaue/airquality"]
      .filter(Boolean)
      .join(",")
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item && !item.includes("#") && !item.includes("+"));
    return legacyTopics.includes(topic);
  }
}
