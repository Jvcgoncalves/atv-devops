export { STATUS, calculateRoomStatus, getCo2Status, getHumidityStatus, getTemperatureStatus, getWorstStatus } from "./functions/status.ts";
export { getDefaultThresholds, normalizeThresholds, validateThresholds } from "./functions/thresholds.ts";
export { clamp, normalizeRoomId, normalizeRoomThresholds, normalizeTelemetryPayload, toFiniteNumber } from "./functions/normalization.ts";
export {
  calculateCoolingDemand,
  calculateNextVavOpening,
  calculateVavTarget,
  calculateVentilationDemand,
  getVavReason,
  isVavSetpointReachable,
} from "./functions/vav.ts";
export { calculateExhaustState, isExhaustOn } from "./functions/exhaust.ts";
export {
  evaluateRoomAlerts,
  filterNewAlerts,
  getAlertKey,
  getAlertLevelRank,
  hasAlertCooldownElapsed,
  shouldNotifyAlert,
} from "./functions/alerts.ts";
export { mapMqttMessage, mapMqttPayloadToTelemetry, parseMqttRoomId } from "./functions/mqtt.ts";
