/**
 * src/app/[handle]/page.tsx
 *
 * Public profile page displayed based on the handle in the URL.
 * Fetches user data via API and displays it.
 * Shows edit controls if the logged-in user is viewing their own profile.
 */
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
// import Image from "next/image"; // Using standard img for now
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { logToServer } from "@/lib/logger"; // Import logger

// Represents the data expected for a user profile
interface UserProfile {
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  handle: string;
  address: string;
  // Add other fields returned by API if needed (e.g., created_at, tier)
}

export default function HandleProfilePage() {
  // --- Hooks --- //
  const params = useParams();
  const { data: session, status: sessionStatus } = useSession();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // --- Derived State --- //
  const handle = params?.handle as string | undefined;
  const isOwnProfile =
    sessionStatus === "authenticated" && session?.user?.handle === handle;

  // --- Effects --- //
  useEffect(() => {
    // Validate handle obtained from URL
    if (!handle) {
      logToServer("WARN", "HandleProfilePage - Invalid handle in URL", {
        params,
      });
      setError("Invalid user handle provided in URL.");
      setIsLoading(false);
      setProfile(null);
      return;
    }

    logToServer("INFO", "HandleProfilePage - Fetching profile", { handle });
    setIsLoading(true);
    setError(null);

    // Fetch profile data from the public API endpoint
    fetch(`/api/users/${handle}`)
      .then(async (res) => {
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          logToServer("WARN", "HandleProfilePage - API fetch failed", {
            handle,
            status: res.status,
            errorBody: errorData,
          });
          throw new Error(
            errorData.error ||
              `User not found or error fetching (${res.status})`
          );
        }
        return res.json();
      })
      .then((data) => {
        logToServer("INFO", "HandleProfilePage - API fetch success", {
          handle,
        });
        setProfile(data);
      })
      .catch((err) => {
        console.error(`Error fetching profile for handle ${handle}:`, err);
        const errorMessage =
          err instanceof Error ? err.message : "Could not load profile data.";
        logToServer("ERROR", "HandleProfilePage - Catch fetching profile", {
          handle,
          error: errorMessage,
        });
        setError(errorMessage);
        setProfile(null);
      })
      .finally(() => {
        setIsLoading(false);
        logToServer("INFO", "HandleProfilePage - Fetch finished", { handle });
      });
  }, [handle, params]); // Rerun if handle changes

  // --- Render Logic --- //

  // Loading State
  if (isLoading) {
    return (
      <div className="container mx-auto p-8 text-center">
        Loading profile...
      </div>
    );
  }

  // Error State (covers invalid handle and fetch errors)
  if (error) {
    return (
      <div className="container mx-auto p-8 text-center text-red-500">
        Error: {error}
      </div>
    );
  }

  // Profile Not Found State
  if (!profile) {
    return (
      <div className="container mx-auto p-8 text-center">
        User profile not found.
      </div>
    );
  }

  // Main Profile Display
  return (
    <main className="container mx-auto p-4 md:p-8 max-w-2xl">
      {/* Header: Welcome/Title and Edit Button */}
      <div className="flex justify-between items-center mb-6">
        {isOwnProfile ? (
          <h1 className="text-2xl font-bold">
            Welcome, {profile?.display_name || `@${profile?.handle}`}!
          </h1>
        ) : (
          <h1 className="text-2xl font-bold">
            Profile: {profile?.display_name || `@${profile?.handle}`}
          </h1>
        )}
        {isOwnProfile && (
          <Link href="/profile" passHref>
            <Button variant="outline">Edit Profile</Button>
          </Link>
        )}
      </div>

      {/* Profile Picture and Basic Info */}
      <div className="flex flex-col items-center space-y-4 mb-6">
        {profile.avatar_url ? (
          // Using standard <img> tag temporarily due to next/image issues
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.avatar_url}
            alt={`${profile.display_name || profile.handle}'s profile picture`}
            className="w-32 h-32 rounded-full object-cover border"
          />
        ) : (
          <div className="w-32 h-32 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
            No Image
          </div>
        )}
        <h2 className="text-xl font-semibold">
          {profile.display_name || `@${profile.handle}`}
        </h2>
        <p className="text-sm text-muted-foreground font-mono break-all">
          {profile.address}
        </p>
      </div>

      {/* Bio Section */}
      {profile.bio && (
        <div className="mt-4 p-4 border rounded bg-card">
          <h2 className="text-lg font-semibold mb-2">Bio</h2>
          <p className="text-card-foreground">{profile.bio}</p>
        </div>
      )}

      {/* Consider adding other profile fields here: Tier, Created At, etc. */}
    </main>
  );
}
