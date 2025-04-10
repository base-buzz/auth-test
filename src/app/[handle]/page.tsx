"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
// import Image from "next/image"; // Removed unused import
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface UserProfile {
  // Define based on the expected API response from /api/users/[handle]
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  handle: string;
  address: string;
  // Add other fields if returned by the API
}

export default function HandleProfilePage() {
  // Call hooks unconditionally at the top
  const params = useParams();
  const { data: session, status: sessionStatus } = useSession();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Determine handle *after* hooks
  const handle = params?.handle as string | undefined;

  // Determine if the logged-in user is viewing their own profile
  const isOwnProfile =
    sessionStatus === "authenticated" && session?.user?.handle === handle;

  useEffect(() => {
    // Validate handle inside useEffect before fetching
    if (!handle) {
      setError("Invalid user handle provided in URL.");
      setIsLoading(false);
      setProfile(null); // Ensure profile is null
      return; // Stop the effect if handle is invalid
    }

    setIsLoading(true);
    setError(null); // Clear previous errors for new fetch

    fetch(`/api/users/${handle}`)
      .then(async (res) => {
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(
            errorData.error ||
              `User not found or error fetching (${res.status})`
          );
        }
        return res.json();
      })
      .then((data) => {
        setProfile(data);
      })
      .catch((err) => {
        console.error(`Error fetching profile for handle ${handle}:`, err);
        setError(err.message);
        setProfile(null);
      })
      .finally(() => {
        setIsLoading(false);
      });
    // Add params to dependency array as handle depends on it, though handle alone is sufficient trigger
  }, [handle, params]);

  // Loading state
  if (isLoading) {
    return (
      <div className="container mx-auto p-8 text-center">
        Loading profile...
      </div>
    );
  }

  // Error state (covers invalid handle from useEffect as well)
  if (error) {
    return (
      <div className="container mx-auto p-8 text-center text-red-500">
        Error: {error}
      </div>
    );
  }

  // Profile not found state (after loading and no error)
  if (!profile) {
    return (
      <div className="container mx-auto p-8 text-center">
        User profile not found.
      </div>
    );
  }

  // Successful profile display
  return (
    <main className="container mx-auto p-4 md:p-8 max-w-2xl">
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

      <div className="flex flex-col items-center space-y-4 mb-6">
        {profile.avatar_url ? (
          // Temporarily use standard <img> tag for diagnostics
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.avatar_url}
            alt={`${profile.display_name || profile.handle}'s profile picture`}
            // width={128} // Use CSS for sizing
            // height={128}
            className="w-32 h-32 rounded-full object-cover border"
            // priority is not applicable to standard img
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

      {profile.bio && (
        <div className="mt-4 p-4 border rounded bg-card">
          <h2 className="text-lg font-semibold mb-2">Bio</h2>
          <p className="text-card-foreground">{profile.bio}</p>
        </div>
      )}
    </main>
  );
}
