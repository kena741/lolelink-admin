import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatStatusLabel(value: string | null | undefined) {
  if (!value) return "Unknown"
  return value
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

export function isLocalhostHostname(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]"
}

export function isWalletMetricsDebugHost(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase()
  if (isLocalhostHostname(normalized)) return true
  if (normalized === "vercel.app" || normalized.endsWith(".vercel.app")) return true
  return false
}
