import assert from "node:assert/strict";
import test from "node:test";
import { HvacRepository } from "../src/database/hvac.repository.js";

function createSupabaseDouble() {
  const tables = {
    rooms: [{ id: "sala-1", current_temperature: 22, current_humidity: 50, current_co2: 600, telemetry_source: "REST", last_reading_at: null }],
    sensors: [
      { id: "sensor-temp", room_id: "sala-1", metric: "temperatura", unit: "C", status: "inativo", last_seen_at: null },
      { id: "sensor-co2", room_id: "sala-1", metric: "co2", unit: "ppm", status: "inativo", last_seen_at: null },
    ],
    sensor_readings: [],
  };
  const copy = (value) => structuredClone(value);
  const execute = (state) => {
    let rows = tables[state.table].filter((row) => state.filters.every(([key, operator, value]) => operator === "eq" ? row[key] === value : row[key] === null));
    if (state.operation === "update") {
      rows.forEach((row) => Object.assign(row, state.payload));
    } else if (state.operation === "insert") {
      const values = Array.isArray(state.payload) ? state.payload : [state.payload];
      tables[state.table].push(...values.map(copy));
      rows = values;
    } else if (state.operation === "delete") {
      tables[state.table] = tables[state.table].filter((row) => !rows.includes(row));
    }
    if (state.order) rows.sort((a, b) => state.order.ascending ? String(a[state.order.column]).localeCompare(String(b[state.order.column])) : String(b[state.order.column]).localeCompare(String(a[state.order.column])));
    if (state.limit) rows = rows.slice(0, state.limit);
    const data = state.single ? (rows[0] ?? null) : rows;
    return { data: copy(data), error: null };
  };
  return {
    tables,
    from(table) {
      const state = { table, operation: "select", filters: [], order: null, limit: null, payload: null, single: false };
      const builder = {
        select: () => builder,
        eq: (key, value) => { state.filters.push([key, "eq", value]); return builder; },
        is: (key) => { state.filters.push([key, "is", null]); return builder; },
        order: (column, options = {}) => { state.order = { column, ascending: options.ascending !== false }; return builder; },
        limit: (value) => { state.limit = value; return builder; },
        update: (payload) => { state.operation = "update"; state.payload = payload; return builder; },
        insert: (payload) => { state.operation = "insert"; state.payload = payload; return builder; },
        delete: () => { state.operation = "delete"; return builder; },
        single: () => { state.single = true; return builder; },
        maybeSingle: () => { state.single = true; return builder; },
        then: (resolve, reject) => Promise.resolve(execute(state)).then(resolve, reject),
      };
      return builder;
    },
  };
}

test("HvacRepository persists telemetry with snake_case fields and updates sensor last-seen", async () => {
  const supabase = createSupabaseDouble();
  const repository = new HvacRepository({ getClient: () => supabase });
  const result = await repository.persistTelemetry({ roomId: "sala-1", values: { temperatura: 24, co2: 900 }, source: "MQTT", quality: "good", recordedAt: "2026-08-31T12:01:00.000Z", sourceMessageId: "mqtt-1" });

  assert.equal(result.ids.length, 2);
  assert.equal(supabase.tables.rooms[0].current_temperature, 24);
  assert.equal(supabase.tables.rooms[0].current_co2, 900);
  assert.equal(supabase.tables.sensors[0].status, "ativo");
  assert.equal(supabase.tables.sensor_readings[0].source_message_id, "mqtt-1:temperatura");
});

test("HvacRepository detects duplicate source message IDs", async () => {
  const supabase = createSupabaseDouble();
  const repository = new HvacRepository({ getClient: () => supabase });
  const input = { roomId: "sala-1", values: { temperatura: 24 }, source: "MQTT", quality: "good", recordedAt: "2026-08-31T12:01:00.000Z", sourceMessageId: "mqtt-1" };
  const first = await repository.persistTelemetry(input);
  const second = await repository.persistTelemetry({ ...input, recordedAt: "2026-08-31T12:02:00.000Z" });

  assert.equal(first.duplicate, false);
  assert.equal(second.duplicate, true);
  assert.equal(supabase.tables.sensor_readings.length, 1);
  assert.equal(supabase.tables.rooms[0].last_reading_at, "2026-08-31T12:01:00.000Z");
});

test("HvacRepository returns history oldest-first after bounded newest query", async () => {
  const supabase = createSupabaseDouble();
  supabase.tables.sensor_readings.push(
    { id: "r-2", sensor_id: "sensor-temp", room_id: "sala-1", value: 24, recorded_at: "2026-08-31T12:02:00.000Z" },
    { id: "r-1", sensor_id: "sensor-temp", room_id: "sala-1", value: 23, recorded_at: "2026-08-31T12:01:00.000Z" },
  );
  const repository = new HvacRepository({ getClient: () => supabase });
  const rows = await repository.listReadings("sala-1", "temperatura");
  assert.deepEqual(rows.map((row) => row.id), ["r-1", "r-2"]);
});

test("HvacRepository records Supabase errors for operational monitoring", async () => {
  const failure = new Error("database unavailable");
  const operations = { recordDatabaseError: (error) => operations.errors.push(error), errors: [] };
  const repository = new HvacRepository({
    getClient: () => ({
      from: () => ({
        select: () => ({
          order: () => Promise.resolve({ data: null, error: failure }),
        }),
      }),
    }),
  }, operations);

  await assert.rejects(() => repository.listRooms(), /database unavailable/);
  assert.deepEqual(operations.errors, [failure]);
});
