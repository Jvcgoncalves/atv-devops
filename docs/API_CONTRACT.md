# Contrato da API — Sistema de Automação HVAC (TCC)

Este documento define a interface entre os três componentes do sistema:

```
 ┌──────────┐   MQTT    ┌─────────────┐   REST/JSON   ┌──────────────┐
 │ Arduino/ │ ────────▶ │   Backend   │ ◀───────────▶ │  Dashboard   │
 │  ESP32   │ ◀──────── │ NestJS API   │             │   (React)    │
 └──────────┘  comandos └─────────────┘                └──────────────┘
                              │ POST
                              ▼
                         ntfy.sh (alertas)
                              │
                       Supabase Postgres
```

Arquitetura escolhida: **ambos os caminhos**. O Arduino publica telemetria via **MQTT**
(caminho principal, contínuo) e também pode usar **REST** (`POST /api/telemetria`) como
caminho alternativo/redundante. Os comandos do backend para o campo vão por MQTT.
A dashboard usa REST para snapshot inicial, comandos, configuração e histórico, e
WebSocket para atualizações ao vivo enviadas pelo backend.

Supabase Postgres é fonte de verdade. NestJS é único dono da persistência e da ingestão
MQTT; SQLite não faz parte do código ou deployment final.

> A dashboard React já implementa este contrato. No modo `mock` ela usa um simulador
> interno (`apps/web/src/api/mockBackend.ts`) com exatamente os mesmos formatos abaixo, então ao
> ligar o backend real basta setar `VITE_API_MODE=real`.

**Baseline de compatibilidade:** as rotas REST e os nomes JSON deste documento, além dos
métodos usados em `apps/web/src/api/client.ts`, são preservados durante a migração. O backend Nest
é o único consumidor MQTT que persiste telemetria. A dashboard não se conecta diretamente
ao MQTT, evitando leituras e alertas duplicados.

---

## 1. Modelo de dados

### Sala
```json
{
  "id": "sala-1",
  "nome": "Sala 1",
  "climatizadorId": "clima-1",
  "setpoint": 23,
  "temperatura": 22.6,
  "umidade": 51,
  "co2": 720,
  "vav": { "abertura": 60, "estado": "ok", "modo": "auto", "motivo": "resfriamento" },
  "ultimaLeitura": "2026-06-25T20:10:00.000Z",
  "status": { "temperatura": "normal", "umidade": "normal", "co2": "atencao" }
}
```
`status.*` ∈ `"normal" | "atencao" | "critico"` (calculado pelo backend a partir dos parâmetros).
`vav.estado` ∈ `"ok" | "falha"`. `vav.modo` ∈ `"auto" | "manual"`.
`vav.motivo` ∈ `"estavel" | "resfriamento" | "ventilacao" | "manual"` (apenas informativo, para a UI).

### Climatizador (unidade central de resfriamento / AHU)
```json
{ "id": "clima-1", "nome": "Climatizador A", "salas": ["sala-1","sala-2"], "ligado": true, "tempInsuflamento": 15 }
```
`tempInsuflamento` = temperatura (°C) do ar frio insuflado, mantida constante. Quem regula
a temperatura de **cada sala** é a VAV, modulando a vazão para atingir o `setpoint` da sala.

### Banheiro / exaustão
```json
{ "id": "ban-1", "nome": "Banheiro 1", "luz": false }
```
Exaustão: `ligada = luz(ban-1) OR luz(ban-2)` (RF10/RF11).

### Parâmetros (faixas de alerta — por sala)
As faixas são configuráveis **individualmente por sala**. O objeto é um mapa indexado por `salaId`:
```json
{
  "sala-1": {
    "temperatura": { "min": 20, "max": 26, "unit": "C" },
    "umidade":     { "min": 40, "max": 60, "unit": "%" },
    "co2":         { "warn": 800, "critical": 1000, "unit": "ppm" }
  },
  "sala-2": { "temperatura": { "min": 18, "max": 24, "unit": "C" }, "...": "..." }
}
```

