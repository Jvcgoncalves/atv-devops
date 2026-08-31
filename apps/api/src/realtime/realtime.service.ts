import { Injectable } from "@nestjs/common";
import type { EventName, RealtimeEvent, SystemState } from "@hvac/contracts";
import { createRealtimeEnvelope } from "./realtime-event.js";
import type { RealtimeEventData, RealtimeEventListener } from "./realtime.types.js";

@Injectable()
export class RealtimeService {
  private version = 0;
  private readonly listeners = new Set<RealtimeEventListener>();

  subscribe(listener: RealtimeEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  publish<Name extends EventName>(name: Name, data: RealtimeEventData<Name>): RealtimeEvent<Name> {
    const event = this.createEvent(name, data);
    this.notify(event);
    return event;
  }

  snapshot(state: SystemState, broadcast = true): RealtimeEvent<"system.snapshot"> {
    const event = this.createEvent("system.snapshot", { state });
    if (broadcast) this.notify(event);
    return event;
  }

  currentVersion(): number {
    return this.version;
  }

  private createEvent<Name extends EventName>(name: Name, data: RealtimeEventData<Name>): RealtimeEvent<Name> {
    const event = { name, envelope: createRealtimeEnvelope(this.version + 1, data) } as RealtimeEvent<Name>;
    this.version += 1;
    return event;
  }

  private notify(event: RealtimeEvent): void {
    for (const listener of this.listeners) listener(event);
  }
}
