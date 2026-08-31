import { Global, Module } from "@nestjs/common";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_CLIENT } from "./database.tokens.js";
import { SupabaseService } from "./supabase.service.js";
import { HvacRepository } from "./hvac.repository.js";

@Global()
@Module({
  providers: [
    {
      provide: SUPABASE_CLIENT,
      useFactory: () => {
        const url = process.env.SUPABASE_URL;
        const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!url || !key) {
          throw new Error("SUPABASE_URL and SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY are required");
        }
        return createClient(url, key, {
          auth: { autoRefreshToken: false, persistSession: false },
        });
      },
    },
    SupabaseService,
    HvacRepository,
  ],
  exports: [SupabaseService, HvacRepository],
})
export class DatabaseModule {}