**Padrões default (ambiente hospitalar / EAS):**
- **Umidade 40–60%** — ABNT NBR 7256 (tratamento de ar em Estabelecimentos Assistenciais
  de Saúde), faixa para áreas comuns.
- **CO₂ máx. 1000 ppm** — ANVISA RE 09/2003 (referência de renovação de ar interior, base
  da NBR 7256). A ABNT NBR 17037:2023 adota limite dinâmico de 700 ppm acima do ar externo
  (~1100 ppm). Adotamos 1000 ppm como crítico e 800 ppm como atenção.

Como as faixas são editáveis por sala, áreas críticas (ex.: centro cirúrgico, 45–55%)
podem receber limites mais restritos que áreas comuns.

### Alerta
```json
{
  "id": "alt-12", "level": "critico", "tipo": "temperatura",
  "mensagem": "Sala 1: temperatura 28.4C fora da faixa (20-26C)",
  "salaId": "sala-1", "ts": "2026-06-25T20:11:00.000Z", "reconhecido": false
}
```
`level` ∈ `"critico" | "atencao" | "info"`. `tipo` ∈ `temperatura | umidade | co2 | vav | incendio`.

---

## 2. Endpoints REST (Backend → Dashboard)

Base URL: `/api` (configurável via `VITE_API_BASE`).

| Método | Rota | Descrição | RF |
|--------|------|-----------|----|
| GET | `/api/estado` | Estado completo (salas, climatizadores, banheiros, exaustão, conexão) | RF04, RF07 |
| GET | `/api/historico/:salaId/:metrica` | Série temporal (`metrica` = `temperatura`\|`umidade`\|`co2`) | RNF07 |
| GET | `/api/parametros` | Mapa de faixas de alerta por sala | RNF06 |
| PUT | `/api/parametros/:salaId` | Atualiza as faixas de **uma** sala | RNF06 |
| GET | `/api/alertas` | Lista de alertas | RF12-RF16 |
| POST | `/api/alertas/:id/reconhecer` | Marca alerta como reconhecido | — |
| DELETE | `/api/alertas/reconhecidos` | Remove alertas reconhecidos | — |
| PUT | `/api/salas/:salaId/setpoint` | `{ "setpoint": number }` — alvo de temperatura da sala | RF06 |
| PUT | `/api/salas/:salaId/vav/modo` | `{ "modo": "auto"\|"manual" }` — modo de operação da VAV | RF06 |
| PUT | `/api/salas/:salaId/vav` | `{ "abertura": 0-100 }` — override manual (força `modo:manual`) | RF06, RF08 |
| PUT | `/api/climatizadores/:id` | `{ "ligado": bool, "tempInsuflamento": number }` | RF05, RF08 |
| PUT | `/api/banheiros/:id` | `{ "luz": bool }` — dispara intertravamento OR | RF10/RF11 |
| GET / PUT | `/api/ntfy` | Configuração de notificações | RF17 |
| GET | `/api/ntfy/log` | Histórico de notificações enviadas | RF17 |
| GET | `/api/eventos` | Log de auditoria (rastreabilidade) | RNF07 |
| GET / PUT | `/api/identificacao` | Dados do EAS e responsável técnico (cabeçalho do relatório) | RNF07 |
| GET | `/api/health` | Liveness da API | Operação |
| GET | `/api/health/ready` | Readiness da API, Supabase e MQTT | Operação |
| GET | `/api/health/metrics` | Contadores operacionais sem segredos | Operação |

### Exemplo — `GET /api/estado`
```json
{
  "timestamp": "2026-06-25T20:10:00.000Z",
  "conexao": { "online": true, "fonte": "MQTT" },
  "salas": [ /* Sala[] */ ],
  "climatizadores": [ /* Climatizador[] */ ],
  "banheiros": [ /* Banheiro[] */ ],
  "exaustao": { "ligada": false, "logica": "OR" }
}
```

