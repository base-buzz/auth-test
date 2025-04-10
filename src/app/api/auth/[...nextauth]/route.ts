/**
 * src/app/api/auth/[...nextauth]/route.ts
 *
 * NextAuth.js configuration.
 * Handles Sign-In with Ethereum (SIWE) using CredentialsProvider.
 * Manages JWT and Session callbacks to include custom user data (address, handle).
 */
import NextAuth, { type NextAuthOptions, User } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { getCsrfToken } from "next-auth/react";
import { SiweMessage } from "siwe";
import { z } from "zod";
import { logToServer } from "@/lib/logger";
import { supabaseAdmin } from "@/lib/supabase";

// --- Environment Variable Checks --- //
if (!process.env.NEXTAUTH_SECRET) {
  logToServer("ERROR", "Auth Setup Error - NEXTAUTH_SECRET missing");
  throw new Error("NEXTAUTH_SECRET is not set");
}
if (!process.env.NEXTAUTH_URL) {
  logToServer("ERROR", "Auth Setup Error - NEXTAUTH_URL missing");
  throw new Error("NEXTAUTH_URL is not set");
}
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  logToServer(
    "ERROR",
    "Auth Setup Error - Supabase connection details missing"
  );
  throw new Error("Supabase URL or Service Role Key is not set");
}

// --- Environment Variable Schema --- //
// Validates required environment variables at startup
const envSchema = z.object({
  NEXTAUTH_SECRET: z.string().min(1),
  NEXTAUTH_URL: z.string().url(),
  // Add other required env vars here
});

let env: z.infer<typeof envSchema>;
try {
  env = envSchema.parse(process.env);
  logToServer("INFO", "Auth Environment Variables Validated");
} catch (error) {
  logToServer(
    "ERROR",
    "Auth Setup Error - Environment variable validation failed",
    { error }
  );
  // Re-throw error to prevent startup with invalid config
  throw new Error("Environment variable validation failed");
}

// --- Helper Function: Get/Generate User Handle --- //
/**
 * Fetches a user's handle from Supabase by address.
 * If the user exists but has no handle, generates and updates it.
 * If the user doesn't exist, inserts a new user with a generated handle.
 * @param address - The user's Ethereum address.
 * @returns The user's handle or null if an error occurred.
 */
async function getUserHandle(address: string): Promise<string | null> {
  if (!supabaseAdmin) {
    logToServer("ERROR", "getUserHandle - Supabase client unavailable");
    // This should ideally not happen due to startup checks
    return null;
  }
  logToServer("INFO", "getUserHandle - Attempting to find/generate handle", {
    address,
  });
  try {
    // 1. Try to fetch existing user
    const { data: user, error: selectError } = await supabaseAdmin
      .from("users")
      .select("handle") // Only select handle initially
      .eq("address", address)
      .maybeSingle();

    // Handle potential select errors (excluding 'not found')
    if (selectError && selectError.code !== "PGRST116") {
      logToServer("ERROR", "getUserHandle - Supabase select error", {
        address,
        code: selectError.code,
        message: selectError.message,
      });
      throw selectError;
    }

    if (user?.handle) {
      // User exists and has a handle
      logToServer("INFO", "getUserHandle - Found existing handle", {
        address,
        handle: user.handle,
      });
      return user.handle;
    } else {
      // User doesn't exist OR user exists but handle is null
      const generatedHandle = address.slice(-6);
      logToServer(
        "INFO",
        "getUserHandle - Handle is missing or user not found, using generated handle",
        { address, generatedHandle }
      );

      if (user) {
        // User exists, handle is null - UPDATE it
        logToServer(
          "INFO",
          "getUserHandle - Updating existing user with generated handle",
          { address }
        );
        const { data: updatedUser, error: updateError } = await supabaseAdmin
          .from("users")
          .update({
            handle: generatedHandle,
            updated_at: new Date().toISOString(),
          })
          .eq("address", address)
          .select("handle") // Select handle after update
          .single();
        if (updateError) {
          logToServer("ERROR", "getUserHandle - Supabase update error", {
            address,
            error: updateError,
          });
          throw updateError;
        }
        logToServer("INFO", "getUserHandle - Handle updated successfully", {
          address,
          handle: updatedUser?.handle,
        });
        return updatedUser?.handle ?? null; // Return updated handle
      } else {
        // User doesn't exist - INSERT new user with handle
        logToServer(
          "INFO",
          "getUserHandle - Inserting new user with generated handle",
          { address }
        );
        const { data: newUser, error: insertError } = await supabaseAdmin
          .from("users")
          .insert({ address: address, handle: generatedHandle })
          .select("handle") // Select handle after insert
          .single();
        if (insertError) {
          logToServer("ERROR", "getUserHandle - Supabase insert error", {
            address,
            error: insertError,
          });
          throw insertError;
        }
        logToServer("INFO", "getUserHandle - New user inserted successfully", {
          address,
          handle: newUser?.handle,
        });
        return newUser?.handle ?? null; // Return new handle
      }
    }
  } catch (error) {
    // Log any unexpected errors during the process
    logToServer(
      "ERROR",
      "getUserHandle - Unexpected error in get/generate logic",
      { address, error }
    );
    console.error(`Failed to get/generate handle for ${address}:`, error);
    return null; // Return null on failure
  }
}

