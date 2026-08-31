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
- **Camada de API** com modo *mock* (simulador embutido) e modo *real* (REST).
- **Contrato da API** completo em [`docs/API_CONTRACT.md`](docs/API_CONTRACT.md):
  endpoints REST, tópicos MQTT, integração ntfy.sh e schema SQLite.

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
npm run build:front
npm run build:api
npm run test:front
npm run test:api
```

## Conectar ao backend real

1. Implemente o backend conforme [`docs/API_CONTRACT.md`](docs/API_CONTRACT.md)
   (sugestão: Node/Express ou FastAPI + cliente MQTT + SQLite).
2. Crie `apps/web/.env`:
   ```
   VITE_API_MODE=real
   VITE_API_BASE=/api
   ```
3. Ajuste o `proxy.target` em `apps/web/vite.config.ts` para o endereço da API.

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
apps/api/            # API Express/SQLite temporaria de compatibilidade
packages/contracts/  # contratos compartilhados (Phase 2)
packages/domain/     # dominio compartilhado (Phase 2)
packages/config/     # configuracao nao-secreta compartilhada
docs/
  API_CONTRACT.md    # contrato REST + MQTT + SQLite + ntfy.sh
```

## Observação sobre o protocolo

O levantamento de requisitos cita **BACnet** (RF18), mas este projeto adota **MQTT**
conforme sua decisão. Vale registrar essa escolha e a justificativa no texto do TCC
(MQTT é mais leve e simples de integrar ao ESP32/Arduino para um protótipo).
