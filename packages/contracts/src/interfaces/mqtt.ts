export interface MqttVavStatePayload {
  abertura: number;
  estado: "ok" | "falha";
}

export interface MqttVavCommand {
  abertura: number;
}

export interface MqttBathroomLightPayload {
  luz: boolean;
}

export interface MqttDeviceStatusPayload {
  online: boolean;
}

export interface MqttClimatizerCommand {
  ligado: boolean;
  setpoint?: number;
  tempInsuflamento?: number;
}
