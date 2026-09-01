export type Status = "normal" | "atencao" | "critico";

export type Metric = "temperatura" | "umidade" | "co2";

export type AlertLevel = "info" | "atencao" | "critico";

export type AlertType = "temperatura" | "umidade" | "co2" | "vav" | "incendio";

export type VavMode = "auto" | "manual";

export type VavStatus = "ok" | "falha";

export type VavReason = "estavel" | "resfriamento" | "ventilacao" | "manual" | "sem_frio";

export type TelemetrySource = "MQTT" | "REST" | "MOCK" | "ESP32";

export type EventSource = "sistema" | "operador" | "dispositivo";

export type AuditCategory =
  | "alerta"
  | "reconhecimento"
  | "parametro"
  | "setpoint"
  | "vav"
  | "climatizador"
  | "exaustao"
  | "registro";

export type EventName =
  | "telemetry.updated"
  | "alert.created"
  | "alert.updated"
  | "device.status.changed"
  | "system.snapshot";
