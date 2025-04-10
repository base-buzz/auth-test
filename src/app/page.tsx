/**
 * src/app/page.tsx
 *
 * Home page component.
 * Handles wallet connection, SIWE authentication flow, and redirects authenticated users.
 */
"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useSignMessage } from "wagmi";
import { SiweMessage } from "siwe";
import { signIn, signOut, useSession, getCsrfToken } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
// import Link from "next/link"; // Removed unused import

// No profile needed here anymore
// interface HomeProfile {
//   handle: string | null;
// }

export default function Home() {
  const { address, chainId, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { data: session, status } = useSession();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);
  const router = useRouter();

  // Redirect logic after authentication
  useEffect(() => {
    // Only redirect if authenticated and handle is present
    if (status === "authenticated" && session?.user?.handle) {
      const targetPath = `/${session.user.handle}`;
      console.log(
        `[CLIENT] User authenticated with handle, redirecting from / to ${targetPath}`
      );
      router.push(targetPath);
    } else if (status === "authenticated" && !session?.user?.handle) {
      // Wait for handle to become available in session
      console.log(
        "[CLIENT] User authenticated but handle not yet available in session, waiting..."
      );
    }
    // No redirect needed if loading or unauthenticated
  }, [status, session, router]);

  // ** WARNING: Critical Auth Logic - SIWE Sign-In Handler **
  // This function orchestrates the client-side SIWE flow.
  // Changes to CSRF token fetching, message creation, signing, or the
  // call to `signIn('credentials', ...)` WILL break login.
  // Consult AUTH.md before modifying.
  // ***********************************************************
  const handleSignIn = async () => {
    if (!address || !chainId) {
      console.error("[CLIENT] Wallet not connected or chainId missing");
      setSignInError("Please connect your wallet first.");
      return;
    }

    setIsSigningIn(true);
    setSignInError(null);
    console.log("[CLIENT] handleSignIn started for address:", address);

    try {
      console.log("[CLIENT] Fetching CSRF token...");
      const csrfToken = await getCsrfToken();
      if (!csrfToken) {
        console.error("[CLIENT] Failed to fetch CSRF token");
        throw new Error("Failed to fetch CSRF token for SIWE nonce.");
      }
      console.log(
        "[CLIENT] CSRF token obtained: ",
        csrfToken.substring(0, 10) + "..."
      );

      const message = new SiweMessage({
        domain: window.location.host,
        address,
        statement: "Sign in with Ethereum to the app.", // Consider making statement more specific
        uri: window.location.origin,
        version: "1",
        chainId,
        nonce: csrfToken,
      });

      console.log("[CLIENT] Requesting signature...");
      const signature = await signMessageAsync({
        message: message.prepareMessage(),
      });
      console.log(
        "[CLIENT] Signature obtained: ",
        signature.substring(0, 20) + "..."
      );

      console.log("[CLIENT] Calling signIn('credentials')...");
      const signInResponse = await signIn("credentials", {
        message: JSON.stringify(message),
        signature,
        redirect: false, // Important: Handle redirect manually via useEffect
      });
      console.log("[CLIENT] signIn response:", signInResponse);

      if (signInResponse?.error) {
        // Handle specific SIWE errors if possible, otherwise show generic message
        console.error(
          "[CLIENT] Sign-in callback failed:",
          signInResponse.error
        );
        setSignInError(`Sign-in failed: ${signInResponse.error}`); // Show specific error if available
      } else if (signInResponse?.ok) {
        // Session will update, useEffect will handle redirect
        console.log(
          "[CLIENT] Sign-in successful via credentials, session will update and trigger redirect."
        );
      }
      // Handle case where signInResponse is null/undefined (should not happen ideally)
      else if (!signInResponse) {
        console.error(
          "[CLIENT] signIn response was unexpectedly null/undefined"
        );
        setSignInError("Sign-in process did not complete as expected.");
      }
    } catch (error: unknown) {
      // Catch errors from getCsrfToken, signMessageAsync, or network issues
      const message =
        error instanceof Error
          ? error.message
          : "An unexpected error occurred during sign-in.";
      console.error("[CLIENT] Error in handleSignIn:", error);
      setSignInError(message);
    } finally {
      setIsSigningIn(false);
      console.log("[CLIENT] handleSignIn finished");
    }
  };

  const handleSignOut = async () => {
    console.log("[CLIENT] handleSignOut started");
    await signOut({ redirect: false }); // Let page reload handle state change
    console.log("[CLIENT] signOut called, session should clear");
    // Optional: router.push('/') if immediate redirect desired
  };

  // Render different content based on session status and connection status
  const renderContent = () => {
    if (status === "loading") {
      return <p>Loading session...</p>;
    }

    if (status === "authenticated") {
      // Display minimal info while waiting for redirect
      return (
        <div className="text-center mt-4 space-y-3">
          <p>Welcome!</p>
          <p className="font-mono break-all">{session.user.address}</p>
          {session.user.handle ? (
            <p>Redirecting to your profile (@{session.user.handle})...</p>
          ) : (
            <p>Finalizing authentication...</p> // Changed waiting message
          )}
          <Button onClick={handleSignOut} variant="destructive">
            Sign Out
          </Button>
        </div>
      );
    }

    // Unauthenticated
    if (!isConnected) {
      return <p className="mt-4">Please connect your wallet.</p>;
    }

    // Unauthenticated but connected
    return (
      <Button onClick={handleSignIn} disabled={isSigningIn} className="mt-4">
        {isSigningIn ? "Signing In..." : "Sign In With Ethereum"}
      </Button>
    );
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6 md:p-24">
      {" "}
      {/* Adjusted padding */}
      <div className="z-10 w-full max-w-5xl font-mono text-sm mb-8 text-center">
        {/* Update title for base.buzz */}
        <h1 className="text-2xl font-bold">Base Buzz Authentication</h1>
      </div>
      <div className="flex flex-col items-center gap-4">
        <ConnectButton />
        {signInError && (
          <p className="text-red-500 mt-2 text-center">Error: {signInError}</p> // Centered error
        )}
        {renderContent()} {/* Render dynamic content */}
      </div>
    </div>
  );
}
