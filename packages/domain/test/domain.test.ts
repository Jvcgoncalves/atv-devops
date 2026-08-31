import assert from "node:assert/strict";
import test from "node:test";
import {
  STATUS,
  calculateCoolingDemand,
  calculateExhaustState,
  calculateNextVavOpening,
  calculateRoomStatus,
  calculateVavTarget,
  calculateVentilationDemand,
  clamp,
  evaluateRoomAlerts,
  filterNewAlerts,
  getAlertKey,
  getAlertLevelRank,
  getCo2Status,
  getDefaultThresholds,
  getHumidityStatus,
  getTemperatureStatus,
  getVavReason,
  getWorstStatus,
  hasAlertCooldownElapsed,
  isExhaustOn,
  isVavSetpointReachable,
  mapMqttMessage,
  mapMqttPayloadToTelemetry,
  normalizeRoomId,
  normalizeRoomThresholds,
  normalizeTelemetryPayload,
  normalizeThresholds,
  parseMqttRoomId,
  shouldNotifyAlert,
  toFiniteNumber,
  validateThresholds,
} from "../src/index.ts";

const thresholds = getDefaultThresholds();

function room(overrides = {}) {
  return {
    id: "sala-1",
    nome: "Sala 1",
    setpoint: 22,
    temperatura: 22,
    umidade: 50,
    co2: 500,
    vav: { estado: "ok" },
    ...overrides,
  };
}

test("threshold defaults are fresh and normalize numeric values", () => {
  const first = getDefaultThresholds();
  const second = getDefaultThresholds();
  first.temperatura.min = 99;
  assert.equal(second.temperatura.min, 20);
  assert.deepEqual(normalizeThresholds({ temperatura: { min: "21" }, co2: { critical: "bad" } }), {
    temperatura: { min: 21, max: 26, unit: "C" },
    umidade: { min: 40, max: 60, unit: "%" },
    co2: { warn: 800, critical: 1000, unit: "ppm" },
  });
  assert.deepEqual(normalizeThresholds(null), getDefaultThresholds());
  assert.deepEqual(normalizeRoomThresholds({}, thresholds), thresholds);
  assert.equal(validateThresholds(thresholds), true);
  assert.equal(validateThresholds(null), false);
  assert.equal(validateThresholds({ temperatura: {}, umidade: {}, co2: {} }), false);
  assert.equal(validateThresholds({
    temperatura: { min: 20, max: 20 },
    umidade: { min: 40, max: 60 },
    co2: { warn: 800, critical: 1000 },
  }), false);
  assert.equal(validateThresholds({
    temperatura: { min: -1, max: 26 },
    umidade: { min: 40, max: 60 },
    co2: { warn: 800, critical: 1000 },
  }), false);
});

test("normalization handles IDs, partial telemetry and invalid input", () => {
  assert.equal(clamp(150, 0, 100), 100);
  assert.equal(clamp(-1, 0, 100), 0);
  assert.equal(clamp("bad", 5, 10), 5);
  assert.equal(toFiniteNumber("22.5"), 22.5);
  assert.equal(toFiniteNumber("bad"), null);
  assert.equal(normalizeRoomId("sala-2"), "sala-2");
  assert.equal(normalizeRoomId(3), "sala-3");
  assert.equal(normalizeRoomId("  "), null);
  assert.deepEqual(normalizeTelemetryPayload({ roomId: 2, temperatura: "22.5", co2: 700 }), {
    salaId: "sala-2",
    temperatura: 22.5,
    co2: 700,
  });
  assert.equal(normalizeTelemetryPayload(null), null);
  assert.equal(normalizeTelemetryPayload({ salaId: "sala-1" }), null);
  assert.equal(normalizeTelemetryPayload({ salaId: "sala-1", umidade: "bad" }), null);
});

test("status functions preserve threshold semantics and worst status ordering", () => {
  assert.equal(getTemperatureStatus(20, thresholds), STATUS.ATENCAO);
  assert.equal(getTemperatureStatus(21, thresholds), STATUS.NORMAL);
  assert.equal(getTemperatureStatus(26, thresholds), STATUS.ATENCAO);
  assert.equal(getTemperatureStatus(27, thresholds), STATUS.CRITICO);
  assert.equal(getTemperatureStatus("bad", thresholds), STATUS.CRITICO);
  assert.equal(getHumidityStatus(40, thresholds), STATUS.ATENCAO);
  assert.equal(getHumidityStatus(45, thresholds), STATUS.NORMAL);
  assert.equal(getHumidityStatus(60, thresholds), STATUS.ATENCAO);
  assert.equal(getHumidityStatus(61, thresholds), STATUS.CRITICO);
  assert.equal(getCo2Status(799, thresholds), STATUS.NORMAL);
  assert.equal(getCo2Status(800, thresholds), STATUS.ATENCAO);
  assert.equal(getCo2Status(1000, thresholds), STATUS.CRITICO);
  assert.equal(getCo2Status("bad", thresholds), STATUS.CRITICO);
  assert.deepEqual(calculateRoomStatus(room({ temperatura: 27, co2: 800 }), thresholds), {
    temperatura: STATUS.CRITICO,
    umidade: STATUS.NORMAL,
    co2: STATUS.ATENCAO,
  });
  assert.equal(getWorstStatus({ temperatura: STATUS.CRITICO }), STATUS.CRITICO);
  assert.equal(getWorstStatus({ temperatura: STATUS.ATENCAO }), STATUS.ATENCAO);
  assert.equal(getWorstStatus({}), STATUS.NORMAL);
});

