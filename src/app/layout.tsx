import type { Metadata } from "next";
import { Geist, Geist_Mono, New_Amsterdam, Outfit } from "next/font/google";
import "./globals.css";
import Providers from "./providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const newAmsterdam = New_Amsterdam({
  weight: "400",
  variable: "--font-new-amsterdam",
  subsets: ["latin"],
});

const outfit = Outfit({
  weight: ["300", "400", "500", "600"],
  variable: "--font-outfit",
  subsets: ["latin"],
});

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://zemenservice.com");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Zemen Service — Book verified local services in Ethiopia",
    template: "%s · Zemen Service",
  },
  description:
    "Book admin-approved services in Ethiopia. Verified providers (ID, medical, criminal checks). Escrow until you approve work; admin-approved payouts. OTP at start. Customer, provider, and handyman apps.",
  keywords: [
    "Zemen",
    "Zemen Service",
    "Ethiopia",
    "book services",
    "home services",
    "service providers",
    "Addis Ababa",
  ],
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    siteName: "Zemen Service",
    title: "Zemen Service — Book verified local services in Ethiopia",
    description:
      "Admin-approved services, verified providers (medical and criminal checks), escrow-style payments until completion, admin-approved payouts. Customer, provider, and handyman apps.",
    images: [
      {
        url: "/logo.png",
        width: 512,
        height: 512,
        alt: "Zemen Service",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Zemen Service — Book verified local services in Ethiopia",
    description:
      "Admin-approved services, escrow-style payments, verified providers. Apps for customers, providers, and handymen.",
    images: ["/logo.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${newAmsterdam.variable} ${outfit.variable} antialiased`}
      >
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
