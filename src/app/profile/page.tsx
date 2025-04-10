/**
 * src/app/profile/page.tsx
 *
 * Page for authenticated users to view and edit their profile details
 * (display name, bio, profile picture).
 */
"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { logToServer } from "@/lib/logger";

// Placeholder type for profile data
interface UserProfile {
  name: string;
  bio: string;
  pfp_url: string | null; // Profile picture URL from Supabase Storage
}

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile>({
    name: "",
    bio: "",
    pfp_url: null,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pfpFile, setPfpFile] = useState<File | null>(null);

  // Redirect if not authenticated
  useEffect(() => {
    if (status === "unauthenticated") {
      logToServer(
        "WARN",
        "ProfilePage - Unauthenticated access attempt, redirecting"
      );
      router.push("/");
    }
  }, [status, router]);

  // Fetch initial profile data
  useEffect(() => {
    // Only fetch if authenticated and loading is still true
    if (status === "authenticated" && session?.user?.address && isLoading) {
      logToServer("INFO", "ProfilePage - Fetching profile data", {
        address: session.user.address,
      });
      fetch("/api/profile", { credentials: "include" })
        .then(async (res) => {
          if (!res.ok) {
            const errorBody = await res.json().catch(() => ({})); // Try to parse error
            logToServer("ERROR", "ProfilePage - Failed to fetch profile", {
              status: res.status,
              statusText: res.statusText,
              errorBody,
            });
            throw new Error(errorBody.error || "Failed to fetch profile");
          }
          return res.json();
        })
        .then((data) => {
          logToServer(
            "INFO",
            "ProfilePage - Profile data fetched successfully",
            { address: session.user.address }
          );
          setProfile({
            name: data.name || "",
            bio: data.bio || "",
            pfp_url: data.pfp_url || null,
          });
          setError(null); // Clear previous errors on successful fetch
        })
        .catch((err) => {
          console.error("Error fetching profile:", err);
          const errorMessage =
            err instanceof Error ? err.message : "Could not load profile data.";
          logToServer("ERROR", "ProfilePage - Catch fetching profile", {
            error: errorMessage,
          });
          setError(errorMessage);
          setProfile({ name: "", bio: "", pfp_url: null }); // Reset profile on error
        })
        .finally(() => setIsLoading(false));
    }
    // If status becomes loading or unauthenticated while profile is loaded, reset state
    else if (status !== "authenticated" && !isLoading) {
      setIsLoading(true);
      setProfile({ name: "", bio: "", pfp_url: null });
      setError(null);
      setPfpFile(null);
    }
  }, [status, session, isLoading]); // Add isLoading to dependencies

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setProfile((prev) => ({ ...prev, [name]: value }));
  };

  const handlePfpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      // Basic validation (consider adding size/type checks here too if needed)
      setPfpFile(file);
      // Local preview disabled to fix update bug
      logToServer("INFO", "ProfilePage - New PFP selected", {
        name: file.name,
        type: file.type,
        size: file.size,
      });
    }
  };

  const handleSaveProfile = async () => {
    if (!session?.user?.address) {
      setError("Cannot save profile: User session not found.");
      logToServer("ERROR", "ProfilePage - Save attempt without session");
      return;
    }

    setIsSaving(true);
    setError(null);
    logToServer("INFO", "ProfilePage - Saving profile started", {
      address: session.user.address,
    });

    const formData = new FormData();
    // Ensure only non-null values that changed are sent? Or send all?
    // Sending all is simpler for now.
    formData.append("name", profile.name);
    formData.append("bio", profile.bio);
    if (pfpFile) {
      formData.append("pfp", pfpFile);
      logToServer("INFO", "ProfilePage - PFP included in save data");
    }

    try {
      const response = await fetch("/api/profile", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        logToServer("ERROR", "ProfilePage - Save profile API error", {
          status: response.status,
          statusText: response.statusText,
          errorBody: errorData,
          address: session.user.address,
        });
        throw new Error(errorData.error || "Failed to save profile");
      }

      const updatedProfile = await response.json();
      logToServer("INFO", "ProfilePage - Profile saved successfully", {
        address: session.user.address,
        updatedFields: updatedProfile, // Log what was returned
      });

      // Update local state with the accurate data returned from API
      setProfile({
        name: updatedProfile.name || "",
        bio: updatedProfile.bio || "",
        pfp_url: updatedProfile.pfp_url || null,
      });
      setPfpFile(null); // Clear the selected file state
      alert("Profile saved successfully!");
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "Could not save profile.";
      console.error("Error saving profile:", err);
      logToServer("ERROR", "ProfilePage - Catch saving profile", {
        error: errorMessage,
        address: session.user.address,
      });
      setError(errorMessage);
    } finally {
      setIsSaving(false);
      logToServer("INFO", "ProfilePage - Saving profile finished", {
        address: session.user.address,
      });
    }
  };

  const handleSignOut = async () => {
    logToServer("INFO", "ProfilePage - Signing out");
    await signOut({ callbackUrl: "/" });
  };

  if (status === "loading" || isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <p>Loading Profile...</p>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <p>Redirecting...</p>
      </div>
    );
  }

  return (
    <main className="container mx-auto p-4 md:p-8 max-w-2xl">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Your Profile</h1>
        <Button onClick={handleSignOut} variant="outline">
          Sign Out
        </Button>
      </div>
      <nav className="flex gap-4 mb-4 text-sm">
        {session?.user?.handle ? (
          <Link
            href={`/${session.user.handle}`}
            className="text-blue-500 hover:underline"
          >
            View Public Profile
          </Link>
        ) : (
          <span className="text-gray-400">
            View Public Profile (loading...)
          </span>
        )}
        <Link href="/settings" className="text-blue-500 hover:underline">
          Settings
        </Link>
      </nav>

      {session?.user?.address && (
        <p className="mb-6 text-muted-foreground">
          Wallet:{" "}
          <span className="font-mono break-all">{session.user.address}</span>
        </p>
      )}

      {error && (
        <div
          className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4"
          role="alert"
        >
          <strong className="font-bold">Error: </strong>
          <span className="block sm:inline">{error}</span>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSaveProfile();
        }}
        className="space-y-6"
      >
        <div className="flex flex-col items-center space-y-4">
          <Label htmlFor="pfp">Profile Picture</Label>
          {profile.pfp_url ? (
            <img
              src={profile.pfp_url}
              alt="Profile"
              className="w-32 h-32 rounded-full object-cover border"
            />
          ) : (
            <div className="w-32 h-32 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
              No Image
            </div>
          )}
          <Input
            id="pfp"
            type="file"
            accept="image/*"
            onChange={handlePfpChange}
            disabled={isSaving}
            className="max-w-xs"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            name="name"
            value={profile.name}
            onChange={handleInputChange}
            placeholder="Your Display Name"
            maxLength={100}
            disabled={isSaving}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="bio">Bio</Label>
          <Textarea
            id="bio"
            name="bio"
            value={profile.bio}
            onChange={handleInputChange}
            placeholder="Tell us about yourself"
            maxLength={500}
            disabled={isSaving}
            rows={4}
          />
        </div>

        <Button type="submit" disabled={isSaving} className="w-full">
          {isSaving ? "Saving..." : "Save Profile"}
        </Button>
      </form>
    </main>
  );
}
