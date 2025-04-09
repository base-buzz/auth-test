import NextAuth, { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { getCsrfToken } from "next-auth/react";
import { SiweMessage } from "siwe";
import { z } from "zod";
import { logToServer } from "@/lib/logger";

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

export const authOptions: NextAuthOptions = {
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
            nonce: csrfToken, // Verify against the obtained CSRF token
          });

          if (result.success) {
            logToServer("INFO", "SIWE Authentication Success", {
              address: siwe.address,
            });
            return {
              id: siwe.address, // Use the Ethereum address as the user ID
            };
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
    async session({ session, token }) {
      if (token?.sub) {
        // Assign the Ethereum address (stored in token.sub) to session.user.id
        // Also adding address directly to user object for easier access
        session.user = { ...session.user, id: token.sub, address: token.sub };
      } else {
        console.warn("Token sub is missing in session callback");
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
    async signOut({ session: _session, token }) {
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