### 2.1 Atualizações ao vivo por WebSocket

O canal WebSocket backend → dashboard é obrigatório em desenvolvimento, staging e
produção. O Nest publica eventos somente depois de validar e persistir a alteração recebida
por MQTT ou pelo POST REST alternativo.

Neste contrato, os canais têm responsabilidades diferentes: MQTT conecta ESP32/edge ao
backend e leva comandos de volta aos dispositivos; WebSocket conecta o backend à dashboard.
Se o broker usar MQTT sobre WebSocket, isso não transforma a dashboard em dona da ingestão.

Eventos iniciais:

- `telemetry.updated` — leitura persistida e estado atualizado da sala.
- `alert.created` — novo alerta criado para uma sala.
- `alert.updated` — reconhecimento ou remoção de alerta.
- `device.status.changed` — conectividade ou falha de dispositivo alterada.
- `system.snapshot` — ressincronização completa após reconexão.

Envelope mínimo:

```json
{
  "eventId": "evt-uuid",
  "version": 42,
  "occurredAt": "2026-08-31T12:00:00.000Z",
  "data": {
    "roomId": "sala-1",
    "temperature": 22.6,
    "humidity": 51,
    "co2": 720,
    "source": "MQTT",
    "timestamp": "2026-08-31T12:00:00.000Z",
    "status": { "temperatura": "normal", "umidade": "normal", "co2": "normal" }
  }
}
```

O cliente ignora eventos duplicados ou com versão anterior. Ao reconectar, a dashboard
solicita novo snapshot REST e histórico; o WebSocket continua sendo o canal de atualização
sem polling como caminho principal.

### 2.2 Saúde e observabilidade operacional

`GET /api/health` é liveness: confirma que processo Nest responde e preserva resposta
compatível `{ "ok": true, "ts": "..." }`.

`GET /api/health/ready` verifica conexão Supabase e estado MQTT. Retorna `200` quando
dependências estão prontas, ou `503` quando banco/MQTT requerido está indisponível. MQTT
desabilitado explicitamente (`MQTT_ENABLED=false`) aparece como `disabled`, não como falha.

`GET /api/health/metrics` expõe contadores em memória para operação: telemetria recebida,
persistida, duplicada e rejeitada; alertas criados e falhos; mensagens, erros e reconexões
MQTT; erros de banco e último horário/mensagem de cada erro. Nenhum segredo é retornado.
Contadores reiniciam a cada deploy; logs estruturados devem ser enviados pelo ambiente de
execução para retenção e alertas.

---

## 3. Endpoints REST (Arduino → Backend) — caminho redundante

| Método | Rota | Corpo |
|--------|------|-------|
| POST | `/api/telemetria` | `{ "salaId": "sala-1", "temperatura": 22.6, "umidade": 51, "co2": 720 }` |
| POST | `/api/vav/estado` | `{ "salaId": "sala-1", "abertura": 60, "estado": "ok" }` |
| POST | `/api/banheiro/luz` | `{ "banheiroId": "ban-1", "luz": true }` |

Resposta: `200 { "ok": true }`. Recomenda-se header `X-Device-Token` para autenticação simples.

---

## 4. Tópicos MQTT (caminho principal)

Broker sugerido: Mosquitto. Formato de payload: JSON.

**Publicações do Arduino (telemetria/estado):**

| Tópico | Payload | Frequência |
|--------|---------|-----------|
| `hvac/sala/1/telemetria` | `{ "temperatura": 22.6, "umidade": 51, "co2": 720 }` | a cada 3-5 s |
| `hvac/sala/1/vav` | `{ "abertura": 60, "estado": "ok" }` | em mudança |
| `hvac/banheiro/1/luz` | `{ "luz": true }` | em mudança |
| `hvac/status` | `{ "online": true }` (LWT recomendado) | conexão |

