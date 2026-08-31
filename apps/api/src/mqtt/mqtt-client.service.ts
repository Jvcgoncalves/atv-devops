import { Injectable, Logger } from "@nestjs/common";
import mqtt from "mqtt";
import type { MqttClient } from "mqtt";
import type { MqttMessageListener } from "./mqtt.types.js";

@Injectable()
export class MqttClientService {
  private readonly logger = new Logger(MqttClientService.name);
  private client: MqttClient | null = null;
  private connected = false;
  private readonly listeners = new Set<MqttMessageListener>();

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
      this.logger.log(`MQTT connected; subscribing ${topics.join(", ")}`);
      this.client?.subscribe(topics, (error) => {
        if (error) this.logger.error(`MQTT subscribe failed: ${error.message}`);
      });
    });
    this.client.on("close", () => { this.connected = false; });
    this.client.on("offline", () => { this.connected = false; });
    this.client.on("error", (error) => this.logger.error(`MQTT error: ${error.message}`));
    this.client.on("message", (topicName, payload, packet) => {
      for (const listener of this.listeners) listener({ topic: topicName, payload, messageId: packet.messageId });
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
    if (!this.client || !this.connected) return false;
    return new Promise((resolve) => {
      this.client?.publish(topic, JSON.stringify(payload), { qos: 1 }, (error) => {
        if (error) this.logger.error(`MQTT publish failed: ${error.message}`);
        resolve(!error);
      });
    });
  }

  isConnected(): boolean {
    return this.connected;
  }
}
