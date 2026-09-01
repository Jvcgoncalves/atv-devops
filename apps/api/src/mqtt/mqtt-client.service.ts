import { Inject, Injectable, Logger, Optional } from "@nestjs/common";
import mqtt from "mqtt";
import type { MqttClient } from "mqtt";
import type { MqttMessageListener } from "./mqtt.types.js";
import { OperationsService } from "../operations/operations.service.js";

@Injectable()
export class MqttClientService {
  private readonly logger = new Logger(MqttClientService.name);
  private client: MqttClient | null = null;
  private connected = false;
  private readonly listeners = new Set<MqttMessageListener>();

  constructor(@Optional() @Inject(OperationsService) private readonly operations?: OperationsService) {}

  onModuleInit(): void {
    if (process.env.MQTT_ENABLED === "false") return;
    const url = process.env.MQTT_URL ?? "mqtt://broker.hivemq.com:1883";
    const topics = (process.env.MQTT_TOPIC ?? "hvac/sala/+/telemetria,tcc-hvac-kaue/airquality")
      .split(",")
      .map((topic) => topic.trim())
      .filter(Boolean);
    if (!topics.length) topics.push("hvac/#");
    this.client = mqtt.connect(url, {
      reconnectPeriod: 5000,
      username: process.env.MQTT_USERNAME,
      password: process.env.MQTT_PASSWORD,
    });
    this.client.on("connect", () => {
      this.connected = true;
      this.operations?.recordMqttConnected();
      this.logger.log(`MQTT connected; subscribing ${topics.join(", ")}`);
      this.client?.subscribe(topics, (error) => {
        if (error) {
          this.operations?.recordMqttError(error);
          this.logger.error(`MQTT subscribe failed: ${error.message}`);
        }
      });
    });
    this.client.on("close", () => {
      this.connected = false;
      this.operations?.recordMqttDisconnected();
    });
    this.client.on("offline", () => {
      this.connected = false;
      this.operations?.recordMqttDisconnected();
    });
    this.client.on("error", (error) => {
      this.operations?.recordMqttError(error);
      this.logger.error(`MQTT error: ${error.message}`);
    });
    this.client.on("message", (topicName, payload, packet) => {
      this.operations?.recordMqttMessage();
      this.logger.log(`[MQTT RX] topic=${topicName} qos=${packet.qos} retain=${packet.retain} dup=${packet.dup} messageId=${packet.messageId} payload=${payload.toString("utf8")}`);
      for (const listener of this.listeners) listener({
        topic: topicName,
        payload,
        messageId: packet.messageId,
        qos: packet.qos,
        retain: packet.retain,
        dup: packet.dup,
      });
    });
  }

  onModuleDestroy(): void {
    this.client?.end(true);
    this.client = null;
    this.connected = false;
  }

  subscribe(listener: MqttMessageListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async publish(topic: string, payload: Record<string, unknown>): Promise<boolean> {
    if (!this.client || !this.connected) {
      this.logger.warn(`[MQTT TX] skipped; disconnected topic=${topic}`);
      return false;
    }
    const serialized = JSON.stringify(payload);
    this.logger.log(`[MQTT TX] topic=${topic} payload=${serialized}`);
    return new Promise((resolve) => {
      this.client?.publish(topic, serialized, { qos: 1 }, (error) => {
        if (error) this.logger.error(`MQTT publish failed: ${error.message}`);
        else this.logger.log(`[MQTT TX OK] topic=${topic}`);
        resolve(!error);
      });
    });
  }

  isConnected(): boolean {
    return this.connected;
  }
}
