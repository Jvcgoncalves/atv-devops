import { useSystem } from "../context/ConfigContext.tsx";
import { STATUS, statusColor, statusLabel } from "../theme.ts";
import type { LiveTelemetryData } from "../types/ui.ts";
import type { Status } from "@hvac/contracts";

// Faixas de referencia (padrao hospitalar) para colorir as leituras ao vivo.
const REF = {
  temperatura: { min: 20, max: 26 },
  umidade: { min: 40, max: 60 },
  co2: { warn: 800, critical: 1000 },
};

function stFaixa(v: number | undefined, min: number, max: number, margem: number): Status | null {
  if (v == null || Number.isNaN(v)) return null;
  if (v < min || v > max) return STATUS.CRITICO;
  if (v < min + margem || v > max - margem) return STATUS.ATENCAO;
  return STATUS.NORMAL;
}
function stCo2(v: number | undefined): Status | null {
  if (v == null) return null;
  if (v >= REF.co2.critical) return STATUS.CRITICO;
  if (v >= REF.co2.warn) return STATUS.ATENCAO;
  return STATUS.NORMAL;
}

function Card({ label, icon, value, unit, status = null, digits = 1, destaque }: { label: string; icon: string; value?: number; unit: string; status?: Status | null; digits?: number; destaque?: boolean }) {
  const has = value != null && !Number.isNaN(value);
  return (
    <div className="stat" style={{ borderTop: `3px solid ${status ? statusColor[status] : "var(--color-border)"}` }}>
      <div className="stat__label">
        {icon} {label}
      </div>
      <div className="stat__value" style={{ color: status ? statusColor[status] : "var(--color-text)", fontSize: destaque ? 32 : 26 }}>
        {has ? Number(value).toFixed(digits) : "--"}
        <span style={{ fontSize: 14, fontWeight: 500, color: "var(--color-text-muted)" }}> {unit}</span>
      </div>
      {status && has && <div style={{ fontSize: 12, fontWeight: 700, marginTop: 4, color: statusColor[status] }}>{statusLabel[status]}</div>}
    </div>
  );
}

export default function SensorAoVivoPage() {
  const { state, liveConfig, liveStatus, setLiveConfig } = useSystem();
  const salas = state?.salas || [];
  const salaNome = salas.find((s) => s.id === liveConfig.salaAlvo)?.nome || liveConfig.salaAlvo;

  const d: LiveTelemetryData = liveStatus.lastData || {};

  return (
    <>
      {/* Conexao e destino */}
      <div className="card" style={{ marginBottom: 18 }}>
        <div className="row-between" style={{ flexWrap: "wrap", gap: 8 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>Sensor ao vivo — ESP32 (via API)</div>
            <div className="muted" style={{ fontSize: 13 }}>
              Nest recebe MQTT, persiste a leitura e envia atualizações ao navegador por WebSocket.
            </div>
          </div>
          <span className={`conn-dot ${liveStatus.connected ? "" : "offline"}`}>
            {liveConfig.enabled ? (liveStatus.connected ? "Conectado" : liveStatus.connecting ? "Conectando…" : "Desconectado") : "Desligado"}
          </span>
        </div>

        <div className="form-row" style={{ gridTemplateColumns: "1fr 1fr", marginTop: 6 }}>
          <div className="field">
            <label>Mostrar telemetria ao vivo</label>
            <select value={liveConfig.enabled ? "1" : "0"} onChange={(e) => setLiveConfig({ enabled: e.target.value === "1" })}>
              <option value="0">Ocultar</option>
              <option value="1">Exibir</option>
            </select>
          </div>
          <div className="field">
            <label>Mostrar os dados na sala</label>
            <select value={liveConfig.salaAlvo} onChange={(e) => setLiveConfig({ salaAlvo: e.target.value })}>
              {salas.map((s) => (
                <option key={s.id} value={s.id}>{s.nome}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-row" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <div className="field">
            <label>Transporte ao vivo</label>
            <input value={`Socket.IO ${liveStatus.url}`} readOnly />
          </div>
          <div className="field">
            <label>Evento recebido</label>
            <input value={liveStatus.topic} readOnly />
          </div>
        </div>

        <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
          Última atualização: {liveStatus.lastTs ? new Date(liveStatus.lastTs).toLocaleTimeString("pt-BR") : "—"}
          {liveConfig.enabled && (
            <>
              {" · "}os valores abaixo aparecem em <strong>{salaNome}</strong> no Dashboard (com selo <em>AO VIVO</em>).
            </>
          )}
        </div>
        {liveStatus.error && (
          <div className="banner" style={{ marginTop: 12, marginBottom: 0 }}>
            <span>⚠️</span>
            <span>{liveStatus.error}</span>
          </div>
        )}
      </div>

      {!liveConfig.enabled ? (
        <div className="empty">Visualização ao vivo ocultada. Ative acima para acompanhar uma sala.</div>
      ) : !liveStatus.lastData ? (
        <div className="empty">
          Aguardando a primeira telemetria do backend…
          <br />
          Verifique se API Nest e MQTT estão conectados.
        </div>
      ) : (
        <>
          <div className="section-title">DHT22 e CO₂ (indo para {salaNome})</div>
          <div className="stat-row">
            <Card label="Temperatura (DHT22)" icon="🌡️" value={d.temperature} unit="°C" status={stFaixa(d.temperature, REF.temperatura.min, REF.temperatura.max, 1)} destaque />
            <Card label="Umidade (DHT22)" icon="💧" value={d.humidity} unit="%" digits={0} status={stFaixa(d.humidity, REF.umidade.min, REF.umidade.max, 5)} destaque />
            <Card label="CO₂ (MQ-135)" icon="🫁" value={d.co2} unit="ppm" digits={0} status={stCo2(d.co2)} destaque />
          </div>

          <div className="section-title">Outras leituras do ESP</div>
          <div className="stat-row">
            <Card label="CO (MQ-7)" icon="💨" value={d.co} unit="ppm" digits={0} />
            <Card label="PM2.5 (MQ-2)" icon="🌫️" value={d.pm25} unit="µg/m³" digits={0} />
            <div className="stat">
              <div className="stat__label">Status do ESP</div>
              <div className="stat__value" style={{ fontSize: 20, color: d.status === 2 ? "var(--color-critical)" : d.status === 1 ? "var(--color-warning)" : "var(--color-success)" }}>
                {d.override ? "OVERRIDE" : d.status === 2 ? "PERIGO" : d.status === 1 ? "ALERTA" : "NORMAL"}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
