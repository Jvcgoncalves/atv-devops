# Dashboard de Automação HVAC — TCC

Dashboard web (React) para **supervisão e controle** de um sistema HVAC com 4 salas,
2 climatizadores, VAV por sala, exaustão intertravada em 2 banheiros e alertas via
**ntfy.sh**. Comunicação com o Arduino/ESP32 por **MQTT** e **API REST**.

A interface segue a paleta e os critérios de acessibilidade definidos na *Pesquisa de
Cores* do TCC (azul técnico `#0F4C81`, verde/âmbar/vermelho para status, contraste WCAG AA).

## O que já está pronto

- **Dashboard completa em React** (Vite): cards por sala (temperatura, umidade, CO₂ com
  status colorido + rótulo), controle de VAV, painel de climatizadores, exaustão dos
  banheiros (lógica OR), gráficos de telemetria com linhas de limite.
- **Parâmetros editáveis** (faixas de temp/umidade/CO₂) e configuração do **ntfy.sh**.
- **Central de alertas** com filtros, reconhecimento e log de notificações enviadas.
- **Auditoria / rastreabilidade**: log de eventos (alertas, ações do operador, falhas) e
  registros ambientais periódicos, com exportação em CSV — atende NBR 7256 e PMOC
  (Lei 13.589/2018), com valor de segurança jurídica em inspeções e acreditação.
- **Camada de API** com modo *mock* (simulador embutido) e modo *real* (REST + Socket.IO).
- No modo real, Nest é único dono da ingestão MQTT; navegador recebe eventos pelo WebSocket.
- **Contrato da API** completo em [`docs/API_CONTRACT.md`](docs/API_CONTRACT.md):
  endpoints REST, tópicos MQTT, integração ntfy.sh e schema Supabase.

> Por padrão a dashboard roda em **modo simulado** — funciona sem o Arduino físico nem
> backend. Ajuste os controles e veja temperatura/CO₂ reagirem e os alertas dispararem.

## Como rodar

Requer Node.js 22.6+ e npm 10.x.

```bash
npm install
npm run dev
```
Acesse <http://localhost:5173>.

Comandos separados:

```bash
npm run dev:web
npm run dev:api
npm start
npm run build:front
npm run build:api
npm run test:front
npm run test:api
npm run ci
```

`npm run ci` executa verificacao de cutover, testes completos e build de producao — mesma validacao usada pelo GitHub Actions.

## Build e deployment

O entrypoint de deployment é NestJS. Execute na raiz:

```bash
npm ci
npm run build
npm start
```

Configure API em ambiente server-only (`apps/api/.env` local ou secrets do provedor):

```dotenv
NODE_ENV=production
PORT=3001
CORS_ORIGINS=https://dashboard.example.com
SUPABASE_URL=https://<PROJECT_REF>.supabase.co
SUPABASE_SECRET_KEY=sb_secret_<SERVER_ONLY_VALUE>
MQTT_ENABLED=true
MQTT_URL=mqtts://<BROKER_HOST>:8883
MQTT_TOPIC=hvac/sala/+/telemetria
MQTT_DEFAULT_ROOM_ID=sala-1
REALTIME_ALLOWED_ORIGINS=https://dashboard.example.com
REALTIME_AUTH_TOKEN=<SERVER_ONLY_VALUE>
```

Configure front para API real:

```dotenv
VITE_API_MODE=real
VITE_API_BASE=/api
```

Nunca coloque credenciais Supabase/MQTT/ntfy ou tokens server-only em variáveis `VITE_*`.
Use `GET /api/health` para liveness e `GET /api/health/ready` para readiness de Supabase
e MQTT. Métricas operacionais ficam em `GET /api/health/metrics`.

## Conectar ao backend real

1. Aplique a migration Supabase e suba a API Nest conforme [`apps/api/README.md`](apps/api/README.md).
2. Crie `apps/web/.env`:
   ```
   VITE_API_MODE=real
   VITE_API_BASE=/api
   API_PROXY_TARGET=http://localhost:3001
   ```
   O proxy Vite encaminha `/api/*` para Nest em `http://localhost:3001` por padrão.
   Para demo offline, omita `.env` ou use `VITE_API_MODE=mock`; nenhum backend é necessário.

Para cutover/deployment, siga [`docs/CUTOVER_RUNBOOK.md`](docs/CUTOVER_RUNBOOK.md).

## Estrutura

```
apps/web/src/
  api/
    client.ts        # acesso à API (mock | real)
    mockBackend.ts   # simulador (telemetria, alertas, ntfy) — mesmos formatos do contrato
  context/
    ConfigContext.tsx# estado global + polling
  components/        # RoomCard, ClimatizadorPanel, BathroomExhaust, TelemetryChart...
  pages/             # Dashboard, Parametros, Alertas
  theme.ts, index.css# paleta e estilos do TCC
apps/api/            # API NestJS/Supabase
packages/contracts/  # contratos compartilhados (Phase 2)
packages/domain/     # dominio compartilhado (Phase 2)
packages/config/     # configuracao nao-secreta compartilhada
docs/
  API_CONTRACT.md    # contrato REST + MQTT + Supabase + ntfy.sh
```

## Observação sobre o protocolo

O levantamento de requisitos cita **BACnet** (RF18), mas este projeto adota **MQTT**
conforme sua decisão. Vale registrar essa escolha e a justificativa no texto do TCC
(MQTT é mais leve e simples de integrar ao ESP32/Arduino para um protótipo).
