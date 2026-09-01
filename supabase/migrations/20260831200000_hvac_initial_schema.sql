-- Canonical Phase 3 schema.
-- Public API names are mapped to these snake_case columns in Phase 4.

create extension if not exists pgcrypto with schema extensions;

create table public.climatizers (
  id text primary key,
  name text not null,
  is_on boolean not null default true,
  supply_air_temperature numeric(5, 2) not null default 15,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint climatizers_name_not_blank check (length(btrim(name)) > 0),
  constraint climatizers_supply_air_temperature_range
    check (supply_air_temperature between -50 and 80)
);

create table public.rooms (
  id text primary key,
  name text not null,
  floor text,
  climatizer_id text not null references public.climatizers(id) on delete restrict,
  setpoint numeric(5, 2) not null default 23,
  current_temperature numeric(6, 2),
  current_humidity numeric(6, 2),
  current_co2 numeric(8, 2),
  last_reading_at timestamptz,
  telemetry_source text not null default 'REST',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rooms_name_not_blank check (length(btrim(name)) > 0),
  constraint rooms_setpoint_range check (setpoint between 16 and 30),
  constraint rooms_current_temperature_range
    check (current_temperature is null or current_temperature between -50 and 80),
  constraint rooms_current_humidity_range
    check (current_humidity is null or current_humidity between 0 and 100),
  constraint rooms_current_co2_range
    check (current_co2 is null or current_co2 between 0 and 100000),
  constraint rooms_telemetry_source_check
    check (telemetry_source in ('MQTT', 'REST', 'ESP32', 'MOCK'))
);

create table public.vavs (
  id text primary key,
  room_id text not null unique references public.rooms(id) on delete cascade,
  state text not null default 'ok',
  opening numeric(5, 2) not null default 0,
  airflow numeric(8, 2),
  mode text not null default 'auto',
  reason text not null default 'estavel',
  updated_at timestamptz not null default now(),
  constraint vavs_state_check check (state in ('ok', 'falha')),
  constraint vavs_opening_range check (opening between 0 and 100),
  constraint vavs_airflow_non_negative check (airflow is null or airflow >= 0),
  constraint vavs_mode_check check (mode in ('auto', 'manual')),
  constraint vavs_reason_check
    check (reason in ('estavel', 'resfriamento', 'ventilacao', 'manual', 'sem_frio'))
);

create table public.sensors (
  id text primary key,
  room_id text not null references public.rooms(id) on delete cascade,
  metric text not null,
  unit text not null,
  status text not null default 'ativo',
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  constraint sensors_metric_check check (metric in ('temperatura', 'umidade', 'co2')),
  constraint sensors_unit_check check (
    (metric = 'temperatura' and unit = 'C')
    or (metric = 'umidade' and unit = '%')
    or (metric = 'co2' and unit = 'ppm')
  ),
  constraint sensors_status_check check (status in ('ativo', 'inativo', 'falha')),
  constraint sensors_room_metric_unique unique (room_id, metric),
  constraint sensors_id_room_unique unique (id, room_id)
);

create table public.alert_thresholds (
  id text primary key,
  room_id text not null references public.rooms(id) on delete cascade,
  metric text not null,
  min_value numeric(10, 2),
  max_value numeric(10, 2),
  warn_value numeric(10, 2),
  critical_value numeric(10, 2),
  unit text not null,
  updated_at timestamptz not null default now(),
  constraint alert_thresholds_metric_check check (metric in ('temperatura', 'umidade', 'co2')),
  constraint alert_thresholds_values_check check (
    (
      metric in ('temperatura', 'umidade')
      and min_value is not null
      and max_value is not null
      and min_value < max_value
      and warn_value is null
      and critical_value is null
    )
    or (
      metric = 'co2'
      and min_value is null
      and max_value is null
      and warn_value is not null
      and critical_value is not null
      and warn_value < critical_value
    )
  ),
  constraint alert_thresholds_unit_check check (
    (metric = 'temperatura' and unit = 'C')
    or (metric = 'umidade' and unit = '%')
    or (metric = 'co2' and unit = 'ppm')
  ),
  constraint alert_thresholds_non_negative check (
    (min_value is null or min_value >= 0)
    and (max_value is null or max_value >= 0)
    and (warn_value is null or warn_value >= 0)
    and (critical_value is null or critical_value >= 0)
  ),
  constraint alert_thresholds_room_metric_unique unique (room_id, metric)
);

create table public.sensor_readings (
  id text primary key default extensions.gen_random_uuid()::text,
  sensor_id text not null,
  room_id text not null references public.rooms(id) on delete cascade,
  value numeric(12, 4) not null,
  quality text not null default 'good',
  source text not null,
  source_message_id text,
  recorded_at timestamptz not null default now(),
  constraint sensor_readings_sensor_room_fkey
    foreign key (sensor_id, room_id)
    references public.sensors(id, room_id)
    on delete cascade,
  constraint sensor_readings_quality_check check (quality in ('good', 'degraded', 'bad', 'unknown')),
  constraint sensor_readings_source_check check (source in ('MQTT', 'REST', 'ESP32', 'MOCK'))
);

create table public.alerts (
  id text primary key default extensions.gen_random_uuid()::text,
  level text not null,
  alert_type text not null,
  message text not null,
  room_id text references public.rooms(id) on delete set null,
  sensor_id text references public.sensors(id) on delete set null,
  alert_key text not null,
  acknowledged boolean not null default false,
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  occurred_at timestamptz not null default now(),
  constraint alerts_level_check check (level in ('info', 'atencao', 'critico')),
  constraint alerts_type_check check (alert_type in ('temperatura', 'umidade', 'co2', 'vav', 'incendio')),
  constraint alerts_message_not_blank check (length(btrim(message)) > 0),
  constraint alerts_acknowledged_at_check check (acknowledged or acknowledged_at is null)
);

