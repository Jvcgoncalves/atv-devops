-- Development-only seed. Never use as production data migration.

begin;

insert into public.climatizers (id, name, is_on, supply_air_temperature)
values
  ('clima-1', 'Climatizador A', true, 15),
  ('clima-2', 'Climatizador B', true, 15)
on conflict (id) do update set
  name = excluded.name,
  is_on = excluded.is_on,
  supply_air_temperature = excluded.supply_air_temperature,
  updated_at = now();

insert into public.rooms (
  id, name, floor, climatizer_id, setpoint, current_temperature,
  current_humidity, current_co2, last_reading_at, telemetry_source
)
values
  ('sala-1', 'Sala 1', '1', 'clima-1', 22, 22.6, 51, 640, now(), 'MQTT'),
  ('sala-2', 'Sala 2', '1', 'clima-1', 23, 23.3, 50, 740, now(), 'MQTT'),
  ('sala-3', 'Sala 3', '1', 'clima-2', 23, 23.1, 49, 840, now(), 'MQTT'),
  ('sala-4', 'Sala 4', '1', 'clima-2', 24, 23.8, 52, 940, now(), 'MQTT')
on conflict (id) do update set
  name = excluded.name,
  floor = excluded.floor,
  climatizer_id = excluded.climatizer_id,
  setpoint = excluded.setpoint,
  current_temperature = excluded.current_temperature,
  current_humidity = excluded.current_humidity,
  current_co2 = excluded.current_co2,
  last_reading_at = excluded.last_reading_at,
  telemetry_source = excluded.telemetry_source,
  updated_at = now();

insert into public.vavs (id, room_id, state, opening, airflow, mode, reason)
values
  ('vav-1', 'sala-1', 'ok', 40, 0, 'auto', 'estavel'),
  ('vav-2', 'sala-2', 'ok', 40, 0, 'auto', 'estavel'),
  ('vav-3', 'sala-3', 'ok', 40, 0, 'auto', 'estavel'),
  ('vav-4', 'sala-4', 'ok', 40, 0, 'auto', 'estavel')
on conflict (id) do update set
  room_id = excluded.room_id,
  state = excluded.state,
  opening = excluded.opening,
  airflow = excluded.airflow,
  mode = excluded.mode,
  reason = excluded.reason,
  updated_at = now();

insert into public.sensors (id, room_id, metric, unit, status, last_seen_at)
values
  ('sensor-sala-1-temperatura', 'sala-1', 'temperatura', 'C', 'ativo', now()),
  ('sensor-sala-1-umidade', 'sala-1', 'umidade', '%', 'ativo', now()),
  ('sensor-sala-1-co2', 'sala-1', 'co2', 'ppm', 'ativo', now()),
  ('sensor-sala-2-temperatura', 'sala-2', 'temperatura', 'C', 'ativo', now()),
  ('sensor-sala-2-umidade', 'sala-2', 'umidade', '%', 'ativo', now()),
  ('sensor-sala-2-co2', 'sala-2', 'co2', 'ppm', 'ativo', now()),
  ('sensor-sala-3-temperatura', 'sala-3', 'temperatura', 'C', 'ativo', now()),
  ('sensor-sala-3-umidade', 'sala-3', 'umidade', '%', 'ativo', now()),
  ('sensor-sala-3-co2', 'sala-3', 'co2', 'ppm', 'ativo', now()),
  ('sensor-sala-4-temperatura', 'sala-4', 'temperatura', 'C', 'ativo', now()),
  ('sensor-sala-4-umidade', 'sala-4', 'umidade', '%', 'ativo', now()),
  ('sensor-sala-4-co2', 'sala-4', 'co2', 'ppm', 'ativo', now())
on conflict (id) do update set
  room_id = excluded.room_id,
  metric = excluded.metric,
  unit = excluded.unit,
  status = excluded.status,
  last_seen_at = excluded.last_seen_at;

