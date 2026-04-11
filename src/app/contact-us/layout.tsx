import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Contact Zemen Service for onboarding, partnerships, and app support. Reach us by email or phone in Addis Ababa, Ethiopia.",
  openGraph: {
    title: "Contact Zemen Service",
    description:
      "Get in touch for onboarding, partnerships, and app-related questions.",
  },
};

export default function ContactUsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