// --- NextAuth Configuration --- //
export const authOptions: NextAuthOptions = {
  secret: env.NEXTAUTH_SECRET,
  providers: [
    CredentialsProvider({
      name: "Ethereum",
      credentials: {
        message: { label: "Message", type: "text", placeholder: "0x0" },
        signature: { label: "Signature", type: "text", placeholder: "0x0" },
      },
      // Authorize function: Verifies the SIWE message and signature
      async authorize(credentials, req) {
        const addressFromMessage = credentials?.message
          ? JSON.parse(credentials.message).address
          : "unknown";
        logToServer("INFO", "SIWE Authorize Start", {
          address: addressFromMessage,
        });

        try {
          if (!credentials?.message || !credentials?.signature) {
            logToServer(
              "WARN",
              "SIWE Authorize Failed - Missing message or signature"
            );
            return null;
          }

          const siwe = new SiweMessage(JSON.parse(credentials.message));
          const userAddress = siwe.address;
          logToServer("INFO", "SIWE Authorize - SIWE Message Created", {
            address: userAddress,
            nonce: siwe.nonce,
          });

          // Fetch the CSRF token to use as the nonce
          const csrfToken = await getCsrfToken({
            req: { headers: req.headers }, // Pass request headers
          });

          if (!csrfToken) {
            logToServer(
              "ERROR",
              "SIWE Authorize Failed - Could not get CSRF token",
              { address: userAddress }
            );
            return null;
          }
          logToServer("INFO", "SIWE Authorize - CSRF Token Obtained", {
            address: userAddress,
          });

          // Verify the signature against the SIWE message and nonce (CSRF token)
          logToServer("INFO", "SIWE Authorize - Verifying Signature...", {
            address: userAddress,
          });
          const result = await siwe.verify({
            signature: credentials.signature,
            nonce: csrfToken,
          });

          if (result.success) {
            // Signature is valid
            logToServer("INFO", "SIWE Auth Success, Getting Handle", {
              address: userAddress,
            });
            // Fetch/generate handle to include in the User object
            const userHandle = await getUserHandle(userAddress);
            logToServer("INFO", "SIWE Authorize - Returning User Object", {
              address: userAddress,
              handle: userHandle,
            });

            // Return object matching our augmented User type
            return {
              id: userAddress, // id is required by DefaultUser
              address: userAddress,
              handle: userHandle,
            } as User;
          }

          // Signature verification failed
          logToServer("WARN", "SIWE Verification Failed", {
            address: userAddress,
            error: result.error
              ? JSON.stringify(result.error)
              : "Unknown verification error", // Log error details
          });
          console.error("SIWE verification failed:", result.error);
          return null;
        } catch (e: unknown) {
          // Catch any unexpected errors during authorization
          const errorMessage =
            e instanceof Error ? e.message : "Unknown SIWE authorize error";
          logToServer("ERROR", "SIWE Authorize Exception", {
            error: errorMessage,
            rawError: e,
            address: addressFromMessage, // Log address if available
          });
          console.error("Error in SIWE authorize:", e);
          return null;
        }
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 90 * 24 * 60 * 60, // 90 days in seconds
  },
  callbacks: {
    // JWT Callback: Called when JWT is created/updated.
    // Used here to persist the user handle in the token.
    async jwt({ token, user, account, isNewUser }) {
      const tokenSub = token?.sub;
      // Check if this is the initial sign-in event
      if (user && account && isNewUser !== undefined) {
        logToServer("INFO", "JWT Callback - Initial Sign In", {
          tokenSub,
          userId: user.id,
          isNewUser,
        });
        // `user` object is available only on initial sign-in.
        // It contains the full object returned by the `authorize` callback.
        if (user.id && !token.handle) {
          token.handle = user.handle ?? (await getUserHandle(user.id));
          logToServer(
            "INFO",
            "JWT Callback - Handle added/fetched for initial sign in",
            { tokenSub, handle: token.handle }
          );
        } else if (user.id && token.handle) {
          logToServer(
            "INFO",
            "JWT Callback - Handle already present in token for initial sign in",
            { tokenSub, handle: token.handle }
          );
        }
      }
      // On subsequent requests (e.g., session validation), ensure handle exists
      else if (tokenSub && !token.handle) {
        logToServer(
          "INFO",
          "JWT Callback - Subsequent Load, Handle missing, fetching...",
          { tokenSub }
        );
        token.handle = await getUserHandle(tokenSub);
        logToServer("INFO", "JWT Callback - Handle Fetched (Subsequent)", {
          tokenSub,
          handle: token.handle,
        });
      }
      // Log token state for debugging if needed (can be verbose)
      // logToServer("DEBUG", "JWT Callback - Returning token", { token });
      return token;
    },

    // Session Callback: Called when session is checked.
    // Used to add custom data from the JWT token to the session object available on the client.
    async session({ session, token }) {
      const tokenSub = token?.sub;
      // Add address and handle from token to the session object
      if (tokenSub) {
        session.user = {
          ...session.user, // Keep default fields (name, email, image)
          address: tokenSub,
          handle: token.handle as string | null,
        };
        logToServer("INFO", "Session Callback - Populated user object", {
          address: tokenSub,
          handle: token.handle,
        });
      } else {
        // This case should ideally not happen if JWT is valid
        logToServer("WARN", "Session Callback - Token sub missing", {
          session,
          token,
        });
      }
      return session;
    },
  },
  events: {
    // Log successful sign-in events
    async signIn({ user, account, isNewUser }) {
      logToServer("INFO", "NextAuth Event: signIn", {
        userId: user.id,
        provider: account?.provider,
        isNewUser: isNewUser ?? "unknown",
      });
    },
    // Log sign-out events
    async signOut({ token }) {
      logToServer("INFO", "NextAuth Event: signOut", { userId: token?.sub });
    },
    // Session event can be very frequent, keep logging minimal or disable
    // async session({ session, token }) {
    //   logToServer("DEBUG", "NextAuth Event: session", { userId: token?.sub });
    // },
    // Log errors during user creation or linking if using those features
    // async createUser({ user }) { ... }
    // async linkAccount({ user, account }) { ... }
  },
  // Debug option - logs internal NextAuth events (can be very verbose)
  // debug: process.env.NODE_ENV === 'development',
};

// --- Handler Export --- //
// The handler initializes NextAuth with the defined options.
const handler = NextAuth(authOptions);

// Export the handler for GET and POST requests as required by Next.js App Router
export { handler as GET, handler as POST };
