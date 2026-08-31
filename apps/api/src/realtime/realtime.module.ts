import { Global, Module } from "@nestjs/common";
import { StateModule } from "../state/state.module.js";
import { RealtimeGateway } from "./realtime.gateway.js";
import { RealtimeService } from "./realtime.service.js";

@Global()
@Module({
  imports: [StateModule],
  providers: [RealtimeService, RealtimeGateway],
  exports: [RealtimeService],
})
export class RealtimeModule {}
