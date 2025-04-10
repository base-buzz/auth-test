/**
 * src/lib/supabase.ts
 *
 * Initializes and exports the Supabase client instance for server-side operations.
 * Uses environment variables for configuration.
 */
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { logToServer } from "@/lib/logger";
import { z } from "zod";

// Zod schema for environment variables validation
const envSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string(),
});

let env:
  | undefined
  | { SUPABASE_URL: string; SUPABASE_SERVICE_ROLE_KEY: string } = undefined;

try {
  env = envSchema.parse({
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });
} catch (error) {
  console.error(
    "Error parsing Supabase environment variables:",
    error instanceof z.ZodError ? error.errors : error
  );
  // Decide how to handle this error. Throwing here might break builds.
  // Consider providing default/dummy values or logging a more severe warning.
}

if (!env?.SUPABASE_URL || !env?.SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    "Supabase URL or Service Role Key is missing. Check .env.local and Zod validation."
  );
  // Depending on your app's needs, you might throw an error here
  // or allow the app to continue with Supabase features disabled.
}

let supabaseAdmin: SupabaseClient | null = null;

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  logToServer(
    "ERROR",
    "Supabase Init Error: SUPABASE_URL environment variable not set."
  );
  // Consider throwing an error here to prevent startup if Supabase is critical
  // throw new Error("SUPABASE_URL not set");
}
if (!supabaseServiceRoleKey) {
  logToServer(
    "ERROR",
    "Supabase Init Error: SUPABASE_SERVICE_ROLE_KEY environment variable not set."
  );
  // Consider throwing an error here
  // throw new Error("SUPABASE_SERVICE_ROLE_KEY not set");
}

if (supabaseUrl && supabaseServiceRoleKey) {
  try {
    supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        // Required options for server-side admin client
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    logToServer("INFO", "Supabase admin client initialized successfully.");
  } catch (error) {
    logToServer("ERROR", "Supabase Init Error: Failed to create client", {
      error,
    });
    // Handle client creation error (e.g., invalid URL/key format)
  }
} else {
  logToServer(
    "WARN",
    "Supabase admin client not initialized due to missing env vars."
  );
}

/**
 * The initialized Supabase admin client instance.
 * Use this for server-side database operations requiring elevated privileges.
 * IMPORTANT: Never expose this client or the service role key to the browser.
 */
export { supabaseAdmin };

// Function to get a client-side Supabase client (if needed)
// This would typically use the anon key.
// Add the anon key to your .env.local if you need client-side Supabase access.
// export const getSupabaseClient = () => {
//   const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
//   const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
//
//   if (!supabaseUrl || !supabaseAnonKey) {
//     console.error('Supabase URL or Anon Key is missing for client-side client.');
//     return null;
//   }
//
//   return createClient(supabaseUrl, supabaseAnonKey);
// };
