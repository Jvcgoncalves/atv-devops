import { Inject, Injectable, Optional } from "@nestjs/common";
import type { SupabaseClient } from "@supabase/supabase-js";
import { OperationsService } from "../operations/operations.service.js";
import { SUPABASE_CLIENT } from "./database.tokens.js";

@Injectable()
export class SupabaseService {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly client: SupabaseClient,
    @Optional() @Inject(OperationsService) private readonly operations?: OperationsService,
  ) {}

  getClient(): SupabaseClient {
    return this.client;
  }

  async checkConnection(): Promise<boolean> {
    try {
      const { error } = await this.client.from("rooms").select("id").limit(1);
      if (error) {
        this.operations?.recordDatabaseError(error);
        return false;
      }
      return true;
    } catch (error) {
      this.operations?.recordDatabaseError(error);
      return false;
    }
  }
}
