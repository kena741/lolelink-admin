import type { NextConfig } from "next";

const resolvedProdUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
  process.env.SUPABASE_URL?.trim() ||
  "";
const resolvedProdAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
  process.env.SUPABASE_ANON_KEY?.trim() ||
  "";
const resolvedStagingUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL_STAGING?.trim() ||
  process.env.SUPABASE_URL_STAGING?.trim() ||
  "";
const resolvedStagingAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY_STAGING?.trim() ||
  process.env.SUPABASE_ANON_KEY_STAGING?.trim() ||
  "";

const supabaseHost = resolvedProdUrl
  ? new URL(resolvedProdUrl).hostname
  : resolvedStagingUrl
    ? new URL(resolvedStagingUrl).hostname
    : undefined;

const allowedDevOrigins = process.env.NEXT_ALLOWED_DEV_ORIGINS?.split(",")
  .map((origin) => origin.trim())
  .filter((origin) => origin.length > 0);

const nextConfig: NextConfig = {
  ...(allowedDevOrigins?.length ? { allowedDevOrigins } : {}),
  env: {
    ...(resolvedProdUrl ? { NEXT_PUBLIC_SUPABASE_URL: resolvedProdUrl } : {}),
    ...(resolvedProdAnonKey ? { NEXT_PUBLIC_SUPABASE_ANON_KEY: resolvedProdAnonKey } : {}),
    ...(resolvedStagingUrl ? { NEXT_PUBLIC_SUPABASE_URL_STAGING: resolvedStagingUrl } : {}),
    ...(resolvedStagingAnonKey
      ? { NEXT_PUBLIC_SUPABASE_ANON_KEY_STAGING: resolvedStagingAnonKey }
      : {}),
  },
  images: {
    remotePatterns: [
      ...(supabaseHost
        ? [{ protocol: "https" as const, hostname: supabaseHost, pathname: "/storage/v1/object/public/**" }]
        : []),
      { protocol: "https", hostname: "rffptyqhqvzrpmyxlwwu.supabase.co", pathname: "/storage/v1/object/public/**" },
      { protocol: "https", hostname: "cdmgxbepfixfeumytkag.supabase.co", pathname: "/storage/v1/object/public/**" },
    ],
  },
};

export default nextConfig;
