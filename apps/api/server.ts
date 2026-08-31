// ---------------------------------------------------------------------------
// Legacy read-only server kept for rollback-window inspection.
// Production entrypoint is apps/api/src/main.ts (NestJS + Supabase).
// ---------------------------------------------------------------------------

import express from "express";
import cors from "cors";
import { db } from "./db.ts";

const app = express();
app.use(cors());
app.use(express.json());

// SQLite writes are frozen. The old process can only serve rollback-window reads.
function readOnlyCrud(rota: string, tabela: string, pk: string): void {
  app.get(`/api/${rota}`, (_req, res) => {
    res.json(db.prepare(`SELECT * FROM ${tabela}`).all());
  });

  app.get(`/api/${rota}/:id`, (req, res) => {
    const row = db.prepare(`SELECT * FROM ${tabela} WHERE "${pk}" = ?`).get(req.params.id);
    return row ? res.json(row) : res.status(404).json({ erro: "nao encontrado" });
  });
}

readOnlyCrud("climatizadores", "CLIMATIZADOR", "id_climatizador");
readOnlyCrud("salas", "SALA", "id_sala");
readOnlyCrud("vavs", "VAV", "id_vav");
readOnlyCrud("sensores", "SENSOR", "id_sensor");
readOnlyCrud("limites", "LIMITE_ALERTA", "id_limite");
readOnlyCrud("alertas", "ALERTA", "id_alerta");
readOnlyCrud("leituras", "LEITURA_SENSOR", "id_leitura");

// ----- Rotas auxiliares ----------------------------------------------------

// Leituras de um sensor (historico)
app.get("/api/sensores/:id/leituras", (req, res) => {
  res.json(
    db.prepare("SELECT * FROM LEITURA_SENSOR WHERE id_sensor = ? ORDER BY id_leitura DESC LIMIT 500").all(req.params.id)
  );
});

// Sensores de uma sala
app.get("/api/salas/:id/sensores", (req, res) => {
  res.json(db.prepare("SELECT * FROM SENSOR WHERE id_sala = ?").all(req.params.id));
});

// Healthcheck
app.get("/api/health", (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Backend HVAC ouvindo em http://localhost:${PORT}`);
});
