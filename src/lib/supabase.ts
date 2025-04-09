import { createClient } from "@supabase/supabase-js";
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

// Create a single instance of the Supabase client
// Use the service role key for server-side operations.
// For client-side, you'd typically use the anon key and user-specific JWTs.
export const supabaseAdmin = env
  ? createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        persistSession: false, // Typically false for server-side/admin clients
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    })
  : null; // Handle the case where env vars are missing

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
