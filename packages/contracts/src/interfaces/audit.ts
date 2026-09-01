import type { AuditCategory, EventSource } from "../types/common.ts";

export interface AuditEvent {
  id: string | number;
  ts: string;
  categoria: AuditCategory;
  descricao: string;
  salaId: string | null;
  origem: EventSource;
}
