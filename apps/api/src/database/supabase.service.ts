import { Inject, Injectable } from "@nestjs/common";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_CLIENT } from "./database.tokens.js";

@Injectable()
export class SupabaseService {
  constructor(@Inject(SUPABASE_CLIENT) private readonly client: SupabaseClient) {}

  getClient(): SupabaseClient {
    return this.client;
  }
}