**Comandos do Backend → Arduino (subscribe no ESP32):**

| Tópico | Payload |
|--------|---------|
| `hvac/sala/1/vav/set` | `{ "abertura": 40 }` |
| `hvac/clima/1/set` | `{ "ligado": true, "setpoint": 23 }` |

> O Nest assina os tópicos configurados, persiste no Supabase, reavalia os parâmetros e
> republica comandos quando a dashboard chama os endpoints `PUT`.

### 4.1 Controle automático da VAV (essência da automação)

Arquitetura **VAV multizona**: uma única unidade central de resfriamento (climatizador/AHU)
insufla ar frio a temperatura constante (`tempInsuflamento`), e **cada sala tem seu próprio
`setpoint`**. A VAV daquela sala modula a vazão de ar frio para manter a sala no setpoint —
é assim que um só equipamento de frio atende várias salas com temperaturas independentes
(prática padrão em automação predial).

A VAV **modula sozinha** — ninguém define a abertura manualmente em operação normal.
A malha de controle (no ESP32, ou no backend que comanda o ESP32) calcula a abertura a
partir de duas demandas, usando a maior delas:

- **Resfriamento:** controle proporcional ao erro `temperatura − setpoint da própria sala`.
  Quanto mais quente que o alvo, mais a VAV abre.

**Limite físico importante (validado por pesquisa):** uma VAV só modula a *vazão* de ar
frio — ela **não consegue resfriar a sala abaixo da temperatura de insuflamento** do ar. Com
o ar insuflado a 20 °C, a sala pode ser levada para baixo apenas até ~20 °C (com a VAV
próxima de 100%), nunca menos. A faixa controlável vai de ≈ temperatura de insuflamento (VAV
máxima) até a temperatura natural do ambiente sem resfriamento (VAV mínima). Definir um
setpoint abaixo do insuflamento é fisicamente inatingível — a dashboard sinaliza esse caso.
Sistemas que precisam *aquecer* uma zona usam VAV **com reaquecimento** (reheat), não modelado
aqui (sistema só-resfriamento).
- **Ventilação:** proporcional ao **CO₂**. Acima do limite de atenção a VAV abre para
  renovar o ar; no limite crítico vai a 100%.

`abertura_alvo = max(demanda_resfriamento, demanda_ventilacao)`, com movimento suave do
atuador. O operador pode assumir o controle (`modo: manual`) via dashboard/endpoint, e
voltar para `auto` quando quiser. A dashboard apenas **exibe** a abertura e o motivo em
modo automático.

---

## 5. Integração ntfy.sh (RF17)

Ao detectar um alerta com `level >= minLevel`, o backend faz:

```
POST https://ntfy.sh/<topic>
Headers:
  Title:    HVAC - ALARME CRITICO
  Priority: urgent        # urgent (critico) | high (atencao)
  Tags:     rotating_light
Body:
  Sala 1: temperatura 28.4C fora da faixa (20-26C)
```

