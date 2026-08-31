# NestJS + Supabase cutover runbook

Scope: Phase 6 items 1–3. This repository has no production deployment and no
`apps/api/hvac.db`; Supabase is the target source of truth.

## 1. Freeze SQLite writes

Stop any legacy Express process before final verification. The checked-in legacy server
is inspection-only:

- `apps/api/db.ts` opens SQLite read-only by default and enables SQLite `query_only`.
- `apps/api/server.ts` exposes only legacy `GET` routes.
- The old `init-db` package script is removed.
- `SQLITE_WRITE_MODE` must remain unset. `SQLITE_WRITE_MODE=rollback` is reserved for
  an explicitly approved rollback operation and must not be used during cutover.

Keep any rollback backup outside the repository. Do not write new telemetry, alerts, or
operator changes to SQLite after this point.

## 2. Final data migration decision

Run from repository root:

```bash
npm run cutover:verify-data
```

Current result: no SQLite database, `-wal`, or `-shm` file exists, and Phase 0 recorded
that the project has no production data. Therefore no SQLite-to-Supabase import is
required. Use the committed canonical migration and development seed only for local or
non-production environments:

```bash
supabase db reset
```

For a hosted environment, apply migrations with `supabase db push`; never apply
`supabase/seed.sql` to production. If the verification command finds a database file,
stop cutover and reopen the migration scope before changing Supabase data.

## 3. Deploy NestJS + Supabase

Set server-only API variables in the deployment environment. Never expose these through
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

`npm start` now targets `apps/api/src/main.ts`, the NestJS entrypoint. The web build
must use the real API and same-origin reverse proxy paths:

```dotenv
VITE_API_MODE=real
VITE_API_BASE=/api
```

Route `/api` and `/socket.io` from the dashboard origin to Nest. If WebSocket uses a
separate origin, set `VITE_REALTIME_URL` to that origin before building the front.

Smoke checks after deployment:

```bash
curl --fail https://api.example.com/api/health
curl --fail https://api.example.com/api/estado
```

A failed check blocks cutover. Roll back by switching traffic to the previously built
deployment artifact and its preserved backup; do not re-enable SQLite writes in the
cutover deployment.
