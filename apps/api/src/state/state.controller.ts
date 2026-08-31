import { Controller, Get, Inject } from "@nestjs/common";
import type { SystemState } from "@hvac/contracts";
import { StateService } from "./state.service.js";

@Controller("estado")
export class StateController {
  constructor(@Inject(StateService) private readonly state: StateService) {}

  @Get()
  getState(): Promise<SystemState> {
    return this.state.getState();
  }
}