Exemplo de implementação (Node):
```js
await fetch(`https://ntfy.sh/${topic}`, {
  method: "POST",
  headers: { Title: title, Priority: priority, Tags: tags.join(",") },
  body: mensagem,
});
```

Para receber no celular: instale o app **ntfy** e assine o tópico configurado em
*Parâmetros → Notificações ntfy.sh*.

---

## 6. Persistência — Supabase Postgres

O schema canônico está em
[`supabase/migrations/20260831200000_hvac_initial_schema.sql`](../supabase/migrations/20260831200000_hvac_initial_schema.sql)
e o seed de desenvolvimento em [`supabase/seed.sql`](../supabase/seed.sql). O Nest usa
um cliente server-only; o navegador não recebe credenciais nem acessa tabelas diretamente.

Tabelas persistidas: `climatizers`, `rooms`, `vavs`, `sensors`, `bathrooms`,
`alert_thresholds`, `sensor_readings`, `alerts`, `ntfy_config`, `ntfy_logs`,
`audit_events` e `identification`. Colunas usam `snake_case` no Postgres e são mapeadas
para os nomes do contrato REST. RLS está habilitado nas tabelas públicas.

### 6.1 Comandos finais e ambiente

Na raiz do monorepo:

```bash
npm ci
npm run build
npm start
```

`npm start` executa `apps/api/src/main.ts`. API usa somente variáveis server-only:

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

Front usa:

```dotenv
VITE_API_MODE=real
VITE_API_BASE=/api
```

Nenhuma variável `SUPABASE_*`, credencial MQTT, token ntfy ou token server-only pode ter
prefixo `VITE_`.

### Rastreabilidade e base legal (por que registrar)

O log de eventos + o registro contínuo de telemetria (`audit_events` e `sensor_readings`)
dão **rastreabilidade**,
exigida para ambientes hospitalares e com valor de **segurança jurídica**:

- **ABNT NBR 7256** — exige monitoramento e **registro contínuo** de temperatura, umidade e
  pressão diferencial para rastreabilidade; é critério em acreditações (ONA, JCI).
- **Lei 13.589/2018 (PMOC)** — obriga plano de manutenção/operação/controle com registros
  para sistemas de climatização de uso público/coletivo (inclui hospitais); a ausência é
  infração sanitária autuável (multa de R$ 2 mil a R$ 1,5 milhão), fiscalizada por
  Vigilância Sanitária / ANVISA.
- **ANVISA RE 09/2003** — parâmetros de referência da qualidade do ar interior.

Recomenda-se reter os eventos e as leituras por período compatível com a política do EAS e
permitir **exportação (CSV)** para apresentação em inspeções — implementado na tela *Auditoria*.

**Conteúdo mínimo do relatório (registro válido, conforme PMOC / NBR 7256).** O CSV exportado
inclui um cabeçalho de identificação além das linhas de eventos:

- Identificação do **estabelecimento (EAS)** e **CNES**;
- **Sistema** e base normativa (NBR 7256; Lei 13.589/2018; RE 09/2003);
- **Responsável técnico** e **registro profissional (CREA/CFT) + ART/TRT**;
- **Data/hora de geração** e **período** dos registros;
- Para cada evento: data/hora, categoria, origem (sistema/operador), ambiente e descrição
  com os **parâmetros medidos e unidades** (°C, %, ppm).

> Observação: laudos de qualidade do ar por laboratório credenciado e certificados de
> calibração dos sensores são documentos complementares do PMOC, mantidos fora do sistema.
> A assinatura do responsável técnico (física ou digital/ICP-Brasil) é aposta no relatório
> emitido.

---

## 7. Mapeamento Requisito → Implementação

| Requisito | Onde |
|-----------|------|
| RF01-RF03 leitura de temp/umidade/CO₂ | MQTT `hvac/sala/+/telemetria` + `POST /api/telemetria` |
| RF04 exibir valores | `GET /api/estado` → cards na dashboard |
| RF05 vínculo climatizador↔salas | campo `salas[]` do climatizador |
| RF06/RF07 controle e estado da VAV | controle **automático** (seção 4.1) + override `modo:manual`; `vav.estado` |
| RF08/RF09 comandos e dados via API | seções 2 e 3 |
| RF10/RF11 exaustão lógica OR | `exaustao.ligada`, `PUT /api/banheiros/:id` |
| RF12-RF16 alertas | seção 1 (Alerta) + avaliação por parâmetros |
| RF17 ntfy.sh | seção 5 |
| RF18 BACnet | *(o levantamento cita BACnet; este projeto adota MQTT conforme decisão do aluno — registrar a troca no TCC)* |
| RNF06 faixas configuráveis | `/api/parametros` + tela Parâmetros |
| RNF07 logs | tabelas `audit_events`/`sensor_readings` + `GET /api/eventos` |
