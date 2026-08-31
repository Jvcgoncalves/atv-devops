# API HVAC — NestJS + Supabase

API NestJS do dashboard HVAC. Supabase Postgres é fonte de verdade; Nest mantém REST
compatível com dashboard, ingere MQTT/REST, persiste telemetria, gera alertas, publica
comandos MQTT e envia atualizações por Socket.IO.

## Requisitos

- Node.js 22.6+ e npm 10.x.

## Como rodar

```bash
npm install
cp apps/api/.env.example apps/api/.env
npm run dev:api
```

Informe `SUPABASE_URL` e chave server-only (`SUPABASE_SECRET_KEY` ou
`SUPABASE_SERVICE_ROLE_KEY`) em `apps/api/.env`. A API sobe em `http://localhost:3001`,
usa prefixo REST `/api` e Socket.IO no namespace `/realtime`.

Para desenvolvimento local, aplique migrations e seed com `supabase db reset`. Para
deployment, use `npm ci && npm run build && npm start`; `npm start` executa Nest, não o
servidor Express legado.

## Modelo de dados

Schema canônico em `supabase/migrations/` usa tabelas snake_case: `climatizers`, `rooms`,
`vavs`, `sensors`, `alert_thresholds`, `sensor_readings`, `alerts`, `bathrooms`,
`ntfy_config`, `ntfy_logs`, `audit_events` e `identification`.

## Rotas compatíveis

- `GET /api/estado`
- `GET /api/historico/:salaId/:metrica`
- `GET/PUT /api/parametros[/:salaId]`
- `GET/POST/DELETE /api/alertas...`
- `PUT /api/salas/:salaId/{setpoint,vav,vav/modo,vav/falha}`
- `GET/PUT /api/climatizadores/:id`
- `GET/PUT /api/banheiros/:id`
- `GET/PUT /api/ntfy`, `GET /api/ntfy/log`
- `GET/PUT /api/identificacao`, `GET /api/eventos`
- `POST /api/telemetria`, `POST /api/vav/estado`, `POST /api/banheiro/luz`
- `GET /api/health`

O SQLite antigo está congelado e só permanece para inspeção durante janela de rollback.
Veja [`docs/CUTOVER_RUNBOOK.md`](../../docs/CUTOVER_RUNBOOK.md) para decisão de migração
de dados e configuração de deployment.

## Fluxo com ESP32

```text
ESP32 --(MQTT)--> broker --(Nest MQTT adapter)--> Supabase sensor_readings
                                             --> alerts + ntfy.sh + Socket.IO
```

Nest é único dono da ingestão MQTT. Dashboard recebe atualizações ao vivo por WebSocket;
não conecta diretamente ao broker.
