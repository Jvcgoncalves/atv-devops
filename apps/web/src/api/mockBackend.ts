import {
  calculateExhaustState,
  calculateNextVavOpening,
  calculateRoomStatus,
  calculateVavTarget,
  evaluateRoomAlerts,
  getDefaultThresholds,
} from "@hvac/domain";
import type {
  MockApi,
  SimulatedRoom,
  RoomStatus,
  HistoryState,
} from "../types/ui.ts";
import type {
  Alert,
  AlertLevel,
  AlertType,
  AuditCategory,
  AuditEvent,
  Bathroom,
  Climatizer,
  EventSource,
  Identification,
  Metric,
  NtfyConfig,
  NtfyLogEntry,
  RoomThresholds,
  SaveThresholdsRequest,
  SystemState,
  TelemetryInput,
  ThresholdsMap,
  VavMode,
} from "@hvac/contracts";

const HISTORY_POINTS = 60; // ~ ultimos pontos por sala/metrica
const TICK_MS = 3000;


const TEMP_AMBIENTE = 29;
const EFICIENCIA = 0.95;


const defaultThresholds = getDefaultThresholds;
// thresholds[salaId] = { temperatura, umidade, co2 }
let thresholds: ThresholdsMap = {};

let ntfyConfig: NtfyConfig = {
  enabled: true,
  server: "https://ntfy.sh",
  topic: "tcc-hvac-alertas",
  minLevel: "atencao", // atencao | critico
};

let identificacao: Identification = {
  estabelecimento: "",
  cnes: "",
  sistema: "Sistema de Automacao HVAC",
  responsavelTecnico: "",
  registro: "", // CREA/CFT + numero da ART/TRT
};

// ----- Topologia (4 salas, 2 climatizadores, 2 banheiros) ------------------
// Sistema VAV multizona: cada sala tem seu proprio SETPOINT e a caixa VAV modula
// a vazao de ar frio para atingi-lo. Uma unica unidade central (climatizador)
// insufla ar frio para as salas que atende.
const rooms: SimulatedRoom[] = [
  { id: "sala-1", nome: "Sala 1", climatizadorId: "clima-1", setpoint: 22 },
  { id: "sala-2", nome: "Sala 2", climatizadorId: "clima-1", setpoint: 23 },
  { id: "sala-3", nome: "Sala 3", climatizadorId: "clima-2", setpoint: 23 },
  { id: "sala-4", nome: "Sala 4", climatizadorId: "clima-2", setpoint: 24 },
].map((r) => ({
  ...r,
  temperatura: r.setpoint + (Math.random() - 0.3) * 2,
  umidade: 48 + Math.random() * 6,
  co2: 440 + Math.random() * 120,
  vav: { abertura: 40, estado: "ok", modo: "auto", motivo: "estavel" },
  ultimaLeitura: new Date().toISOString(),
}));

// Climatizador = unidade central de resfriamento (AHU). Insufla ar frio a
// "tempInsuflamento" (constante, ~13-16 C). Liga/desliga a producao de frio;
// quem regula a temperatura de cada sala e a VAV.
const climatizadores: Climatizer[] = [
  { id: "clima-1", nome: "Climatizador A", salas: ["sala-1", "sala-2"], ligado: true, tempInsuflamento: 15 },
  { id: "clima-2", nome: "Climatizador B", salas: ["sala-3", "sala-4"], ligado: true, tempInsuflamento: 15 },
];

const bathrooms: Bathroom[] = [
  { id: "ban-1", nome: "Banheiro 1", luz: false },
  { id: "ban-2", nome: "Banheiro 2", luz: false },
];

const history: HistoryState = {}; 
rooms.forEach((r) => {
  history[r.id] = { temperatura: [], umidade: [], co2: [] };
  thresholds[r.id] = defaultThresholds(); // cada sala comeca com a faixa padrao
});

