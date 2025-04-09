"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import Link from "next/link";

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
      router.push("/");
    }
  }, [status, router]);

  // Fetch profile data (we will implement this API route next)
  useEffect(() => {
    if (status === "authenticated" && session?.user?.address) {
      setIsLoading(true);
      fetch("/api/profile", { credentials: "include" }) // Add credentials: 'include'
        .then((res) => {
          if (!res.ok) throw new Error("Failed to fetch profile");
          return res.json();
        })
        .then((data) => {
          setProfile({
            name: data.name || "",
            bio: data.bio || "",
            pfp_url: data.pfp_url || null,
          });
        })
        .catch((err) => {
          console.error("Error fetching profile:", err);
          setError("Could not load profile data.");
          // Set default empty profile on error
          setProfile({ name: "", bio: "", pfp_url: null });
        })
        .finally(() => setIsLoading(false));
    }
  }, [status, session]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setProfile((prev) => ({ ...prev, [name]: value }));
  };

  const handlePfpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setPfpFile(e.target.files[0]);
      // Optional: Preview image locally
      setProfile((prev) => ({
        ...prev,
        pfp_url: URL.createObjectURL(e.target.files![0]),
      }));
    }
  };

  const handleSaveProfile = async () => {
    setIsSaving(true);
    setError(null);

    const formData = new FormData();
    formData.append("name", profile.name);
    formData.append("bio", profile.bio);
    if (pfpFile) {
      formData.append("pfp", pfpFile);
    }

    try {
      const response = await fetch("/api/profile", {
        // API route to update profile
        method: "POST",
        body: formData,
        credentials: "include", // Add credentials: 'include'
        // Content-Type is automatically set by browser for FormData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to save profile");
      }

      const updatedProfile = await response.json();
      // Update local state with the saved profile URL
      setProfile({
        name: updatedProfile.name,
        bio: updatedProfile.bio,
        pfp_url: updatedProfile.pfp_url,
      });
      setPfpFile(null); // Clear the file input state
      alert("Profile saved successfully!"); // Simple feedback
    } catch (err: unknown) {
      console.error("Error saving profile:", err);
      // Type check before accessing message property
      const errorMessage =
        err instanceof Error ? err.message : "Could not save profile.";
      setError(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSignOut = async () => {
    await signOut({ callbackUrl: "/" });
  };

  if (status === "loading" || isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <p>Loading...</p>
      </div>
    );
  }

  if (status === "unauthenticated") {
    // This should theoretically not be reached due to the useEffect redirect,
    // but serves as a fallback.
    return (
      <div className="flex justify-center items-center min-h-screen">
        <p>Redirecting to login...</p>
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
        <Link href="/dashboard" className="text-blue-500 hover:underline">
          Dashboard
        </Link>
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
          {profile.pfp_url && (
            <img
              src={profile.pfp_url}
              alt="Profile"
              className="w-32 h-32 rounded-full object-cover border"
            />
          )}
          {!profile.pfp_url && (
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
            placeholder="Your Name"
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
