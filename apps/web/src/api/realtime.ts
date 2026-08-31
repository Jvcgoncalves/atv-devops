import { io } from "socket.io-client";
import type { Socket } from "socket.io-client";
import type { EventName, RealtimeEvent } from "@hvac/contracts";
import type { RealtimeClient, RealtimeConnectionState } from "../types/ui.ts";

const EVENT_NAMES: EventName[] = ["system.snapshot", "telemetry.updated", "alert.created", "alert.updated", "device.status.changed"];
const REALTIME_URL = import.meta.env?.VITE_REALTIME_URL?.trim() || "/realtime";
const REALTIME_TOKEN = import.meta.env?.VITE_REALTIME_AUTH_TOKEN?.trim();

export function createRealtimeClient(): RealtimeClient {
  const socket: Socket = io(REALTIME_URL, {
    autoConnect: false,
    auth: REALTIME_TOKEN ? { token: REALTIME_TOKEN } : undefined,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
  });
  const listeners = new Set<(event: RealtimeEvent) => void>();
  const connectionListeners = new Set<(state: RealtimeConnectionState) => void>();
  const connection: RealtimeConnectionState = { connected: false, connecting: true, error: null, url: REALTIME_URL };

  const emitConnection = (): void => connectionListeners.forEach((listener) => listener({ ...connection }));

  socket.on("connect", () => {
    connection.connected = true;
    connection.connecting = false;
    connection.error = null;
    emitConnection();
  });
  socket.on("disconnect", () => {
    connection.connected = false;
    connection.connecting = true;
    emitConnection();
  });
  socket.on("connect_error", (error: Error) => {
    connection.connected = false;
    connection.connecting = false;
    connection.error = error.message;
    emitConnection();
  });

  for (const name of EVENT_NAMES) {
    socket.on(name, (envelope: unknown) => {
      if (!envelope || typeof envelope !== "object") return;
      listeners.forEach((listener) => listener({ name, envelope } as RealtimeEvent));
    });
  }

  socket.connect();

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    subscribeConnection(listener) {
      connectionListeners.add(listener);
      listener({ ...connection });
      return () => connectionListeners.delete(listener);
    },
    disconnect() {
      socket.disconnect();
    },
  };
}
