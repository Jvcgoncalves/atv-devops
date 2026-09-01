export interface MqttMessage {
  topic: string;
  payload: Buffer;
  messageId?: number;
  qos?: 0 | 1 | 2;
  retain?: boolean;
  dup?: boolean;
}

export type MqttMessageListener = (message: MqttMessage) => void;
