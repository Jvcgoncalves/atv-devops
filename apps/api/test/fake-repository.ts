export function createFakeRepository() {
  let sequence = 1;
  const rooms = [
    {
      id: "sala-1",
      name: "Sala 1",
      floor: "1",
      climatizer_id: "clima-1",
      setpoint: 22,
      current_temperature: 22.6,
      current_humidity: 51,
      current_co2: 640,
      last_reading_at: "2026-08-31T12:00:00.000Z",
      telemetry_source: "MQTT",
      updated_at: "2026-08-31T12:00:00.000Z",
    },
    {
      id: "sala-2",
      name: "Sala 2",
      floor: "1",
      climatizer_id: "clima-1",
      setpoint: 23,
      current_temperature: 23.3,
      current_humidity: 50,
      current_co2: 740,
      last_reading_at: "2026-08-31T12:00:00.000Z",
      telemetry_source: "MQTT",
      updated_at: "2026-08-31T12:00:00.000Z",
    },
  ];
  const climatizers = [
    { id: "clima-1", name: "Climatizador A", is_on: true, supply_air_temperature: 15 },
  ];
  const vavs = [
    { id: "vav-1", room_id: "sala-1", state: "ok", opening: 40, airflow: 0, mode: "auto", reason: "estavel" },
    { id: "vav-2", room_id: "sala-2", state: "ok", opening: 40, airflow: 0, mode: "auto", reason: "estavel" },
  ];
  const sensors = [
    { id: "sensor-sala-1-temperatura", room_id: "sala-1", metric: "temperatura", unit: "C", status: "ativo", last_seen_at: null },
    { id: "sensor-sala-1-umidade", room_id: "sala-1", metric: "umidade", unit: "%", status: "ativo", last_seen_at: null },
    { id: "sensor-sala-1-co2", room_id: "sala-1", metric: "co2", unit: "ppm", status: "ativo", last_seen_at: null },
    { id: "sensor-sala-2-temperatura", room_id: "sala-2", metric: "temperatura", unit: "C", status: "ativo", last_seen_at: null },
    { id: "sensor-sala-2-umidade", room_id: "sala-2", metric: "umidade", unit: "%", status: "ativo", last_seen_at: null },
    { id: "sensor-sala-2-co2", room_id: "sala-2", metric: "co2", unit: "ppm", status: "ativo", last_seen_at: null },
  ];
  const thresholds = [
    { id: "threshold-sala-1-temperatura", room_id: "sala-1", metric: "temperatura", min_value: 20, max_value: 26, warn_value: null, critical_value: null, unit: "C" },
    { id: "threshold-sala-1-umidade", room_id: "sala-1", metric: "umidade", min_value: 40, max_value: 60, warn_value: null, critical_value: null, unit: "%" },
    { id: "threshold-sala-1-co2", room_id: "sala-1", metric: "co2", min_value: null, max_value: null, warn_value: 800, critical_value: 1000, unit: "ppm" },
    { id: "threshold-sala-2-temperatura", room_id: "sala-2", metric: "temperatura", min_value: 20, max_value: 26, warn_value: null, critical_value: null, unit: "C" },
    { id: "threshold-sala-2-umidade", room_id: "sala-2", metric: "umidade", min_value: 40, max_value: 60, warn_value: null, critical_value: null, unit: "%" },
    { id: "threshold-sala-2-co2", room_id: "sala-2", metric: "co2", min_value: null, max_value: null, warn_value: 800, critical_value: 1000, unit: "ppm" },
  ];
  const bathrooms = [
    { id: "ban-1", name: "Banheiro 1", light_on: false },
    { id: "ban-2", name: "Banheiro 2", light_on: false },
  ];
  const alerts = [];
  const readings = [];
  const auditEvents = [];
  const ntfyLogs = [];
  const seenMessages = new Set();
  let ntfyConfig = { id: "default", enabled: true, server_url: "https://ntfy.sh", topic: "tcc-hvac-alertas", min_level: "atencao" };
  let identification = { id: "default", establishment: "", cnes: "", system_name: "Sistema de Automacao HVAC", responsible_technician: "", professional_registration: "" };

  const copy = (value) => structuredClone(value);
  const nextId = (prefix) => `${prefix}-${sequence++}`;
  const findRoom = (id) => rooms.find((room) => room.id === id) ?? null;
  const findSensor = (roomId, metric) => sensors.find((sensor) => sensor.room_id === roomId && sensor.metric === metric) ?? null;

  const repository = {
    listClimatizers: async () => copy(climatizers),
    findClimatizer: async (id) => copy(climatizers.find((row) => row.id === id) ?? null),
    updateClimatizer: async (id, patch) => {
      const row = findOrThrow(climatizers, id, "climatizer");
      Object.assign(row, patch);
      return copy(row);
    },
    listRooms: async () => copy(rooms),
    findRoom: async (id) => copy(findRoom(id)),
    updateRoom: async (id, patch) => {
      const row = findOrThrow(rooms, id, "room");
      Object.assign(row, patch);
      return copy(row);
    },
    listVavs: async () => copy(vavs),
    findVavByRoom: async (roomId) => copy(vavs.find((row) => row.room_id === roomId) ?? null),
    updateVav: async (roomId, patch) => {
      const row = vavs.find((item) => item.room_id === roomId);
      if (!row) throw new Error("vav not found");
      Object.assign(row, patch);
      return copy(row);
    },
    listSensors: async (roomId) => copy(roomId ? sensors.filter((row) => row.room_id === roomId) : sensors),
    listThresholds: async (roomId) => copy(roomId ? thresholds.filter((row) => row.room_id === roomId) : thresholds),
    upsertThresholds: async (roomId, next) => {
      const values = [
        ["temperatura", { min_value: next.temperatura.min, max_value: next.temperatura.max, warn_value: null, critical_value: null, unit: "C" }],
        ["umidade", { min_value: next.umidade.min, max_value: next.umidade.max, warn_value: null, critical_value: null, unit: "%" }],
        ["co2", { min_value: null, max_value: null, warn_value: next.co2.warn, critical_value: next.co2.critical, unit: "ppm" }],
      ];
      for (const [metric, patch] of values) {
        const row = thresholds.find((item) => item.room_id === roomId && item.metric === metric);
        Object.assign(row, patch);
      }
      return copy(thresholds.filter((row) => row.room_id === roomId));
    },
    listBathrooms: async () => copy(bathrooms),
    findBathroom: async (id) => copy(bathrooms.find((row) => row.id === id) ?? null),
    updateBathroom: async (id, lightOn) => {
      const row = findOrThrow(bathrooms, id, "bathroom");
      row.light_on = lightOn;
      return copy(row);
    },
    listAlerts: async () => copy(alerts),
    findAlert: async (id) => copy(alerts.find((row) => row.id === id) ?? null),
    findActiveAlertByKey: async (key) => copy(alerts.find((row) => row.alert_key === key && row.resolved_at == null) ?? null),
    insertAlert: async (input) => {
      const row = { ...input, id: input.id ?? nextId("alert") };
      alerts.push(row);
      return copy(row);
    },
    acknowledgeAlert: async (id) => {
      const row = findOrThrow(alerts, id, "alert");
      row.acknowledged = true;
      row.acknowledged_at = new Date().toISOString();
      return copy(row);
    },
    deleteAcknowledgedAlerts: async () => {
      const removed = alerts.filter((row) => row.acknowledged);
      while (alerts.some((row) => row.acknowledged)) alerts.splice(alerts.findIndex((row) => row.acknowledged), 1);
      return copy(removed);
    },
    listReadings: async (roomId, metric) => {
      const sensor = findSensor(roomId, metric);
      return copy(readings.filter((row) => row.sensor_id === sensor?.id).sort((a, b) => a.recorded_at.localeCompare(b.recorded_at)));
    },
    persistTelemetry: async (input) => {
      const room = findOrThrow(rooms, input.roomId, "room");
      Object.assign(room, {
        last_reading_at: input.recordedAt,
        telemetry_source: input.source,
        ...(input.values.temperatura == null ? {} : { current_temperature: input.values.temperatura }),
        ...(input.values.umidade == null ? {} : { current_humidity: input.values.umidade }),
        ...(input.values.co2 == null ? {} : { current_co2: input.values.co2 }),
      });
      const ids = [];
      let duplicate = false;
      for (const metric of ["temperatura", "umidade", "co2"]) {
        const value = input.values[metric];
        const sensor = findSensor(input.roomId, metric);
        if (value == null || !sensor) continue;
        const messageId = input.sourceMessageId ? `${input.sourceMessageId}:${metric}` : null;
        if (messageId && seenMessages.has(messageId)) {
          duplicate = true;
          continue;
        }
        if (messageId) seenMessages.add(messageId);
        const id = nextId("reading");
        readings.push({ id, sensor_id: sensor.id, room_id: input.roomId, value, quality: input.quality, source: input.source, source_message_id: messageId, recorded_at: input.recordedAt });
        ids.push(id);
      }
      return { ids, duplicate: duplicate && ids.length === 0 };
    },
    getNtfyConfig: async () => copy(ntfyConfig),
    updateNtfyConfig: async (patch) => {
      ntfyConfig = { ...ntfyConfig, ...patch };
      return copy(ntfyConfig);
    },
    listNtfyLogs: async () => copy(ntfyLogs),
    insertNtfyLog: async (input) => {
      const row = { ...input, id: input.id ?? nextId("ntfy") };
      ntfyLogs.push(row);
      return copy(row);
    },
    listAuditEvents: async () => copy(auditEvents),
    insertAuditEvent: async (input) => {
      const row = { id: nextId("event"), description: input.description, category: input.category, room_id: input.roomId ?? null, origin: input.origin ?? "sistema", occurred_at: new Date().toISOString() };
      auditEvents.unshift(row);
      return copy(row);
    },
    getIdentification: async () => copy(identification),
    updateIdentification: async (patch) => {
      identification = { ...identification, ...patch };
      return copy(identification);
    },
    toAlertRow: (alert) => ({ level: alert.level, alert_type: alert.tipo, message: alert.mensagem, room_id: alert.salaId, sensor_id: null, alert_key: alert.key, acknowledged: alert.reconhecido, acknowledged_at: null, resolved_at: null, occurred_at: alert.ts }),
  };

  return { repository, rooms, climatizers, vavs, bathrooms, thresholds, sensors, readings, alerts, auditEvents, ntfyLogs };
}

function findOrThrow(rows, id, name) {
  const row = rows.find((item) => item.id === id);
  if (!row) throw new Error(`${name} not found`);
  return row;
}
