"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useSignMessage } from "wagmi";
import { SiweMessage } from "siwe";
import { signIn, signOut, useSession, getCsrfToken } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface HomeProfile {
  handle: string | null;
}

export default function Home() {
  const { address, chainId, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { data: session, status } = useSession();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);
  const router = useRouter();
  const [profile, setProfile] = useState<HomeProfile | null>(null);

  useEffect(() => {
    if (status === "authenticated") {
      console.log(
        "[CLIENT] User is authenticated, redirecting from / to /dashboard"
      );
      router.push("/dashboard");
    }
  }, [status, router]);

  useEffect(() => {
    if (status === "authenticated" && !profile) {
      fetch("/api/profile")
        .then((res) =>
          res.ok ? res.json() : Promise.reject("Failed to fetch profile")
        )
        .then((data) => setProfile(data))
        .catch((err) => console.error("Error fetching profile on home:", err));
    }
    if (status === "unauthenticated" && profile) {
      setProfile(null);
    }
  }, [status, profile]);

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
        console.log("[CLIENT] Sign-in successful, redirecting to /profile...");
        router.push("/profile");
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
            <div>
              <p>Signed in as:</p>
              <p className="font-mono break-all">{session.user.address}</p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center">
              {profile?.handle && (
                <Link href={`/${profile.handle}`} passHref>
                  <Button variant="secondary">View Public Profile</Button>
                </Link>
              )}
              <Link href="/dashboard" passHref>
                <Button variant="outline">Dashboard</Button>
              </Link>
              <Link href="/profile" passHref>
                <Button variant="outline">Edit Profile</Button>
              </Link>
              <Button onClick={handleSignOut} variant="destructive">
                Sign Out
              </Button>
            </div>
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
