import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { api } from "../api/client.ts";
import { createMqttLive, DEFAULT_URL, DEFAULT_TOPIC } from "../api/mqttLive.ts";
import type { ConfigContextValue, LiveConfig, MqttLiveClient, MqttLiveState } from "../types/ui.ts";
import type { ReactNode } from "react";
import type { Alert, RoomThresholds, SetClimatizerRequest, SystemState, ThresholdsMap, VavMode } from "@hvac/contracts";

const ConfigContext = createContext<ConfigContextValue | null>(null);

const POLL_MS = 3000;

export function ConfigProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SystemState | null>(null); // estado completo do sistema
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [thresholds, setThresholds] = useState<ThresholdsMap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  // ----- ponte MQTT ao vivo (ESP32 -> uma sala) -----
  const [liveConfig, setLiveConfigState] = useState<LiveConfig>({
    enabled: false,
    url: DEFAULT_URL,
    topic: DEFAULT_TOPIC,
    salaAlvo: "sala-1",
  });
  const [liveStatus, setLiveStatus] = useState<MqttLiveState>({ connected: false, connecting: false, lastData: null, lastTs: null, error: null, url: DEFAULT_URL, topic: DEFAULT_TOPIC });
  const mqttRef = useRef<MqttLiveClient | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [s, a] = await Promise.all([api.getSystemState(), api.getAlerts()]);
      if (!mounted.current) return;
      setState(s);
      setAlerts(a);
      setError(null);
    } catch (e) {
      if (mounted.current) setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    api.getThresholds().then(setThresholds).catch(() => {});
    refresh();
    const id = setInterval(refresh, POLL_MS);
    return () => {
      mounted.current = false;
      clearInterval(id);
    };
  }, [refresh]);

  // Ponte MQTT: quando habilitada, assina o broker e injeta as leituras do ESP
  // na sala-alvo (que passa a NAO ser simulada). Reconecta quando a config muda.
  useEffect(() => {
    mqttRef.current?.disconnect();
    mqttRef.current = null;

    if (!liveConfig.enabled) {
      api.setFonteExterna(null).then(refresh).catch(() => {});
      setLiveStatus({ connected: false, connecting: false, lastData: null, lastTs: null, error: null, url: liveConfig.url, topic: liveConfig.topic });
      return;
    }

    api.setFonteExterna(liveConfig.salaAlvo).then(refresh).catch(() => {});
    const client = createMqttLive({ url: liveConfig.url, topic: liveConfig.topic });
    mqttRef.current = client;
    const unsub = client.subscribe((s) => {
      setLiveStatus(s);
      if (s.lastData) {
        const d = s.lastData;
        api
          .ingestTelemetry({ salaId: liveConfig.salaAlvo, temperatura: d.temperature, umidade: d.humidity, co2: d.co2 })
          .then(refresh)
          .catch(() => {});
      }
    });
    return () => {
      unsub();
      client.disconnect();
    };
  }, [liveConfig, refresh]);

  const setLiveConfig = useCallback((patch: Partial<LiveConfig>) => {
    setLiveConfigState((c) => ({ ...c, ...patch }));
  }, []);

  // ----- acoes -----
  const actions = {
    async saveThresholds(salaId: string, next: RoomThresholds) {
      const saved = await api.saveThresholds(salaId, next);
      setThresholds(saved);
      refresh();
      return saved;
    },
    async setVav(roomId: string, abertura: number) {
      await api.setVav(roomId, abertura);
      refresh();
    },
    async setVavMode(roomId: string, modo: VavMode) {
      await api.setVavMode(roomId, modo);
      refresh();
    },
    async setRoomSetpoint(roomId: string, setpoint: number) {
      await api.setRoomSetpoint(roomId, setpoint);
      refresh();
    },
    async setVavFault(roomId: string, falha: boolean) {
      await api.setVavFault(roomId, falha);
      refresh();
    },
    async setClimatizador(id: string, patch: SetClimatizerRequest) {
      await api.setClimatizador(id, patch);
      refresh();
    },
    async setBathroomLight(id: string, luz: boolean) {
      await api.setBathroomLight(id, luz);
      refresh();
    },
    async acknowledgeAlert(id: string) {
      const next = await api.acknowledgeAlert(id);
      setAlerts(next);
    },
    async clearAcknowledged() {
      const next = await api.clearAcknowledged();
      setAlerts(next);
    },
  };

  return (
    <ConfigContext.Provider
      value={{ state, alerts, thresholds, error, mode: api.mode, refresh, liveConfig, liveStatus, setLiveConfig, ...actions }}
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
