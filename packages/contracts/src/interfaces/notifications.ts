import type { AlertLevel } from "../types/common.ts";

export interface NtfyConfig {
  enabled: boolean;
  server: string;
  topic: string;
  minLevel: "atencao" | "critico";
}

export interface NtfyLogEntry {
  id: string;
  ts: string;
  url: string;
  priority: "urgent" | "high";
  title: string;
  message: string;
  tags: string[];
}

export interface Identification {
  estabelecimento: string;
  cnes: string;
  sistema: string;
  responsavelTecnico: string;
  registro: string;
}

export interface NotificationHeaders {
  Title: string;
  Priority: "urgent" | "high";
  Tags: string;
  level?: AlertLevel;
}
