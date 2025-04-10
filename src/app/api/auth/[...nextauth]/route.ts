import NextAuth, { type NextAuthOptions, User } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { getCsrfToken } from "next-auth/react";
import { SiweMessage } from "siwe";
import { z } from "zod";
import { logToServer } from "@/lib/logger";
import { supabaseAdmin } from "@/lib/supabase"; // Import Supabase admin client

if (!process.env.NEXTAUTH_SECRET) {
  throw new Error("NEXTAUTH_SECRET is not set");
}
if (!process.env.NEXTAUTH_URL) {
  throw new Error("NEXTAUTH_URL is not set");
}

// Zod schema for environment variables validation (optional but recommended)
const envSchema = z.object({
  NEXTAUTH_SECRET: z.string(),
  NEXTAUTH_URL: z.string().url(),
});

const env = envSchema.parse(process.env);

// Helper function to get user handle from Supabase
async function getUserHandle(address: string): Promise<string | null> {
  if (!supabaseAdmin) {
    logToServer("ERROR", "getUserHandle - Supabase client unavailable");
    return null;
  }
  try {
    // Reuse logic similar to GET /api/profile to ensure user/handle exists
    // 1. Try to fetch
    const { data: user, error: selectError } = await supabaseAdmin
      .from("users")
      .select("handle")
      .eq("address", address)
      .maybeSingle();

    if (selectError && selectError.code !== "PGRST116") {
      // Ignore 'PGRST116' (resource not found), throw others
      throw selectError;
    }

    if (user?.handle) {
      // User exists and has handle
      return user.handle;
    } else {
      // User doesn't exist or handle is null - generate/update
      const generatedHandle = address.slice(-6);
      if (user) {
        // User exists, handle is null - update it
        const { data: updatedUser, error: updateError } = await supabaseAdmin
          .from("users")
          .update({
            handle: generatedHandle,
            updated_at: new Date().toISOString(),
          })
          .eq("address", address)
          .select("handle")
          .single();
        if (updateError) throw updateError;
        return updatedUser?.handle ?? null;
      } else {
        // User doesn't exist - insert new user with handle
        const { data: newUser, error: insertError } = await supabaseAdmin
          .from("users")
          .insert({ address: address, handle: generatedHandle })
          .select("handle")
          .single();
        if (insertError) throw insertError;
        return newUser?.handle ?? null;
      }
    }
  } catch (error) {
    logToServer("ERROR", "getUserHandle - Failed to get/generate handle", {
      address,
      error,
    });
    console.error(`Failed to get/generate handle for ${address}:`, error);
    return null;
  }
}

// Define authOptions but DO NOT export it directly from the route file
const authOptions: NextAuthOptions = {
  secret: env.NEXTAUTH_SECRET,
  providers: [
    CredentialsProvider({
      name: "Ethereum",
      credentials: {
        message: { label: "Message", type: "text", placeholder: "0x0" },
        signature: { label: "Signature", type: "text", placeholder: "0x0" },
      },
      async authorize(credentials, req) {
        logToServer("INFO", "SIWE Authorize Start", {
          address: credentials?.message
            ? JSON.parse(credentials.message).address
            : "unknown",
        });
        try {
          if (!credentials?.message || !credentials?.signature) {
            logToServer("WARN", "SIWE Authorize Failed - Missing credentials");
            console.error("Missing message or signature in credentials");
            return null;
          }

          const siwe = new SiweMessage(JSON.parse(credentials.message));
          logToServer("INFO", "SIWE Authorize - SIWE Message Created", {
            address: siwe.address,
            nonce: siwe.nonce,
          });

          // Fetch the CSRF token using the unstable_getServerSession approach
          // Note: getCsrfToken requires passing the request object
          const csrfToken = await getCsrfToken({
            req: { headers: req.headers },
          });

          if (!csrfToken) {
            logToServer(
              "ERROR",
              "SIWE Authorize Failed - Could not get CSRF token",
              { address: siwe.address }
            );
            console.error("Could not get CSRF token");
            return null;
          }
          logToServer("INFO", "SIWE Authorize - CSRF Token Obtained", {
            address: siwe.address,
            csrfToken,
          });

          logToServer("INFO", "SIWE Authorize - Verifying Signature", {
            address: siwe.address,
            nonce: csrfToken,
            signature: credentials.signature,
          });
          const result = await siwe.verify({
            signature: credentials.signature,
            nonce: csrfToken,
          });

          if (result.success) {
            const userAddress = siwe.address;
            logToServer("INFO", "SIWE Auth Success, Getting Handle", {
              address: userAddress,
            });
            const userHandle = await getUserHandle(userAddress);
            logToServer("INFO", "SIWE Authorize - Returning User Object", {
              address: userAddress,
              handle: userHandle,
            });

            // Return object matching User type, with explicit assertion
            return {
              id: userAddress,
              address: userAddress,
              handle: userHandle,
            } as User; // Add type assertion
          }
          logToServer("WARN", "SIWE Verification Failed", {
            address: siwe.address,
            error: result.error,
          });
          console.error("SIWE verification failed:", result.error);
          return null;
        } catch (e: unknown) {
          const errorMessage =
            e instanceof Error ? e.message : "Unknown SIWE error";
          // Log the raw error object as well for more details
          logToServer("ERROR", "SIWE Authorize Error", {
            error: errorMessage,
            rawError: e,
            credentials,
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
    // JWT Callback: Called first, add handle to token
    async jwt({ token, user }) {
      // On initial sign in, add handle to token
      if (user?.id && !token.handle) {
        const userAddress = user.id; // user.id is the address from authorize
        logToServer("INFO", "JWT Callback - Initial Sign In, Fetching Handle", {
          address: userAddress,
        });
        token.handle = await getUserHandle(userAddress);
        logToServer("INFO", "JWT Callback - Handle Fetched/Generated", {
          address: userAddress,
          handle: token.handle,
        });
      }
      // On subsequent requests, if handle is missing (e.g., token rotation?), try fetching again
      else if (token?.sub && !token.handle) {
        const userAddress = token.sub;
        logToServer("INFO", "JWT Callback - Subsequent Load, Fetching Handle", {
          address: userAddress,
        });
        token.handle = await getUserHandle(userAddress);
        logToServer(
          "INFO",
          "JWT Callback - Handle Fetched/Generated (Subsequent)",
          { address: userAddress, handle: token.handle }
        );
      }
      return token;
    },
    // Session Callback: Called after JWT, add handle from token to session
    async session({ session, token }) {
      if (token?.sub) {
        // Assign properties defined in our augmented Session['user'] type
        session.user = {
          ...session.user, // Keep existing default properties (name, email, image)
          // id: token.sub, // Remove explicit ID assignment here
          address: token.sub,
          handle: token.handle as string | null, // Add handle from token
        };
      } else {
        console.warn("Token sub is missing in session callback");
        logToServer("WARN", "Session Callback - Token sub missing");
      }
      return session;
    },
  },
  events: {
    async signIn({ user, account, profile, isNewUser }) {
      logToServer("INFO", "NextAuth SignIn Event", {
        user,
        account,
        profile,
        isNewUser,
      });
    },
    async signOut({ token }) {
      logToServer("INFO", "NextAuth SignOut Event", { userId: token?.sub });
    },
    async session({ session, token }) {
      // Session event fires frequently, maybe keep this brief or disable if too noisy
      logToServer("INFO", "NextAuth Session Event", {
        userId: token?.sub,
        expires: session.expires,
      });
    },
    // Add other events like createUser, linkAccount if needed
  },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
