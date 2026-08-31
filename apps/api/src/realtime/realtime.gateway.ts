import { Inject, Logger } from "@nestjs/common";
import { WebSocketGateway, WebSocketServer } from "@nestjs/websockets";
import type { OnGatewayConnection } from "@nestjs/websockets";
import type { Server, Socket } from "socket.io";
import { StateService } from "../state/state.service.js";
import { RealtimeService } from "./realtime.service.js";

@WebSocketGateway({
  namespace: "/realtime",
  cors: { origin: process.env.REALTIME_ALLOWED_ORIGINS?.split(",").map((origin) => origin.trim()) ?? "*" },
})
export class RealtimeGateway implements OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(
    @Inject(RealtimeService) private readonly realtime: RealtimeService,
    @Inject(StateService) private readonly state: StateService,
  ) {}

  onModuleInit(): void {
    this.realtime.subscribe((event) => {
      this.server?.emit(event.name, event.envelope);
    });
  }

  async handleConnection(client: Socket): Promise<void> {
    if (!this.isOriginAllowed(client) || !this.isAuthenticated(client)) {
      client.disconnect(true);
      return;
    }
    try {
      client.emit("system.snapshot", this.realtime.snapshot(await this.state.getState(), false).envelope);
    } catch (error) {
      this.logger.error(error instanceof Error ? error.message : String(error));
      client.disconnect(true);
    }
  }

  private isAuthenticated(client: Socket): boolean {
    const expected = process.env.REALTIME_AUTH_TOKEN;
    if (!expected) return true;
    const authorization = client.handshake.headers.authorization;
    const token = client.handshake.auth?.token ?? (authorization?.startsWith("Bearer ") ? authorization.slice(7) : authorization);
    return token === expected;
  }

  private isOriginAllowed(client: Socket): boolean {
    const configured = process.env.REALTIME_ALLOWED_ORIGINS;
    if (!configured) return true;
    const origin = client.handshake.headers.origin;
    return !origin || configured.split(",").map((item) => item.trim()).includes(origin);
  }
}
