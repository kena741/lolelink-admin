import type { Metadata } from "next";
import { Geist_Mono, Inter, Plus_Jakarta_Sans, Space_Grotesk } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import Providers from "./providers";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  display: "swap",
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
  icons: {
    icon: [
      {
        url: "/logo.png?v=5",
        type: "image/png",
        sizes: "32x32",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/logo_white.png?v=5",
        type: "image/png",
        sizes: "32x32",
        media: "(prefers-color-scheme: dark)",
      },
      { url: "/logo.png?v=5", type: "image/png", sizes: "192x192" },
    ],
    apple: [{ url: "/logo.png?v=5", type: "image/png", sizes: "180x180" }],
  },
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
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${plusJakartaSans.variable} ${spaceGrotesk.variable} ${geistMono.variable}`}
    >
      <body className="font-sans antialiased">
        <Script id="theme-favicon" strategy="beforeInteractive">
          {`(function () {
  var lightIcon = "/logo.png?v=5";
  var darkIcon = "/logo_white.png?v=5";
  var media = window.matchMedia("(prefers-color-scheme: dark)");
  function upsertThemeFavicon() {
    var href = media.matches ? darkIcon : lightIcon;
    var existingIcons = document.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"]');
    for (var i = 0; i < existingIcons.length; i += 1) {
      var icon = existingIcons[i];
      if (icon.id !== "theme-favicon-link") icon.parentNode && icon.parentNode.removeChild(icon);
    }
    var favicon = document.querySelector('link#theme-favicon-link');
    if (!favicon) {
      favicon = document.createElement("link");
      favicon.id = "theme-favicon-link";
      favicon.rel = "icon";
      favicon.type = "image/png";
      favicon.sizes = "32x32";
      document.head.appendChild(favicon);
    }
    if (favicon.getAttribute("href") !== href) favicon.setAttribute("href", href);
  }
  upsertThemeFavicon();
  if (typeof media.addEventListener === "function") media.addEventListener("change", upsertThemeFavicon);
  else if (typeof media.addListener === "function") media.addListener(upsertThemeFavicon);
})();`}
        </Script>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
