// ---------------------------------------------------------------------------
// Ponte MQTT: assina o topico do ESP32 e grava as leituras nos sensores da sala.
// O backend (Node) fala MQTT/TCP direto (porta 1883) - diferente do navegador.
// ---------------------------------------------------------------------------

import mqtt from "mqtt";
import type { MqttClient } from "mqtt";
import { db } from "./db.ts";
import { inserirLeitura } from "./logic.ts";
import { mapMqttPayloadToTelemetry } from "@hvac/domain";
import type { SensorRow } from "./types.ts";

const MQTT_URL = process.env.MQTT_URL || "mqtt://broker.hivemq.com:1883";
const MQTT_TOPIC = process.env.MQTT_TOPIC || "tcc-hvac-kaue/airquality";
const SALA_ID = Number(process.env.SALA_ID || 1); // fallback durante transicao do topico legado

export function startMqtt(): MqttClient {
  const client = mqtt.connect(MQTT_URL);

  client.on("connect", () => {
    console.log(`MQTT conectado (${MQTT_URL}), assinando "${MQTT_TOPIC}" -> Sala ${SALA_ID}`);
    client.subscribe(MQTT_TOPIC, (err) => err && console.error("Falha ao assinar:", err.message));
  });
  client.on("error", (e) => console.error("MQTT erro:", e.message));

  client.on("message", (topic, payload) => {
    const reading = mapMqttPayloadToTelemetry({ topic, payload, defaultRoomId: SALA_ID });
    if (!reading) return;
    const roomId = Number(reading.salaId.replace("sala-", ""));
    for (const [tipo, valor] of Object.entries({
      temperatura: reading.temperatura,
      umidade: reading.umidade,
      co2: reading.co2,
    })) {
      if (valor == null) continue;
      const sensor = db.prepare("SELECT * FROM SENSOR WHERE id_sala = ? AND tipo = ?").get(roomId, tipo) as SensorRow | undefined;
      if (sensor) inserirLeitura({ id_sensor: sensor.id_sensor, valor });
    }
  });

  return client;
}
