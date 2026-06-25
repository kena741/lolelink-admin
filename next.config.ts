import type { NextConfig } from "next";

function readEnv(name: string): string {
  return (process.env[name] ?? "").trim();
}

function safeSupabaseHostname(url: string): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).hostname;
  } catch {
    console.warn(`[next.config] Ignoring invalid Supabase URL: ${url}`);
    return undefined;
  }
}

const resolvedProdUrl = readEnv("NEXT_PUBLIC_SUPABASE_URL") || readEnv("SUPABASE_URL");
const resolvedProdAnonKey =
  readEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY") || readEnv("SUPABASE_ANON_KEY");
const resolvedStagingUrl =
  readEnv("NEXT_PUBLIC_SUPABASE_URL_STAGING") || readEnv("SUPABASE_URL_STAGING");
const resolvedStagingAnonKey =
  readEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY_STAGING") || readEnv("SUPABASE_ANON_KEY_STAGING");

const supabaseHost =
  safeSupabaseHostname(resolvedProdUrl) ?? safeSupabaseHostname(resolvedStagingUrl);

const allowedDevOrigins = process.env.NEXT_ALLOWED_DEV_ORIGINS?.split(",")
  .map((origin) => origin.trim())
  .filter((origin) => origin.length > 0);

function readMarketingSiteUrl(): string {
  const value =
    readEnv("MARKETING_SITE_URL") ||
    readEnv("NEXT_PUBLIC_MARKETING_SITE_URL") ||
    "https://zemenservice.com";
  return value.replace(/\/$/, "");
}

const nextConfig: NextConfig = {
  ...(allowedDevOrigins?.length ? { allowedDevOrigins } : {}),
  async redirects() {
    if (process.env.NODE_ENV !== "production") {
      return [{ source: "/", destination: "/login", permanent: false }];
    }

    const marketingBase = readMarketingSiteUrl();
    return [
      { source: "/", destination: "/login", permanent: false },
      { source: "/contact-us", destination: `${marketingBase}/contact-us`, permanent: false },
      { source: "/privacy-policy", destination: `${marketingBase}/privacy-policy`, permanent: false },
      { source: "/terms-of-service", destination: `${marketingBase}/terms-of-service`, permanent: false },
      {
        source: "/software-product-profile",
        destination: `${marketingBase}/software-product-profile`,
        permanent: false,
      },
      { source: "/customer-app", destination: `${marketingBase}/customer-app`, permanent: false },
    ];
  },
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