test("VAV target uses maximum cooling or ventilation demand", () => {
  const climatizer = { ligado: true, tempInsuflamento: 15 };
  assert.equal(calculateCoolingDemand(room({ temperatura: 22 }), climatizer), 40);
  assert.equal(calculateCoolingDemand(room({ temperatura: 30 }), climatizer), 100);
  assert.equal(calculateCoolingDemand(room(), { ligado: false }), 0);
  assert.equal(calculateVentilationDemand(1000, thresholds), 100);
  assert.equal(calculateVentilationDemand(900, thresholds), 75);
  assert.equal(calculateVentilationDemand(400, thresholds), 10);
  assert.equal(calculateVentilationDemand(900, { co2: { warn: 800, critical: 800 } }), 100);
  assert.equal(calculateVentilationDemand("bad", thresholds), 0);

  const ventilation = calculateVavTarget(room({ co2: 900 }), climatizer, thresholds);
  assert.equal(ventilation.target, 75);
  assert.equal(ventilation.motivo, "ventilacao");
  assert.equal(getVavReason(room({ temperatura: 23 }), climatizer, 100, 20), "resfriamento");
  assert.equal(getVavReason(room(), climatizer, 5, 5), "estavel");
  assert.equal(getVavReason(room(), { ligado: false }, 0, 10), "sem_frio");
  assert.equal(calculateNextVavOpening(40, 100), 61);
  assert.equal(calculateNextVavOpening(-10, 120, 2), 100);
  assert.equal(calculateNextVavOpening(40, 100, "bad"), 40);
  assert.equal(isVavSetpointReachable(20, climatizer), true);
  assert.equal(isVavSetpointReachable(14, climatizer), false);
  assert.equal(isVavSetpointReachable(20, { ligado: false }), false);
  assert.equal(isVavSetpointReachable("bad", climatizer), false);
});

test("bathroom lights calculate exhaust with OR semantics", () => {
  const off = [{ luz: false }, { luz: false }];
  const on = [{ luz: false }, { luz: true }];
  assert.equal(isExhaustOn(off), false);
  assert.equal(isExhaustOn(on), true);
  assert.deepEqual(calculateExhaustState(on), { ligada: true, logica: "OR" });
  assert.deepEqual(calculateExhaustState(), { ligada: false, logica: "OR" });
});

test("alerts calculate messages, notification rank and dedup keys", () => {
  assert.equal(getAlertLevelRank("info"), 0);
  assert.equal(getAlertLevelRank("atencao"), 1);
  assert.equal(getAlertLevelRank("critico"), 2);
  assert.equal(shouldNotifyAlert("critico", "atencao"), true);
  assert.equal(shouldNotifyAlert("info", "critico"), false);
  assert.equal(getAlertKey({ salaId: "sala-1", tipo: "co2", level: "atencao" }), "sala-1:co2:atencao");

  const alerts = evaluateRoomAlerts(room({ temperatura: 27, umidade: 39, co2: 900, vav: { estado: "falha" } }), thresholds);
  assert.deepEqual(alerts.map(({ tipo, level }) => `${tipo}:${level}`), [
    "temperatura:critico",
    "umidade:critico",
    "co2:atencao",
    "vav:critico",
  ]);
  assert.match(alerts[0].mensagem, /Sala 1: temperatura 27\.0C/);
  assert.equal(evaluateRoomAlerts(room({ co2: 1100 }), thresholds)[0].level, "critico");
  assert.deepEqual(filterNewAlerts(alerts, new Set([alerts[0].key])).length, 3);
  assert.deepEqual(filterNewAlerts(alerts, [alerts[0].key]).length, 3);
  assert.equal(hasAlertCooldownElapsed(null, 0), true);
  assert.equal(hasAlertCooldownElapsed("invalid", 0), true);
  assert.equal(hasAlertCooldownElapsed(new Date(0).toISOString(), 30000), false);
  assert.equal(hasAlertCooldownElapsed(new Date(0).toISOString(), 60000), true);
});

test("MQTT mapping supports documented, legacy and malformed payloads", () => {
  assert.equal(parseMqttRoomId("hvac/sala/1/telemetria"), "sala-1");
  assert.equal(parseMqttRoomId("tcc-hvac-kaue/airquality"), null);
  assert.deepEqual(mapMqttPayloadToTelemetry({
    topic: "hvac/sala/2/telemetria",
    payload: { temperatura: "22.6", umidade: 51, co2: 720 },
  }), { salaId: "sala-2", temperatura: 22.6, umidade: 51, co2: 720 });
  assert.deepEqual(mapMqttPayloadToTelemetry({
    topic: "legacy/airquality",
    payload: Buffer.from('{"temperature":23,"humidity":52,"co2":800}'),
    defaultRoomId: 3,
  }), { salaId: "sala-3", temperatura: 23, umidade: 52, co2: 800 });
  assert.deepEqual(mapMqttMessage("hvac/sala/4/telemetria", '{"temperature":24}'), {
    salaId: "sala-4",
    temperatura: 24,
  });
  assert.equal(mapMqttPayloadToTelemetry({ topic: "hvac/sala/1/telemetria", payload: "bad" }), null);
  assert.equal(mapMqttPayloadToTelemetry({ topic: "hvac/sala/1/telemetria", payload: {} }), null);
  assert.equal(mapMqttPayloadToTelemetry({ payload: { co2: "bad" }, defaultRoomId: 1 }), null);
  assert.equal(mapMqttPayloadToTelemetry({ payload: { co2: 700 } }), null);
});
