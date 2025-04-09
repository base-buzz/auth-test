"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import { useEffect, useState } from "react";

// Expanded profile type
interface UserProfileExtended {
  name: string | null;
  bio: string | null;
  pfp_url: string | null;
  handle: string | null;
  email: string | null;
  tier: string | null;
  location: string | null;
  created_at: string | null;
}

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const [profile, setProfile] = useState<UserProfileExtended | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch extended profile data
  useEffect(() => {
    if (status === "authenticated") {
      setIsLoading(true);
      fetch("/api/profile") // Use the same profile API route
        .then((res) => {
          if (!res.ok) throw new Error("Failed to fetch profile settings");
          return res.json();
        })
        .then((data) => {
          setProfile(data);
        })
        .catch((err) => {
          console.error("Error fetching profile settings:", err);
          setError("Could not load profile settings.");
        })
        .finally(() => setIsLoading(false));
    }
    // Redirect if unauthenticated (consider middleware handles this, but belt-and-suspenders)
    if (status === "unauthenticated") {
      // router.push('/'); // Need to import useRouter if using this
      if (typeof window !== "undefined") window.location.href = "/";
    }
  }, [status]);

  if (isLoading || status === "loading") {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <p>Loading settings...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <p className="text-red-500">Error: {error}</p>
      </div>
    );
  }

  if (!profile || status === "unauthenticated") {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <p>Redirecting...</p>
      </div>
    ); // Or show login prompt
  }

  return (
    <main className="container mx-auto p-4 md:p-8 max-w-2xl">
      <h1 className="text-3xl font-bold mb-8">Settings</h1>

      <div className="bg-card p-6 rounded-lg shadow space-y-4 mb-8 border">
        <h2 className="text-xl font-semibold mb-4 border-b pb-2">
          Account Information
        </h2>
        <p>
          <strong>Wallet Address:</strong>{" "}
          <span className="font-mono break-all">
            {session?.user?.address ?? "N/A"}
          </span>
        </p>
        <p>
          <strong>Handle:</strong>{" "}
          {profile.handle ? (
            <Link
              href={`/${profile.handle}`}
              className="text-blue-500 hover:underline ml-1"
            >
              @{profile.handle}
            </Link>
          ) : (
            <span className="text-muted-foreground ml-1">Not Set</span>
          )}
        </p>
        <p>
          <strong>Display Name:</strong>{" "}
          {profile.name ?? (
            <span className="text-muted-foreground">Not Set</span>
          )}
        </p>
        <p>
          <strong>Email:</strong>{" "}
          {profile.email ?? (
            <span className="text-muted-foreground">Not Set</span>
          )}
        </p>
        <p>
          <strong>Bio:</strong>{" "}
          {profile.bio ?? (
            <span className="text-muted-foreground">Not Set</span>
          )}
        </p>
        <p>
          <strong>Tier:</strong>{" "}
          {profile.tier ?? <span className="text-muted-foreground">N/A</span>}
        </p>
        <p>
          <strong>Location:</strong>{" "}
          {profile.location ?? (
            <span className="text-muted-foreground">Not Set</span>
          )}
        </p>
        <p>
          <strong>Member Since:</strong>{" "}
          {profile.created_at
            ? new Date(profile.created_at).toLocaleDateString()
            : "N/A"}
        </p>
      </div>

      <p className="text-muted-foreground mb-8">
        Account preferences configuration is not implemented.
      </p>

      <nav className="flex gap-4">
        <Link href="/profile" className="text-blue-500 hover:underline">
          Edit Profile
        </Link>
        <Link href="/dashboard" className="text-blue-500 hover:underline">
          Dashboard
        </Link>
      </nav>
    </main>
  );
}
