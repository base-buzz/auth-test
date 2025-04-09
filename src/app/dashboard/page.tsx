"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import { useState, useEffect } from "react";

interface DashboardProfile {
  handle: string | null;
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const [profile, setProfile] = useState<DashboardProfile | null>(null);

  useEffect(() => {
    if (status === "authenticated") {
      fetch("/api/profile")
        .then((res) => {
          if (!res.ok) throw new Error("Failed to fetch profile for dashboard");
          return res.json();
        })
        .then((data) => {
          setProfile(data);
        })
        .catch((err) => {
          console.error("Error fetching profile for dashboard:", err);
        });
    }
    if (status === "unauthenticated") {
      if (typeof window !== "undefined") window.location.href = "/";
    }
  }, [status]);

  return (
    <main className="flex min-h-screen flex-col items-center p-24">
      <h1 className="text-3xl font-bold mb-8">Dashboard</h1>
      <p className="mb-4">
        Welcome,{" "}
        {session?.user?.address ? (
          <span className="font-mono">{session.user.address}</span>
        ) : (
          "User"
        )}
        !
      </p>
      <p className="mb-8">This is a protected dashboard page.</p>
      <nav className="flex gap-4">
        {profile?.handle && (
          <Link
            href={`/${profile.handle}`}
            className="text-blue-500 hover:underline"
          >
            View Public Profile
          </Link>
        )}
        <Link href="/profile" className="text-blue-500 hover:underline">
          Edit Profile
        </Link>
        <Link href="/settings" className="text-blue-500 hover:underline">
          Settings
        </Link>
      </nav>
    </main>
  );
}
