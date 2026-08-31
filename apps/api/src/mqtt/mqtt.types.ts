export interface MqttMessage {
  topic: string;
  payload: Buffer;
  messageId?: number;
}

export type MqttMessageListener = (message: MqttMessage) => void;
