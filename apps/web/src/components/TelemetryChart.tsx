import { useEffect, useRef, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { api } from "../api/client.ts";
import { appendRealtimePoint, chartTime } from "../api/telemetry-chart-state.ts";
import { palette } from "../theme.ts";
import type { ChartPoint, TelemetryChartProps, TelemetryRealtimeEvent } from "../types/ui.ts";
import type { Metric } from "@hvac/contracts";

const METRICS: Array<{ key: Metric; label: string }> = [
  { key: "temperatura", label: "Temperatura (°C)" },
  { key: "umidade", label: "Umidade (%)" },
  { key: "co2", label: "CO₂ (ppm)" },
];

const ROOM_COLORS = [palette.primary, palette.secondary, palette.success, "#8e6fcf"];

export default function TelemetryChart({ salas, thresholds, lastTelemetryEvent }: TelemetryChartProps) {
  const [metric, setMetric] = useState<Metric>("temperatura");
  const [roomFilter, setRoomFilter] = useState<string>("todas"); // "todas" | salaId
  const [data, setData] = useState<ChartPoint[]>([]);
  const canMeasureContainer = typeof window !== "undefined" && typeof document !== "undefined";
  const loadedRef = useRef(false);
  const pendingEventsRef = useRef<TelemetryRealtimeEvent[]>([]);
  const lastEventVersionRef = useRef(lastTelemetryEvent?.envelope.version ?? 0);

  const visiveis = roomFilter === "todas" ? salas : salas.filter((s) => s.id === roomFilter);
  const visibleRooms = visiveis.map(({ id, nome }) => ({ id, nome }));
  const visibleRoomIds = visibleRooms.map((room) => room.id).join("|");

  useEffect(() => {
    let active = true;
    loadedRef.current = false;
    pendingEventsRef.current = [];

    async function load() {
      const series = await Promise.all(visibleRooms.map((s) => api.getHistory(s.id, metric)));
      const len = Math.max(0, ...series.map((s) => s.length));
      const merged: ChartPoint[] = [];
      for (let i = 0; i < len; i++) {
        const point: ChartPoint = {
          t: series[0]?.[i]?.t
            ? new Date(series[0][i].t).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
            : i,
        };
        visibleRooms.forEach((s, idx) => {
          point[s.nome] = series[idx]?.[i]?.value ?? null;
        });
        merged.push(point);
      }

      const withPendingEvents = pendingEventsRef.current.reduce((points, event) => {
        const room = visibleRooms.find((item) => item.id === event.envelope.data.roomId);
        return room ? appendRealtimePoint(points, event, room.nome, metric) : points;
      }, merged);

      if (!active) return;
      setData(withPendingEvents);
      loadedRef.current = true;
    }
    void load();

    return () => {
      active = false;
    };
  }, [metric, visibleRoomIds]);

  useEffect(() => {
    if (!lastTelemetryEvent) return;
    const version = lastTelemetryEvent.envelope.version;
    if (version <= lastEventVersionRef.current) return;
    lastEventVersionRef.current = version;

    const room = visibleRooms.find((item) => item.id === lastTelemetryEvent.envelope.data.roomId);
    if (!room) return;
    if (!loadedRef.current) {
      pendingEventsRef.current.push(lastTelemetryEvent);
      return;
    }

    setData((points) => appendRealtimePoint(points, lastTelemetryEvent, room.nome, metric));
  }, [lastTelemetryEvent, metric, visibleRoomIds]);

  // Linhas de limite so aparecem quando uma unica sala esta selecionada
  // (cada sala tem suas proprias faixas).
  const refs = [];
  if (roomFilter !== "todas" && thresholds && thresholds[roomFilter]) {
    const t = thresholds[roomFilter];
    if (metric === "temperatura") {
      refs.push({ y: t.temperatura.min, label: "limite" }, { y: t.temperatura.max, label: "limite" });
    } else if (metric === "umidade") {
      refs.push({ y: t.umidade.min, label: "limite" }, { y: t.umidade.max, label: "limite" });
    } else {
      refs.push({ y: t.co2.warn, label: "atencao" }, { y: t.co2.critical, label: "critico" });
    }
  }

  return (
    <div className="card">
      <div className="row-between" style={{ marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
        <h3 className="card__title" style={{ margin: 0 }}>
          Histórico de Telemetria
        </h3>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {METRICS.map((m) => (
            <button
              key={m.key}
              className={`btn ${metric === m.key ? "btn--primary" : "btn--ghost"}`}
              style={{ padding: "6px 12px", fontSize: 13 }}
              onClick={() => setMetric(m.key)}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Filtro de sala */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
        <button
          className={`btn ${roomFilter === "todas" ? "btn--primary" : "btn--ghost"}`}
          style={{ padding: "5px 11px", fontSize: 12 }}
          onClick={() => setRoomFilter("todas")}
        >
          Todas
        </button>
        {salas.map((s) => (
          <button
            key={s.id}
            className={`btn ${roomFilter === s.id ? "btn--primary" : "btn--ghost"}`}
            style={{ padding: "5px 11px", fontSize: 12 }}
            onClick={() => setRoomFilter(s.id)}
          >
            {s.nome}
          </button>
        ))}
      </div>

      {canMeasureContainer ? (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data} margin={{ top: 6, right: 16, bottom: 0, left: -8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eef2f6" />
            <XAxis dataKey="t" tick={{ fontSize: 11, fill: palette.text }} minTickGap={40} />
            <YAxis tick={{ fontSize: 11, fill: palette.text }} domain={["auto", "auto"]} />
            <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 13 }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {refs.map((r, i) => (
              <ReferenceLine
                key={i}
                y={r.y}
                stroke={r.label === "critico" ? palette.critical : r.label === "atencao" ? palette.warning : "#94a3b8"}
                strokeDasharray="5 4"
                strokeWidth={1.4}
              />
            ))}
            {visiveis.map((s, idx) => (
              <Line
                key={s.id}
                type="monotone"
                dataKey={s.nome}
                stroke={ROOM_COLORS[salas.findIndex((x) => x.id === s.id) % ROOM_COLORS.length]}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div style={{ height: 300 }} aria-label="Gráfico indisponível fora do navegador" />
      )}
    </div>
  );
}
