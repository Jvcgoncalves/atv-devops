import { randomUUID } from "node:crypto";
import type { EventEnvelope, EventName } from "@hvac/contracts";
import type { RealtimeEventData } from "./realtime.types.js";

export function createRealtimeEnvelope<Name extends EventName>(version: number, data: RealtimeEventData<Name>): EventEnvelope<RealtimeEventData<Name>> {
  return {
    eventId: randomUUID(),
    version,
    occurredAt: new Date().toISOString(),
    data,
  };
}
