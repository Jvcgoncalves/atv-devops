import type { AlertUpdatedEventData, RealtimeEvent, SystemSnapshotEventData, TelemetryUpdatedEventData } from "@hvac/contracts";
import type { RealtimeUiState } from "../types/ui.ts";

function replaceAlert(alerts: RealtimeUiState["alerts"], next: RealtimeUiState["alerts"][number]): RealtimeUiState["alerts"] {
  const withoutCurrent = alerts.filter((item) => item.id !== next.id);
  return [next, ...withoutCurrent];
}

export function applyRealtimeEvent(current: RealtimeUiState, event: RealtimeEvent, liveRoomId: string): RealtimeUiState {
  const version = event.envelope.version;
  if (!Number.isInteger(version) || version <= current.version) return current;

  if (event.name === "system.snapshot") {
    const data = event.envelope.data as SystemSnapshotEventData;
    return { ...current, state: data.state, version };
  }

  if (event.name === "telemetry.updated") {
    const data = event.envelope.data as TelemetryUpdatedEventData;
    const nextState = current.state
      ? {
          ...current.state,
          timestamp: data.timestamp,
          salas: current.state.salas.map((room) =>
            room.id === data.roomId
              ? { ...room, temperatura: data.temperature, umidade: data.humidity, co2: data.co2, fonte: data.source, ultimaLeitura: data.timestamp, status: data.status }
              : room,
          ),
        }
      : current.state;
    const nextLiveData = data.roomId === liveRoomId
      ? { ...(current.liveData ?? {}), temperature: data.temperature, humidity: data.humidity, co2: data.co2 }
      : current.liveData;
    const nextLiveTs = data.roomId === liveRoomId ? data.timestamp : current.liveTs;
    return { ...current, state: nextState, liveData: nextLiveData, liveTs: nextLiveTs, version };
  }

  if (event.name === "alert.created") {
    return { ...current, alerts: replaceAlert(current.alerts, (event.envelope.data as { alert: RealtimeUiState["alerts"][number] }).alert), version };
  }

  if (event.name === "alert.updated") {
    const { alert, action } = event.envelope.data as AlertUpdatedEventData;
    return { ...current, alerts: action === "removed" ? current.alerts.filter((item) => item.id !== alert.id) : replaceAlert(current.alerts, alert), version };
  }

  if (event.name === "device.status.changed") {
    return {
      ...current,
      state: current.state
        ? { ...current.state, conexao: { ...current.state.conexao, online: (event.envelope.data as { online: boolean }).online, fonte: "MQTT" } }
        : current.state,
      version,
    };
  }

  return { ...current, version };
}
