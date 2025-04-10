import type { DefaultSession, DefaultUser } from "next-auth";
import type { JWT as DefaultJWT } from "next-auth/jwt";

// Extend the default interfaces
declare module "next-auth" {
  /**
   * Returned by `useSession`, `getSession` and received as a prop on the `SessionProvider` React Context
   */
  interface Session {
    user: {
      /** The user's wallet address. */
      address: string;
      /** The user's unique handle. */
      handle: string | null; // Match the type added in the callback
    } & DefaultSession["user"]; // Keep existing properties like name, email, image
  }

  /** Extends the default User model */
  interface User extends DefaultUser {
    // Add address and handle, although 'id' is often sufficient if it's the address
    address: string;
    handle: string | null;
  }
}

declare module "next-auth/jwt" {
  /** Returned by the `jwt` callback and `getToken`, when using JWT sessions */
  interface JWT extends DefaultJWT {
    /** User handle */
    handle: string | null; // Match the type added in the callback
    // 'sub' usually holds the address (user id) already
  }
}