create table public.bathrooms (
  id text primary key,
  name text not null,
  light_on boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bathrooms_name_not_blank check (length(btrim(name)) > 0)
);

create table public.ntfy_config (
  id text primary key default 'default',
  enabled boolean not null default true,
  server_url text not null default 'https://ntfy.sh',
  topic text not null,
  min_level text not null default 'atencao',
  updated_at timestamptz not null default now(),
  constraint ntfy_config_singleton check (id = 'default'),
  constraint ntfy_config_server_url_not_blank check (length(btrim(server_url)) > 0),
  constraint ntfy_config_topic_not_blank check (length(btrim(topic)) > 0),
  constraint ntfy_config_min_level_check check (min_level in ('atencao', 'critico'))
);

create table public.ntfy_logs (
  id text primary key default extensions.gen_random_uuid()::text,
  alert_id text references public.alerts(id) on delete set null,
  sent_at timestamptz not null default now(),
  url text not null,
  priority text not null,
  title text not null,
  message text not null,
  tags text[] not null default '{}'::text[],
  constraint ntfy_logs_priority_check check (priority in ('urgent', 'high')),
  constraint ntfy_logs_url_not_blank check (length(btrim(url)) > 0),
  constraint ntfy_logs_title_not_blank check (length(btrim(title)) > 0),
  constraint ntfy_logs_message_not_blank check (length(btrim(message)) > 0)
);

create table public.audit_events (
  id text primary key default extensions.gen_random_uuid()::text,
  category text not null,
  description text not null,
  room_id text references public.rooms(id) on delete set null,
  origin text not null default 'sistema',
  occurred_at timestamptz not null default now(),
  constraint audit_events_category_check check (
    category in ('alerta', 'reconhecimento', 'parametro', 'setpoint', 'vav', 'climatizador', 'exaustao', 'registro')
  ),
  constraint audit_events_origin_check check (origin in ('sistema', 'operador', 'dispositivo')),
  constraint audit_events_description_not_blank check (length(btrim(description)) > 0)
);

create table public.identification (
  id text primary key default 'default',
  establishment text not null default '',
  cnes text not null default '',
  system_name text not null default 'Sistema de Automacao HVAC',
  responsible_technician text not null default '',
  professional_registration text not null default '',
  updated_at timestamptz not null default now(),
  constraint identification_singleton check (id = 'default')
);

create index rooms_climatizer_id_idx on public.rooms (climatizer_id);
create index sensors_room_id_idx on public.sensors (room_id);
create index sensor_readings_room_recorded_at_idx
  on public.sensor_readings (room_id, recorded_at desc);
create index sensor_readings_sensor_recorded_at_idx
  on public.sensor_readings (sensor_id, recorded_at desc);
create unique index sensor_readings_source_message_id_idx
  on public.sensor_readings (source_message_id)
  where source_message_id is not null;
create index alerts_room_occurred_at_idx on public.alerts (room_id, occurred_at desc);
create index alerts_occurred_at_idx on public.alerts (occurred_at desc);
create unique index alerts_active_key_idx
  on public.alerts (alert_key)
  where resolved_at is null;
create index ntfy_logs_sent_at_idx on public.ntfy_logs (sent_at desc);
create index audit_events_occurred_at_idx on public.audit_events (occurred_at desc);
create index audit_events_room_occurred_at_idx
  on public.audit_events (room_id, occurred_at desc);

-- Nest uses the server-only service_role key. No browser role gets table access.
grant usage on schema public to service_role;

alter table public.climatizers enable row level security;
alter table public.rooms enable row level security;
alter table public.vavs enable row level security;
alter table public.sensors enable row level security;
alter table public.alert_thresholds enable row level security;
alter table public.sensor_readings enable row level security;
alter table public.alerts enable row level security;
alter table public.bathrooms enable row level security;
alter table public.ntfy_config enable row level security;
alter table public.ntfy_logs enable row level security;
alter table public.audit_events enable row level security;
alter table public.identification enable row level security;

revoke all on public.climatizers, public.rooms, public.vavs, public.sensors,
  public.alert_thresholds, public.sensor_readings, public.alerts, public.bathrooms,
  public.ntfy_config, public.ntfy_logs, public.audit_events, public.identification
  from public, anon, authenticated;

grant select, insert, update, delete on public.climatizers, public.rooms, public.vavs,
  public.sensors, public.alert_thresholds, public.sensor_readings, public.alerts,
  public.bathrooms, public.ntfy_config, public.ntfy_logs, public.audit_events,
  public.identification to service_role;

create policy climatizers_service_role_all on public.climatizers
  for all to service_role using (true) with check (true);
create policy rooms_service_role_all on public.rooms
  for all to service_role using (true) with check (true);
create policy vavs_service_role_all on public.vavs
  for all to service_role using (true) with check (true);
create policy sensors_service_role_all on public.sensors
  for all to service_role using (true) with check (true);
create policy alert_thresholds_service_role_all on public.alert_thresholds
  for all to service_role using (true) with check (true);
create policy sensor_readings_service_role_all on public.sensor_readings
  for all to service_role using (true) with check (true);
create policy alerts_service_role_all on public.alerts
  for all to service_role using (true) with check (true);
create policy bathrooms_service_role_all on public.bathrooms
  for all to service_role using (true) with check (true);
create policy ntfy_config_service_role_all on public.ntfy_config
  for all to service_role using (true) with check (true);
create policy ntfy_logs_service_role_all on public.ntfy_logs
  for all to service_role using (true) with check (true);
create policy audit_events_service_role_all on public.audit_events
  for all to service_role using (true) with check (true);
create policy identification_service_role_all on public.identification
  for all to service_role using (true) with check (true);
