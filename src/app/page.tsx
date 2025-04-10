"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useSignMessage } from "wagmi";
import { SiweMessage } from "siwe";
import { signIn, signOut, useSession, getCsrfToken } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const { address, chainId, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { data: session, status } = useSession();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated" && session?.user?.handle) {
      console.log(
        `[CLIENT] User authenticated with handle, redirecting from / to /${session.user.handle}`
      );
      router.push(`/${session.user.handle}`);
    } else if (status === "authenticated" && !session?.user?.handle) {
      console.log(
        "[CLIENT] User authenticated but handle not yet available in session, waiting..."
      );
    }
  }, [status, session, router]);

  const handleSignIn = async () => {
    if (!address || !chainId) {
      console.error("Wallet not connected or chainId missing");
      setSignInError("Please connect your wallet first.");
      return;
    }

    setIsSigningIn(true);
    setSignInError(null);
    console.log("[CLIENT] handleSignIn started");

    try {
      console.log("[CLIENT] Fetching CSRF token...");
      const csrfToken = await getCsrfToken();
      if (!csrfToken) {
        console.error("[CLIENT] Failed to fetch CSRF token");
        throw new Error("Failed to fetch CSRF token for SIWE nonce.");
      }
      console.log(
        "[CLIENT] CSRF token obtained:",
        csrfToken ? csrfToken.substring(0, 10) + "..." : "null"
      );

      const message = new SiweMessage({
        domain: window.location.host,
        address,
        statement: "Sign in with Ethereum to the app.",
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
        "[CLIENT] Signature obtained:",
        signature ? signature.substring(0, 20) + "..." : "null"
      );

      console.log("[CLIENT] Calling signIn('credentials')...");
      const signInResponse = await signIn("credentials", {
        message: JSON.stringify(message),
        signature,
        redirect: false,
      });
      console.log("[CLIENT] signIn response:", signInResponse);

      if (signInResponse?.error) {
        console.error("[CLIENT] Sign-in failed:", signInResponse.error);
        setSignInError("Sign-in failed. Please try again.");
      } else if (signInResponse?.ok) {
        console.log(
          "[CLIENT] Sign-in successful via credentials, session will update and trigger redirect."
        );
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : "An unexpected error occurred.";
      console.error("[CLIENT] Error in handleSignIn:", error);
      setSignInError(message);
    } finally {
      setIsSigningIn(false);
      console.log("[CLIENT] handleSignIn finished");
    }
  };

  const handleSignOut = async () => {
    console.log("[CLIENT] handleSignOut started");
    await signOut({ redirect: false, callbackUrl: "/" });
    console.log("[CLIENT] signOut called");
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 w-full max-w-5xl font-mono text-sm mb-8 text-center">
        <h1 className="text-2xl font-bold">Wagmi + SIWE + Supabase Auth</h1>
      </div>

      <div className="flex flex-col items-center gap-4">
        <ConnectButton />

        {signInError && (
          <p className="text-red-500 mt-2">Error: {signInError}</p>
        )}

        {status === "authenticated" && session?.user?.address && (
          <div className="text-center mt-4 space-y-3">
            <p>Welcome!</p>
            <p className="font-mono break-all">{session.user.address}</p>
            {session.user.handle ? (
              <p>Redirecting to your profile ({session.user.handle})...</p>
            ) : (
              <p>Authenticating, please wait...</p>
            )}
            <Button onClick={handleSignOut} variant="destructive">
              Sign Out
            </Button>
          </div>
        )}

        {status === "unauthenticated" && isConnected && (
          <Button
            onClick={handleSignIn}
            disabled={isSigningIn}
            className="mt-4"
          >
            {isSigningIn ? "Signing In..." : "Sign In With Ethereum"}
          </Button>
        )}

        {status === "loading" && <p>Loading session...</p>}
      </div>
    </main>
  );
}
