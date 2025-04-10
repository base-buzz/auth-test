// Remove the import type statement
// import type { NextConfig } from "next";

// Read the hostname from environment variables
const supabaseImageHostname = process.env.SUPABASE_IMAGE_HOSTNAME;

if (!supabaseImageHostname) {
  // Optionally throw an error if the variable is required for the build
  console.warn(
    `\x1b[33mwarn\x1b[0m  - SUPABASE_IMAGE_HOSTNAME environment variable is not set. Image optimization for Supabase assets will be disabled.`
  );
  // Or throw new Error("SUPABASE_IMAGE_HOSTNAME environment variable is not set.");
}

// Remove the NextConfig type annotation
const nextConfig = {
  images: {
    // Use remotePatterns with the environment variable
    remotePatterns: supabaseImageHostname
      ? [
          {
            protocol: "https",
            hostname: supabaseImageHostname,
            // port: "", // port is optional, omitting is fine
            // pathname: "/storage/v1/object/public/**", // pathname is optional, omitting allows any path
          },
        ]
      : [], // Disable if hostname is not set
  },
};

export default nextConfig;
