import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
    "Book trusted home and everyday services in Ethiopia. Zemen connects customers with verified providers—admin-approved listings, OTP-verified work start, and secure wallet payouts. Apps for customers, providers, and handymen.",
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
      "Book trusted services with verified providers. Customer, provider, and handyman apps with secure booking and payouts.",
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
      "Book trusted services with verified providers. Apps for customers, providers, and handymen.",
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
