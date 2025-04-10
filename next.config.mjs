/** @type {import('next').NextConfig} */

// Get hostname from environment variable - ensure this is set in Vercel!
const supabaseImageHostname = process.env.SUPABASE_IMAGE_HOSTNAME;

const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: supabaseImageHostname || "default.supabase.co", // Fallback needed if var not set
        port: "",
        pathname: "/storage/v1/object/public/**", // Allow any path in public storage
      },
      // Add other domains if needed
    ],
  },
  // Your other Next.js config options here
  reactStrictMode: true, // Example option
};

export default nextConfig;