let alerts: Alert[] = [];
let ntfyLog: NtfyLogEntry[] = [];
let alertSeq = 1;
const activeAlertKeys = new Set();

// ----- Log de auditoria (rastreabilidade - NBR 7256 / PMOC Lei 13.589/2018) -
// Registra alertas, acoes do operador, falhas e snapshots ambientais periodicos.
// No backend real, cada evento e persistido na tabela Supabase `audit_events`.
let eventos: AuditEvent[] = [];
let evSeq = 1;
let booted = false; // evita registrar eventos durante o pre-aquecimento
let snapCount = 0;
const SNAPSHOT_EVERY = 40; // registro ambiental periodico (~2 min com tick de 3s)

// Sala alimentada por FONTE EXTERNA (ESP32 real via MQTT); null = todas simuladas.
let externalRoom: string | null = null;

function logEvento(categoria: AuditCategory, descricao: string, opts: { salaId?: string | null; origem?: EventSource } = {}): void {
  if (!booted) return;
  eventos = [
    {
      id: `ev-${evSeq++}`,
      ts: new Date().toISOString(),
      categoria, // alerta | reconhecimento | parametro | setpoint | vav | climatizador | exaustao | registro
      descricao,
      salaId: opts.salaId || null,
      origem: opts.origem || "sistema", // sistema | operador
    },
    ...eventos,
  ].slice(0, 1000);
}

function nomeDaSala(salaId: string | null | undefined): string {
  return rooms.find((r) => r.id === salaId)?.nome || salaId || "-";
}

export function roomStatus(room: SimulatedRoom): RoomStatus {
  const t = thresholds[room.id] || defaultThresholds();
  return calculateRoomStatus(room, t);
}

// ----- Geracao de alertas + ntfy ------------------------------------------
function levelRank(level: AlertLevel): number {
  return level === "critico" ? 2 : level === "atencao" ? 1 : 0;
}

function pushAlert(level: AlertLevel, tipo: AlertType, mensagem: string, salaId: string | null): void {
  const key = `${salaId || "sys"}:${tipo}:${level}`;
  if (activeAlertKeys.has(key)) return; // ja existe alerta ativo identico
  activeAlertKeys.add(key);
  const alert = {
    id: `alt-${alertSeq++}`,
    level,
    tipo,
    mensagem,
    salaId: salaId || null,
    ts: new Date().toISOString(),
    reconhecido: false,
    key,
  };
  alerts = [alert, ...alerts].slice(0, 100);
  sendToNtfy(alert);
  logEvento("alerta", `[${level.toUpperCase()}] ${mensagem}`, { salaId, origem: "sistema" });
}

// Simula o POST que o backend faria para o ntfy.sh.
function sendToNtfy(alert: Alert): void {
  if (!ntfyConfig.enabled) return;
  if (levelRank(alert.level) < levelRank(ntfyConfig.minLevel)) return;
  const entry: NtfyLogEntry = {
    id: alert.id,
    ts: alert.ts,
    url: `${ntfyConfig.server}/${ntfyConfig.topic}`,
    priority: alert.level === "critico" ? "urgent" : "high",
    title: alert.level === "critico" ? "HVAC - ALARME CRITICO" : "HVAC - Atencao",
    message: alert.mensagem,
    tags: alert.level === "critico" ? ["rotating_light"] : ["warning"],
  };
  ntfyLog = [entry, ...ntfyLog].slice(0, 50);
  // No backend real:  POST https://ntfy.sh/<topic>  (body = message, headers Title/Priority/Tags)
}

function evaluateAlerts(): void {
  rooms.forEach((r) => {
    const candidates = evaluateRoomAlerts(r, thresholds[r.id] || defaultThresholds());
    for (const alert of candidates) pushAlert(alert.level, alert.tipo, alert.mensagem, alert.salaId);
    for (const type of ["temperatura", "umidade", "co2", "vav"]) {
      for (const level of ["critico", "atencao"]) {
        if (!candidates.some((alert) => alert.tipo === type && alert.level === level)) {
          clearAlertKey(`${r.id}:${type}:${level}`);
        }
      }
    }
  });
}

