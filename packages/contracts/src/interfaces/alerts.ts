import type { AlertLevel, AlertType } from "../types/common.ts";

export interface Alert {
  id: string;
  level: AlertLevel;
  tipo: AlertType;
  mensagem: string;
  salaId: string | null;
  ts: string;
  reconhecido: boolean;
  key?: string;
}

export interface AlertEventData {
  alert: Alert;
  roomId: string | null;
}