insert into public.alert_thresholds (
  id, room_id, metric, min_value, max_value, warn_value, critical_value, unit
)
values
  ('threshold-sala-1-temperatura', 'sala-1', 'temperatura', 20, 26, null, null, 'C'),
  ('threshold-sala-1-umidade', 'sala-1', 'umidade', 40, 60, null, null, '%'),
  ('threshold-sala-1-co2', 'sala-1', 'co2', null, null, 800, 1000, 'ppm'),
  ('threshold-sala-2-temperatura', 'sala-2', 'temperatura', 20, 26, null, null, 'C'),
  ('threshold-sala-2-umidade', 'sala-2', 'umidade', 40, 60, null, null, '%'),
  ('threshold-sala-2-co2', 'sala-2', 'co2', null, null, 800, 1000, 'ppm'),
  ('threshold-sala-3-temperatura', 'sala-3', 'temperatura', 20, 26, null, null, 'C'),
  ('threshold-sala-3-umidade', 'sala-3', 'umidade', 40, 60, null, null, '%'),
  ('threshold-sala-3-co2', 'sala-3', 'co2', null, null, 800, 1000, 'ppm'),
  ('threshold-sala-4-temperatura', 'sala-4', 'temperatura', 20, 26, null, null, 'C'),
  ('threshold-sala-4-umidade', 'sala-4', 'umidade', 40, 60, null, null, '%'),
  ('threshold-sala-4-co2', 'sala-4', 'co2', null, null, 800, 1000, 'ppm')
on conflict (id) do update set
  room_id = excluded.room_id,
  metric = excluded.metric,
  min_value = excluded.min_value,
  max_value = excluded.max_value,
  warn_value = excluded.warn_value,
  critical_value = excluded.critical_value,
  unit = excluded.unit,
  updated_at = now();

insert into public.bathrooms (id, name, light_on)
values
  ('ban-1', 'Banheiro 1', false),
  ('ban-2', 'Banheiro 2', false)
on conflict (id) do update set
  name = excluded.name,
  light_on = excluded.light_on,
  updated_at = now();

-- 60 deterministic points per room/metric keeps history screens useful after reset.
insert into public.sensor_readings (
  id, sensor_id, room_id, value, quality, source, source_message_id, recorded_at
)
select
  format('reading-%s-%s-%s', sensors.room_id, sensors.metric, lpad(samples.sample_no::text, 2, '0')),
  sensors.id,
  sensors.room_id,
  case sensors.metric
    when 'temperatura' then
      case sensors.room_id
        when 'sala-1' then 22.4
        when 'sala-2' then 23.1
        when 'sala-3' then 22.9
        else 23.6
      end + ((samples.sample_no % 5) - 2) * 0.1
    when 'umidade' then
      case sensors.room_id
        when 'sala-1' then 50
        when 'sala-2' then 49
        when 'sala-3' then 48
        else 51
      end + ((samples.sample_no % 5) - 2) * 0.5
    else
      case sensors.room_id
        when 'sala-1' then 600
        when 'sala-2' then 700
        when 'sala-3' then 800
        else 900
      end + ((samples.sample_no % 6) - 3) * 20
  end,
  'good',
  'MQTT',
  format('seed-%s-%s-%s', sensors.room_id, sensors.metric, samples.sample_no),
  now() - make_interval(mins => 3 * (59 - samples.sample_no))
from public.sensors
cross join generate_series(0, 59) as samples(sample_no)
on conflict (id) do update set
  sensor_id = excluded.sensor_id,
  room_id = excluded.room_id,
  value = excluded.value,
  quality = excluded.quality,
  source = excluded.source,
  source_message_id = excluded.source_message_id,
  recorded_at = excluded.recorded_at;

insert into public.ntfy_config (id, enabled, server_url, topic, min_level)
values ('default', true, 'https://ntfy.sh', 'tcc-hvac-alertas', 'atencao')
on conflict (id) do update set
  enabled = excluded.enabled,
  server_url = excluded.server_url,
  topic = excluded.topic,
  min_level = excluded.min_level,
  updated_at = now();

insert into public.identification (
  id, establishment, cnes, system_name, responsible_technician, professional_registration
)
values ('default', '', '', 'Sistema de Automacao HVAC', '', '')
on conflict (id) do update set
  establishment = excluded.establishment,
  cnes = excluded.cnes,
  system_name = excluded.system_name,
  responsible_technician = excluded.responsible_technician,
  professional_registration = excluded.professional_registration,
  updated_at = now();

insert into public.audit_events (id, category, description, room_id, origin, occurred_at)
values ('ev-1', 'registro', 'Sistema de supervisao iniciado', null, 'sistema', now())
on conflict (id) do update set
  category = excluded.category,
  description = excluded.description,
  room_id = excluded.room_id,
  origin = excluded.origin,
  occurred_at = excluded.occurred_at;

commit;