function clearAlertKey(key: string): void {
  activeAlertKeys.delete(key);
}

// ----- Loop de simulacao (substitui leituras vindas do Arduino via MQTT) ---
function drift(value: number, delta: number, lo: number, hi: number): number {
  let v = value + (Math.random() - 0.5) * delta;
  return Math.max(lo, Math.min(hi, v));
}

function tick(): void {
  const now = new Date().toISOString();
  rooms.forEach((r) => {
    const clima = climatizadores.find((c) => c.id === r.climatizadorId);

    // 1) A automacao ajusta a abertura da VAV (exceto em falha ou modo manual)
    if (r.vav.estado !== "falha" && r.vav.modo === "auto") {
      const { target, motivo } = calculateVavTarget(r, clima, thresholds[r.id] || defaultThresholds());
      // movimento suave do motor da VAV em direcao ao alvo
      r.vav.abertura = calculateNextVavOpening(r.vav.abertura, target);
      r.vav.motivo = motivo;
    }

    // 2) Fisica do ambiente. Salas com FONTE EXTERNA (ESP32 via MQTT) nao sao
    // simuladas: seus valores vem de ingestTelemetry(). As demais sao simuladas.
    if (r.id !== externalRoom) {
      // A sala tende a uma temperatura de equilibrio que depende da vazao de ar frio:
      //  - VAV fechada -> tende a TEMP_AMBIENTE; VAV 100% -> ~temperatura de insuflamento.
      // A sala nunca esfria abaixo do ar insuflado, por mais que a VAV abra.
      if (clima && clima.ligado) {
        const alvoFisico =
          clima.tempInsuflamento + (TEMP_AMBIENTE - clima.tempInsuflamento) * (1 - EFICIENCIA * (r.vav.abertura / 100));
        r.temperatura = drift(r.temperatura + (alvoFisico - r.temperatura) * 0.25, 0.08, 12, 40);
      } else {
        r.temperatura = drift(r.temperatura + (TEMP_AMBIENTE - r.temperatura) * 0.15, 0.12, 12, 40);
      }
      const umidAlvo = clima && clima.ligado ? 50 : 58;
      r.umidade = drift(r.umidade + (umidAlvo - r.umidade) * 0.08, 0.7, 25, 80);
      const co2Delta = 10 - (r.vav.abertura / 100) * 45;
      r.co2 = drift(r.co2 + co2Delta, 16, 420, 2000);
      r.ultimaLeitura = now;
    }

    pushHistory(r.id, "temperatura", r.temperatura);
    pushHistory(r.id, "umidade", r.umidade);
    pushHistory(r.id, "co2", r.co2);
  });
  evaluateAlerts();

  // Registro ambiental periodico (rastreabilidade continua)
  if (booted && ++snapCount >= SNAPSHOT_EVERY) {
    snapCount = 0;
    const resumo = rooms
      .map((r) => `${r.nome}: ${r.temperatura.toFixed(1)}°C / ${r.umidade.toFixed(0)}% / ${r.co2.toFixed(0)}ppm`)
      .join(" | ");
    logEvento("registro", `Registro ambiental — ${resumo}`, { origem: "sistema" });
  }
}

function pushHistory(roomId: string, metric: Metric, value: number): void {
  const arr = history[roomId][metric];
  arr.push({ t: new Date().toISOString(), value: Number(value.toFixed(1)) });
  if (arr.length > HISTORY_POINTS) arr.shift();
}

// pre-popula o historico para os graficos ja terem dados (sem registrar eventos)
for (let i = 0; i < HISTORY_POINTS; i++) tick();
booted = true; // a partir daqui os eventos passam a ser registrados
logEvento("registro", "Sistema de supervisao iniciado", { origem: "sistema" });

