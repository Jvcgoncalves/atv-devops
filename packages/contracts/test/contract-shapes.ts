import type {
  Alert,
  Room,
  SystemState,
  TelemetryInput,
  ThresholdsMap,
} from "../src/index.ts";

const telemetryInput: TelemetryInput = {
  salaId: "sala-1",
  temperatura: 22.6,
  umidade: 51,
  co2: 720,
};

const thresholds: ThresholdsMap = {
  "sala-1": {
    temperatura: { min: 20, max: 26, unit: "C" },
    umidade: { min: 40, max: 60, unit: "%" },
    co2: { warn: 800, critical: 1000, unit: "ppm" },
  },
};

const alert: Alert = {
  id: "alt-1",
  level: "critico",
  tipo: "temperatura",
  mensagem: "Sala 1 fora da faixa",
  salaId: "sala-1",
  ts: new Date().toISOString(),
  reconhecido: false,
};

declare const room: Room;
declare const state: SystemState;

void telemetryInput;
void thresholds;
void alert;
void room;
void state;
