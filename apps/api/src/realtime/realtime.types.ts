import type { EventEnvelope, EventName, RealtimeEvent, RealtimeEventMap } from "@hvac/contracts";

export type RealtimeEventData<Name extends EventName> = RealtimeEventMap[Name] extends EventEnvelope<infer Data> ? Data : never;

export type RealtimeEventListener = (event: RealtimeEvent) => void;