let timer: ReturnType<typeof setInterval> | null = null;
export function startSimulation() {
  if (timer) return;
  timer = setInterval(tick, TICK_MS);
}
export function stopSimulation() {
  if (timer) clearInterval(timer);
  timer = null;
}

// ---------------------------------------------------------------------------
// API publica do mock (espelha os endpoints REST do backend)
// ---------------------------------------------------------------------------
function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export const mock: MockApi = {
  getSystemState() {
    return clone({
      timestamp: new Date().toISOString(),
      conexao: { online: true, fonte: "MOCK" },
      salas: rooms.map((r) => ({ ...r, status: roomStatus(r), fonte: r.id === externalRoom ? "ESP32" : "MOCK" })),
      climatizadores,
      banheiros: bathrooms.map((b) => ({ ...b })),
      exaustao: calculateExhaustState(bathrooms),
    });
  },
  getHistory(roomId: string, metric: Metric) {
    return clone(history[roomId]?.[metric] || []);
  },
  // retorna o mapa completo { salaId: { temperatura, umidade, co2 } }
  getThresholds() {
    return clone(thresholds);
  },
  // atualiza as faixas de UMA sala
  saveThresholds(salaId: string, next: SaveThresholdsRequest) {
    if (!thresholds[salaId]) thresholds[salaId] = defaultThresholds();
    thresholds[salaId] = { ...thresholds[salaId], ...next } as RoomThresholds;
    activeAlertKeys.clear(); // reavalia com os novos limites
    evaluateAlerts();
    const t = thresholds[salaId];
    logEvento(
      "parametro",
      `Faixas de alerta de ${nomeDaSala(salaId)} alteradas — temp ${t.temperatura.min}-${t.temperatura.max}°C, umidade ${t.umidade.min}-${t.umidade.max}%, CO2 ${t.co2.warn}/${t.co2.critical}ppm`,
      { salaId, origem: "operador" }
    );
    return clone(thresholds);
  },
  getAlerts() {
    return clone(alerts);
  },
  acknowledgeAlert(id: string) {
    const alvo = alerts.find((a) => a.id === id);
    alerts = alerts.map((a) => (a.id === id ? { ...a, reconhecido: true } : a));
    if (alvo) logEvento("reconhecimento", `Alerta reconhecido: ${alvo.mensagem}`, { salaId: alvo.salaId, origem: "operador" });
    return clone(alerts);
  },
  clearAcknowledged() {
    alerts = alerts.filter((a) => !a.reconhecido);
    return clone(alerts);
  },
  // override manual da abertura (so tem efeito em modo manual)
  setVav(roomId: string, abertura: number) {
    const r = rooms.find((x) => x.id === roomId);
    if (r) {
      r.vav.modo = "manual";
      r.vav.abertura = Math.max(0, Math.min(100, Math.round(abertura)));
      r.vav.motivo = "manual";
      logEvento("vav", `${nomeDaSala(roomId)}: VAV ajustada manualmente para ${r.vav.abertura}%`, { salaId: roomId, origem: "operador" });
    }
    return clone(r);
  },
  // alterna entre controle automatico e manual
  setVavMode(roomId: string, modo: VavMode) {
    const r = rooms.find((x) => x.id === roomId);
    if (r) {
      r.vav.modo = modo === "manual" ? "manual" : "auto";
      if (r.vav.modo === "auto") r.vav.motivo = "estavel";
      logEvento("vav", `${nomeDaSala(roomId)}: modo da VAV alterado para ${r.vav.modo.toUpperCase()}`, { salaId: roomId, origem: "operador" });
    }
    return clone(r);
  },
  setVavFault(roomId: string, falha: boolean) {
    const r = rooms.find((x) => x.id === roomId);
    if (r) {
      r.vav.estado = falha ? "falha" : "ok";
      logEvento("vav", `${nomeDaSala(roomId)}: falha de VAV ${falha ? "registrada" : "normalizada"}`, {
        salaId: roomId,
        origem: falha ? "sistema" : "operador",
      });
    }
    return clone(r);
  },
  // define o setpoint de temperatura (alvo) de uma sala
  setRoomSetpoint(roomId: string, setpoint: number) {
    const r = rooms.find((x) => x.id === roomId);
    if (r) {
      const antigo = r.setpoint;
      r.setpoint = Math.max(16, Math.min(30, Number(setpoint)));
      if (antigo !== r.setpoint)
        logEvento("setpoint", `${nomeDaSala(roomId)}: setpoint alterado de ${antigo}°C para ${r.setpoint}°C`, { salaId: roomId, origem: "operador" });
    }
    return clone(r);
  },
  setClimatizador(id: string, patch: { ligado?: boolean; tempInsuflamento?: number }) {
    const c = climatizadores.find((x) => x.id === id);
    if (c) {
      Object.assign(c, patch);
      if ("ligado" in patch) logEvento("climatizador", `${c.nome} ${c.ligado ? "ligado" : "desligado"}`, { origem: "operador" });
      if ("tempInsuflamento" in patch) logEvento("climatizador", `${c.nome}: temperatura de insuflamento ajustada para ${c.tempInsuflamento}°C`, { origem: "operador" });
    }
    return clone(c);
  },
  setBathroomLight(id: string, luz: boolean) {
    const b = bathrooms.find((x) => x.id === id);
    if (b) b.luz = luz;
    const exaustao = calculateExhaustState(bathrooms).ligada;
    if (b) logEvento("exaustao", `${b.nome}: luz ${luz ? "ligada" : "desligada"} → exaustor ${exaustao ? "LIGADO" : "DESLIGADO"} (lógica OR)`, { origem: "operador" });
    // intertravamento: a exaustao segue a logica OR das luzes
    return clone({ banheiros: bathrooms, exaustao: { ligada: exaustao, logica: "OR" } });
  },
  getNtfyConfig() {
    return clone(ntfyConfig);
  },
  saveNtfyConfig(next: Partial<NtfyConfig>) {
    ntfyConfig = { ...ntfyConfig, ...next };
    return clone(ntfyConfig);
  },
  getNtfyLog() {
    return clone(ntfyLog);
  },
  // log de auditoria completo (rastreabilidade)
  getEvents() {
    return clone(eventos);
  },
  // identificacao do documento (estabelecimento / responsavel tecnico)
  getIdentificacao() {
    return clone(identificacao);
  },
  saveIdentificacao(next: Partial<Identification>) {
    identificacao = { ...identificacao, ...next };
    logEvento("registro", "Identificacao do relatorio de auditoria atualizada", { origem: "operador" });
    return clone(identificacao);
  },
  // injeta uma leitura "do Arduino/ESP32" (mesma forma do POST /api/telemetria)
  ingestTelemetry(payload: TelemetryInput) {
    const r = rooms.find((x) => x.id === payload.salaId);
    if (!r) return { ok: false };
    if (payload.temperatura != null) r.temperatura = Number(payload.temperatura);
    if (payload.umidade != null) r.umidade = Number(payload.umidade);
    if (payload.co2 != null) r.co2 = Number(payload.co2);
    r.ultimaLeitura = new Date().toISOString();
    evaluateAlerts();
    return { ok: true };
  },
  // define qual sala e alimentada por fonte externa (ESP32). null = nenhuma.
  setFonteExterna(salaId: string | null) {
    externalRoom = rooms.some((r) => r.id === salaId) ? salaId : null;
    if (externalRoom) logEvento("registro", `${nomeDaSala(externalRoom)} vinculada a fonte externa (ESP32 via MQTT)`, { salaId: externalRoom, origem: "operador" });
    return { externalRoom };
  },
};
