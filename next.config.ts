import type { NextConfig } from "next";

// Derive Supabase host from env (e.g., https://xyz.supabase.co)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseHost = supabaseUrl ? new URL(supabaseUrl).hostname : undefined;

const nextConfig: NextConfig = {
  images: {
    // Allow Supabase storage images
    domains: [
      // fallback to a known host if env not set yet (can be removed later)
      "rffptyqhqvzrpmyxlwwu.supabase.co",
      "firebasestorage.googleapis.com",
      ...(supabaseHost ? [supabaseHost] : []),
    ],
    remotePatterns: [
      ...(supabaseHost
        ? [{ protocol: "https" as const, hostname: supabaseHost, pathname: "/storage/v1/object/public/**" }]
        : []),
      { protocol: "https", hostname: "rffptyqhqvzrpmyxlwwu.supabase.co", pathname: "/storage/v1/object/public/**" },
      { protocol: "https", hostname: "firebasestorage.googleapis.com", pathname: "/**" },
    ],
  },
};

export default nextConfig;
