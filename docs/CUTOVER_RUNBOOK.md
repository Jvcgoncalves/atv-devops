# NestJS + Supabase cutover runbook

Scope: Phase 6 production cutover and cleanup. Supabase is the only application data
source. This repository has no production SQLite database or data import requirement.

## 1. Pre-cutover checks

Run from repository root:

```bash
npm ci
npm run cutover:verify-data
npm test
npm run build
```

`cutover:verify-data` must report no SQLite database or journal files. If it finds an
artifact, stop and reopen migration scope before deployment. Do not create or migrate a
database inside this repository.

## 2. Deploy NestJS + Supabase

Set server-only variables in the deployment environment. Never expose these through
`VITE_*` variables:

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

Deploy commands:

```bash
npm ci
npm run build
npm start
```

`npm start` targets `apps/api/src/main.ts`. Build front with:

```dotenv
VITE_API_MODE=real
VITE_API_BASE=/api
```

Route `/api` and `/socket.io` from dashboard origin to Nest. If WebSocket uses another
origin, set `VITE_REALTIME_URL` before front build. Never put Supabase, MQTT, ntfy, or
server authentication secrets in front variables.

## 3. Smoke checks

```bash
curl --fail https://api.example.com/api/health
curl --fail https://api.example.com/api/health/ready
curl --fail https://api.example.com/api/estado
```

`/health` proves process liveness. `/health/ready` checks Supabase and required MQTT
connectivity and returns `503` when a dependency is unavailable. A failed smoke check
blocks traffic switch.

## 4. Monitor after traffic switch

Poll `/api/health/ready` and `/api/health/metrics` from the deployment monitor. Alert on:

- readiness `503`, database errors, or increasing database `lastError`;
- telemetry received without persisted readings, rising rejection/duplicate counts, or a
  stale `lastPersistedAt` during expected device traffic;
- alert errors or alert creation stopping while telemetry continues;
- MQTT disconnected state, increasing `reconnects`/`errors`, or stale `lastConnectedAt`;
- API process restarts, HTTP 5xx, and WebSocket disconnect/resync failures.

Forward structured `database_error`, `mqtt_error`, and `alert_error` log events to the
hosting provider log/alert system. Metrics are process-local and reset on deploy; logs are
the durable incident record.

Manual acceptance:

- dashboard loads state/history and receives live telemetry without polling;
- one MQTT payload creates one reading, state update, alert evaluation, and live event;
- REST telemetry fallback follows the same path;
- threshold, alert, VAV, climatizer, bathroom, ntfy, audit, and identification actions work;
- API restart reconnects MQTT and front reconnect performs snapshot resync.

## 5. Close rollback window and retire legacy path

After smoke and acceptance checks pass for the agreed rollback window:

- keep rollback artifact and Supabase backup/migration version recorded;
- verify no `apps/api/hvac.db`, `-wal`, or `-shm` files exist;
- verify `apps/api` has no Express/SQLite compatibility runtime or dependencies;
- keep all writes on Nest + Supabase; never re-enable a local database path;
- remove old deployment artifact only after backup and rollback owner are recorded.

Rollback target is the previous Nest deployment plus its compatible Supabase migration or
provider backup. This migration has no SQLite rollback target.

## 6. Required GitHub checks

`.github/workflows/ci.yml` runs independent jobs named exactly `test-api` and `test-front`
for every pull request and pushes to protected `main`. Each job runs install, typecheck,
tests, and its production build.

Repository administrators must enable branch protection and require both status checks:

1. GitHub → Settings → Branches → branch protection rule.
2. Enable “Require status checks to pass before merging”.
3. Add `test-api` and `test-front` as required checks.
4. Apply rule to every protected default/release branch.

Do not enable `continue-on-error` for either job.
