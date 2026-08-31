import mqtt from "mqtt";
import type { MqttClient } from "mqtt";
import type { MqttLiveClient, MqttLiveData, MqttLiveState } from "../types/ui.ts";

export const DEFAULT_URL = "wss://broker.hivemq.com:8884/mqtt";
// IMPORTANTE: use um topico UNICO seu (o broker publico e compartilhado).
// Deve ser igual ao "mqtt_topic" configurado no sketch do ESP32.
export const DEFAULT_TOPIC = "tcc-hvac-kaue/airquality";

export function createMqttLive({ url = DEFAULT_URL, topic = DEFAULT_TOPIC }: { url?: string; topic?: string } = {}): MqttLiveClient {
  let client: MqttClient | null = null;
  const listeners = new Set<(state: MqttLiveState) => void>();
  const state: MqttLiveState = { connected: false, connecting: true, lastData: null, lastTs: null, error: null, url, topic };

  const emit = (): void => listeners.forEach((fn) => fn({ ...state }));

  function connect(): void {
    // clientId aleatorio: evita conflito com outros clientes no broker publico
    const clientId = "tcc-dash-" + Math.random().toString(16).slice(2, 10);
    const mqttClient = mqtt.connect(url, { clientId, reconnectPeriod: 3000, connectTimeout: 8000, clean: true });
    client = mqttClient;

    mqttClient.on("connect", () => {
      state.connected = true;
      state.connecting = false;
      state.error = null;
      mqttClient.subscribe(topic, (err) => {
        if (err) state.error = "Falha ao assinar o topico: " + err.message;
        emit();
      });
      emit();
    });
    mqttClient.on("reconnect", () => {
      state.connecting = true;
      emit();
    });
    mqttClient.on("close", () => {
      state.connected = false;
      emit();
    });
    mqttClient.on("error", (e) => {
      state.error = e?.message || String(e);
      emit();
    });
    mqttClient.on("message", (_topic, payload) => {
      try {
        const d = JSON.parse(payload.toString()) as MqttLiveData;
        // mescla (o ESP as vezes publica so o status) para nao perder leituras
        state.lastData = { ...(state.lastData || {}), ...d };
        state.lastTs = new Date().toISOString();
        emit();
      } catch {
        /* payload nao-JSON ignorado */
      }
    });
  }

  connect();

  return {
    subscribe(fn: (nextState: MqttLiveState) => void): () => void {
      listeners.add(fn);
      fn({ ...state });
      return () => listeners.delete(fn);
    },
    disconnect() {
      try {
        client?.end(true);
      } catch {
        /* ignore */
      }
    },
  };
}
