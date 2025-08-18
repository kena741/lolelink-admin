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
      ...(supabaseHost ? [supabaseHost] : []),
    ],
  },
};

export default nextConfig;
