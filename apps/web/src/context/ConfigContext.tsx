import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { api } from "../api/client.ts";
import { createRealtimeClient } from "../api/realtime.ts";
import { applyRealtimeEvent } from "../api/realtime-state.ts";
import type { ConfigContextValue, LiveConfig, LiveStatus, RealtimeClient, RealtimeUiState, TelemetryRealtimeEvent } from "../types/ui.ts";
import type { ReactNode } from "react";
import type { Alert, Bathroom, Climatizer, ExhaustState, Room, RoomThresholds, SetClimatizerRequest, SystemState, ThresholdsMap, VavMode } from "@hvac/contracts";

export const ConfigContext = createContext<ConfigContextValue | null>(null);

const POLL_MS = 3000;
const REALTIME_URL = import.meta.env?.VITE_REALTIME_URL?.trim() || "/realtime";
const REALTIME_EVENT = "telemetry.updated";

export function ConfigProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SystemState | null>(null); // estado completo do sistema
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [lastTelemetryEvent, setLastTelemetryEvent] = useState<TelemetryRealtimeEvent | null>(null);
  const [thresholds, setThresholds] = useState<ThresholdsMap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);
  const selectedRoomRef = useRef("sala-1");
  const realtimeRef = useRef<RealtimeClient | null>(null);
  const realtimeStateRef = useRef<RealtimeUiState>({ state: null, alerts: [], liveData: null, liveTs: null, version: 0 });

  // ----- telemetria ao vivo via Nest Socket.IO -----
  const [liveConfig, setLiveConfigState] = useState<LiveConfig>({
    enabled: false,
    salaAlvo: "sala-1",
  });
  const [liveStatus, setLiveStatus] = useState<LiveStatus>({ connected: false, connecting: false, lastData: null, lastTs: null, error: null, url: REALTIME_URL, topic: REALTIME_EVENT });

  const commitSnapshot = useCallback((nextState: SystemState, nextAlerts: Alert[]) => {
    realtimeStateRef.current = { ...realtimeStateRef.current, state: nextState, alerts: nextAlerts };
    setState(nextState);
    setAlerts(nextAlerts);
  }, []);

  const commitStateUpdate = useCallback((update: (current: SystemState) => SystemState) => {
    const current = realtimeStateRef.current.state;
    if (!current) return;
    const next = update(current);
    realtimeStateRef.current = { ...realtimeStateRef.current, state: next };
    setState(next);
  }, []);

  const commitRoom = useCallback((room: Room | undefined) => {
    if (!room) return;
    commitStateUpdate((current) => ({
      ...current,
      salas: current.salas.map((item) => item.id === room.id ? room : item),
    }));
  }, [commitStateUpdate]);

  const commitClimatizer = useCallback((climatizer: Climatizer | undefined) => {
    if (!climatizer) return;
    commitStateUpdate((current) => ({
      ...current,
      climatizadores: current.climatizadores.map((item) => item.id === climatizer.id ? climatizer : item),
    }));
  }, [commitStateUpdate]);

  const commitBathroomState = useCallback((next: { banheiros: Bathroom[]; exaustao: ExhaustState }) => {
    commitStateUpdate((current) => ({ ...current, banheiros: next.banheiros, exaustao: next.exaustao }));
  }, [commitStateUpdate]);

  const refresh = useCallback(async () => {
    try {
      const [s, a] = await Promise.all([api.getSystemState(), api.getAlerts()]);
      if (!mounted.current) return;
      commitSnapshot(s, a);
      setError(null);
    } catch (e) {
      if (mounted.current) setError(e instanceof Error ? e.message : String(e));
    }
  }, [commitSnapshot]);

  useEffect(() => {
    mounted.current = true;
    api.getThresholds().then(setThresholds).catch(() => {});
    refresh();
    const id = api.mode === "mock" ? setInterval(refresh, POLL_MS) : null;
    return () => {
      mounted.current = false;
      if (id) clearInterval(id);
    };
  }, [refresh]);

  useEffect(() => {
    selectedRoomRef.current = liveConfig.salaAlvo;
  }, [liveConfig.salaAlvo]);

  // Mock usa simulacao local. Real usa somente eventos publicados pelo Nest.
  useEffect(() => {
    if (api.mode !== "mock") return;
    const room = state?.salas.find((item) => item.id === liveConfig.salaAlvo);
    if (!liveConfig.enabled || !room) {
      setLiveStatus((current) => ({ ...current, connected: false, connecting: false, lastData: null, lastTs: null, error: null, url: "mock", topic: REALTIME_EVENT }));
      return;
    }
    setLiveStatus((current) => ({
      ...current,
      connected: true,
      connecting: false,
      lastData: { temperature: room.temperatura, humidity: room.umidade, co2: room.co2 },
      lastTs: room.ultimaLeitura,
      error: null,
      url: "mock",
      topic: REALTIME_EVENT,
    }));
  }, [liveConfig.enabled, liveConfig.salaAlvo, state]);

  useEffect(() => {
    if (api.mode === "mock") return;
    const client = createRealtimeClient();
    realtimeRef.current = client;
    const unsubscribeEvents = client.subscribe((event) => {
      const current = realtimeStateRef.current;
      const next = applyRealtimeEvent(current, event, selectedRoomRef.current);
      if (next === current) return;
      realtimeStateRef.current = next;
      setState(next.state);
      setAlerts(next.alerts);
      if (event.name === "telemetry.updated") setLastTelemetryEvent(event as TelemetryRealtimeEvent);
      setLiveStatus((live) => ({ ...live, lastData: next.liveData, lastTs: next.liveTs }));
    });
    const unsubscribeConnection = client.subscribeConnection((connection) => {
      setLiveStatus((live) => ({ ...live, connected: connection.connected, connecting: connection.connecting, error: connection.error, url: connection.url, topic: REALTIME_EVENT }));
    });
    return () => {
      unsubscribeEvents();
      unsubscribeConnection();
      client.disconnect();
      realtimeRef.current = null;
    };
  }, [refresh]);

  useEffect(() => {
    const room = state?.salas.find((item) => item.id === liveConfig.salaAlvo);
    if (!room || api.mode === "mock") return;
    setLiveStatus((current) => ({
      ...current,
      lastData: { temperature: room.temperatura, humidity: room.umidade, co2: room.co2 },
      lastTs: room.ultimaLeitura,
    }));
  }, [liveConfig.salaAlvo, state]);

  /*
   * No modo real, browser nunca assina MQTT nem reenvia leitura para API.
   * Nest e unico dono da ingestao; Socket.IO entrega eventos persistidos.
   */

  const setLiveConfig = useCallback((patch: Partial<LiveConfig>) => {
    setLiveConfigState((c) => ({ ...c, ...patch }));
  }, []);

  // ----- acoes -----
  const actions = {
    async saveThresholds(salaId: string, next: RoomThresholds) {
      const saved = await api.saveThresholds(salaId, next);
      setThresholds(saved);
      return saved;
    },
    async setVav(roomId: string, abertura: number) {
      const updated = await api.setVav(roomId, abertura) as Room | undefined;
      commitRoom(updated);
    },
    async setVavMode(roomId: string, modo: VavMode) {
      const updated = await api.setVavMode(roomId, modo) as Room | undefined;
      commitRoom(updated);
    },
    async setRoomSetpoint(roomId: string, setpoint: number) {
      const updated = await api.setRoomSetpoint(roomId, setpoint) as Room | undefined;
      commitRoom(updated);
    },
    async setVavFault(roomId: string, falha: boolean) {
      const updated = await api.setVavFault(roomId, falha) as Room | undefined;
      commitRoom(updated);
    },
    async setClimatizador(id: string, patch: SetClimatizerRequest) {
      const updated = await api.setClimatizador(id, patch) as Climatizer | undefined;
      commitClimatizer(updated);
    },
    async setBathroomLight(id: string, luz: boolean) {
      const updated = await api.setBathroomLight(id, luz) as { banheiros: Bathroom[]; exaustao: ExhaustState };
      commitBathroomState(updated);
    },
    async acknowledgeAlert(id: string) {
      const next = await api.acknowledgeAlert(id);
      realtimeStateRef.current = { ...realtimeStateRef.current, alerts: next };
      setAlerts(next);
    },
    async clearAcknowledged() {
      const next = await api.clearAcknowledged();
      realtimeStateRef.current = { ...realtimeStateRef.current, alerts: next };
      setAlerts(next);
    },
  };

  return (
    <ConfigContext.Provider
      value={{ state, alerts, lastTelemetryEvent, thresholds, error, mode: api.mode, refresh, liveConfig, liveStatus, setLiveConfig, ...actions }}
    >
      {children}
    </ConfigContext.Provider>
  );
}

export function useSystem() {
  const ctx = useContext(ConfigContext);
  if (!ctx) throw new Error("useSystem deve ser usado dentro de ConfigProvider");
  return ctx;
}
