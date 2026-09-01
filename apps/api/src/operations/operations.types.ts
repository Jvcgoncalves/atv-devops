export interface OperationsSnapshot {
  startedAt: string;
  telemetry: {
    received: number;
    persisted: number;
    duplicates: number;
    rejected: number;
    lastReceivedAt: string | null;
    lastPersistedAt: string | null;
  };
  alerts: {
    created: number;
    errors: number;
    lastCreatedAt: string | null;
    lastErrorAt: string | null;
  };
  mqtt: {
    enabled: boolean;
    connected: boolean;
    reconnects: number;
    messages: number;
    errors: number;
    lastConnectedAt: string | null;
    lastDisconnectedAt: string | null;
    lastError: string | null;
  };
  database: {
    errors: number;
    lastErrorAt: string | null;
    lastError: string | null;
  };
}

export interface ReadinessResponse {
  ok: boolean;
  ts: string;
  checks: {
    database: "ok" | "error";
    mqtt: "ok" | "disabled" | "error";
  };
  metrics: OperationsSnapshot;
}

export interface HealthResponseWriter {
  statusCode: number;
}
