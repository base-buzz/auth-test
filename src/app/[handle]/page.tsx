"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
// import Image from "next/image"; // Removed as it's temporarily unused

// Type for public profile data
interface PublicUserProfile {
  address: string | null;
  name: string | null;
  pfp_url: string | null;
  bio: string | null;
  handle: string | null;
  created_at: string | null;
  tier: string | null;
}

export default function UserHandlePage() {
  const params = useParams();
  const handle = params?.handle as string | undefined;
  const [profile, setProfile] = useState<PublicUserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0); // State for retry attempts

  const MAX_RETRIES = 3;

  useEffect(() => {
    if (!handle) {
      // Handle case where handle might be missing or invalid early
      setError("Invalid user handle provided in URL.");
      setIsLoading(false);
      return;
    }

    // Only fetch if handle is present
    const fetchProfile = async () => {
      setIsLoading(true); // Set loading true at the start of each attempt
      // Don't clear error on retry, let the final error persist
      // setError(null); // Removed: Clear error only on initial load/handle change

      try {
        const res = await fetch(`/api/users/${handle}`); // Fetch from the new API route
        if (!res.ok) {
          const errorData = await res
            .json()
            .catch(() => ({ error: "Failed to parse error response" }));
          throw new Error(
            errorData.error || `User not found or server error (${res.status})`
          );
        }
        const data = await res.json();
        setProfile(data);
        setError(null); // Clear error on success
        setRetryCount(0); // Reset retry count on success
        setIsLoading(false); // Stop loading on success
      } catch (err: unknown) {
        console.error(
          `Attempt ${
            retryCount + 1
          }: Error fetching profile for handle ${handle}:`,
          err
        );

        // Determine the error message safely
        const errorMessage = err instanceof Error ? err.message : String(err);

        if (retryCount < MAX_RETRIES - 1) {
          setRetryCount((prevCount) => prevCount + 1); // Increment retry count to trigger re-fetch
          // Keep isLoading true until max retries or success
        } else {
          setError(
            `Failed to fetch profile after ${MAX_RETRIES} attempts: ${errorMessage}`
          ); // Use safe error message
          setProfile(null); // Clear profile on final error
          setIsLoading(false); // Stop loading after max retries
        }
      }
      // Don't set isLoading false here if retrying
      // finally is tricky with async/await inside useEffect when managing retries
    };

    fetchProfile();

    // Effect cleanup function (optional, not strictly needed here)
    // return () => {
    //  console.log("Cleanup effect");
    // };
  }, [handle, retryCount]); // Re-run effect if handle or retryCount changes

  // Reset retry count if the handle changes
  useEffect(() => {
    setRetryCount(0);
    setError(null); // Also clear error when handle changes
  }, [handle]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <p>Loading profile...</p>
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

  if (!profile) {
    // This state might be reached if handle is invalid or fetch resulted in error before setting profile
    return (
      <div className="flex justify-center items-center min-h-screen">
        <p>User profile could not be loaded.</p>
      </div>
    );
  }

  // Basic Profile Display
  return (
    <main className="container mx-auto p-4 md:p-8 max-w-3xl">
      <div className="flex flex-col items-center md:flex-row md:items-start gap-8">
        {/* Profile Picture */}
        <div className="flex-shrink-0">
          {profile.pfp_url ? (
            // TEMPORARILY using <img> instead of <Image> for diagnostics
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.pfp_url}
              alt={`${profile.name || handle}'s profile picture`}
              width={128}
              height={128}
              className="rounded-full border-4 border-muted object-cover w-32 h-32 md:w-48 md:h-48"
              // priority prop doesn't exist on <img>
            />
          ) : (
            <div className="w-32 h-32 md:w-48 md:h-48 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
              No Image
            </div>
          )}
        </div>

        {/* Profile Details */}
        <div className="text-center md:text-left flex-grow">
          <h1 className="text-3xl md:text-4xl font-bold mb-1">
            {profile.name ?? handle}
          </h1>
          <p className="text-lg text-muted-foreground mb-3">
            @{profile.handle}
          </p>
          {profile.tier && (
            <span className="inline-block bg-blue-100 text-blue-800 text-xs font-semibold mr-2 px-2.5 py-0.5 rounded dark:bg-blue-900 dark:text-blue-300 mb-3">
              {profile.tier.toUpperCase()} Tier
            </span>
          )}
          <p className="mb-4">
            {profile.bio ?? (
              <span className="text-muted-foreground italic">
                No bio available.
              </span>
            )}
          </p>
          <p className="text-sm text-muted-foreground">
            Wallet:{" "}
            <span className="font-mono text-xs">
              {profile.address ?? "N/A"}
            </span>
          </p>
          <p className="text-sm text-muted-foreground">
            Joined:{" "}
            {profile.created_at
              ? new Date(profile.created_at).toLocaleDateString()
              : "N/A"}
          </p>
        </div>
      </div>

      {/* Placeholder for user's content/activity */}
      <div className="mt-12 border-t pt-8">
        <h2 className="text-2xl font-semibold mb-4">Activity</h2>
        <p className="text-muted-foreground">
          User activity feed (e.g., posts) would go here.
        </p>
      </div>
    </main>
  );
}
