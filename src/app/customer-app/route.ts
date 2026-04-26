import { headers } from "next/headers";
import { NextResponse } from "next/server";

const CUSTOMER_PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=com.zemen.service";
const CUSTOMER_APP_STORE_URL = process.env.NEXT_PUBLIC_CUSTOMER_IOS_APP_URL;

function isIosDevice(userAgent: string): boolean {
  const normalizedUserAgent = userAgent.toLowerCase();
  if (normalizedUserAgent.includes("iphone")) return true;
  if (normalizedUserAgent.includes("ipad")) return true;
  if (normalizedUserAgent.includes("ipod")) return true;
  if (normalizedUserAgent.includes("macintosh")) return true;
  return normalizedUserAgent.includes("mac os x");
}

export async function GET() {
  const requestHeaders = await headers();
  const userAgent = requestHeaders.get("user-agent") ?? "";
  const shouldUseAppStore = isIosDevice(userAgent) && Boolean(CUSTOMER_APP_STORE_URL);
  const destinationUrl = shouldUseAppStore
    ? CUSTOMER_APP_STORE_URL ?? CUSTOMER_PLAY_STORE_URL
    : CUSTOMER_PLAY_STORE_URL;

  return NextResponse.redirect(destinationUrl);
}
