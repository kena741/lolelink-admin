import Image from "next/image";
import Link from "next/link";
import { getSupabaseAdmin, getServerSupabaseTarget } from "@/lib/supabaseAdmin";

import { LandingFooter } from "../_components/landing/LandingFooter";
import { DEFAULT_CONTACT_US } from "@/features/settings/contactDefaults";
import { ContactMessageForm } from "./ContactMessageForm";
import {
  getGoogleMapsEmbedSrc,
  getGoogleMapsPlaceUrl,
  officeLocation,
} from "./office-location";

interface ContactUsRow {
  data?: unknown;
}

function parseContactUsData(value: unknown): Partial<typeof DEFAULT_CONTACT_US> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return {};
  const source = value as Record<string, unknown>;
  return {
    email: typeof source.email === "string" ? source.email : undefined,
    phoneNumber: typeof source.phoneNumber === "string" ? source.phoneNumber : undefined,
    address: typeof source.address === "string" ? source.address : undefined,
    emailSubject: typeof source.emailSubject === "string" ? source.emailSubject : undefined,
  };
}

async function getContactUsValues(): Promise<typeof DEFAULT_CONTACT_US> {
  try {
    const target = await getServerSupabaseTarget();
    const supabaseAdmin = getSupabaseAdmin(target);
    const { data } = await supabaseAdmin
      .from("app_settings")
      .select("data")
      .eq("id", "contact_us")
      .maybeSingle();
    return {
      ...DEFAULT_CONTACT_US,
      ...parseContactUsData((data as ContactUsRow | null)?.data),
    };
  } catch {
    return DEFAULT_CONTACT_US;
  }
}

export default async function ContactUsPage() {
  const contactUs = await getContactUsValues();
  const mapEmbedSrc = getGoogleMapsEmbedSrc();
  const googleMapsUrl = getGoogleMapsPlaceUrl();
  return (
    <main className="landing-page flex min-h-screen flex-col bg-white">
      <header className="landing-nav-wrapper">
        <nav className="landing-nav">
          <Link href="/" className="landing-nav-brand">
            <Image
              src="/logo.png"
              alt="Zemen Service logo"
              width={72}
              height={72}
              className="landing-nav-logo"
              priority
            />
            <span className="landing-nav-title">Zemen Service</span>
          </Link>
          <div className="landing-nav-links">
            <Link href="/contact-us" className="landing-nav-contact">
              Contact Us
            </Link>
          </div>
        </nav>
      </header>

      <section className="border-b border-[#dadada] bg-[#f9f9f9]">
        <div className="mx-auto max-w-[1280px] px-4 py-10 sm:px-6 sm:py-12">
          <p className="font-sans text-[13px] font-semibold uppercase tracking-wide text-[#027a3b]">
            Contact
          </p>
          <h1 className="mt-2 font-sans text-[28px] font-bold leading-[1.15] text-[#027a3b] sm:text-[32px]">
            Get in touch with Zemen Service
          </h1>
          <p className="mt-3 max-w-[720px] font-sans text-[16px] font-normal leading-[1.4] text-[#838383]">
            We are here to help with onboarding, partnerships, and app-related questions.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link
              href="/"
              className="inline-flex h-[40px] items-center justify-center rounded-md border border-[#027a3b] bg-[#e1eae7] px-6 font-sans text-[14px] font-semibold text-[#027a3b] transition-colors hover:bg-[#d0deda] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#027a3b] focus-visible:ring-offset-2"
            >
              Back to home
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1280px] flex-1 px-4 py-10 sm:px-6 sm:py-12">
        <div className="grid gap-4 sm:gap-5 md:grid-cols-3">
          <div className="rounded-md border border-[#b8d4c4] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.05)] sm:p-6">
            <p className="font-sans text-[13px] font-semibold text-[#027a3b]">
              Email
            </p>
            <p className="mt-2 font-sans text-[16px] font-medium text-[#1b1b1b]">
              {contactUs.email}
            </p>
          </div>
          <div className="rounded-md border border-[#b8d4c4] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.05)] sm:p-6">
            <p className="font-sans text-[13px] font-semibold text-[#027a3b]">
              Phone
            </p>
            <p className="mt-2 font-sans text-[16px] font-medium text-[#1b1b1b]">
              {contactUs.phoneNumber}
            </p>
          </div>
          <div className="rounded-md border border-[#b8d4c4] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.05)] sm:p-6">
            <p className="font-sans text-[13px] font-semibold text-[#027a3b]">
              Address
            </p>
            <p className="mt-2 font-sans text-[16px] font-medium text-[#1b1b1b]">
              {contactUs.address}
            </p>
          </div>
        </div>

        <div className="mt-8 overflow-hidden rounded-md border border-[#ededed] bg-white shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
          <div className="flex flex-col gap-3 border-b border-[#dadada] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-5">
            <div>
              <h2 className="font-sans text-[20px] font-bold leading-[1.2] text-[#027a3b]">
                Location
              </h2>
              <p className="mt-1 font-sans text-[15px] font-normal leading-[1.4] text-[#838383]">
                {officeLocation.shortLabel}
              </p>
            </div>
            <a
              href={googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-[40px] shrink-0 items-center justify-center rounded-md border border-[#027a3b] bg-[#e1eae7] px-5 font-sans text-[14px] font-semibold text-[#027a3b] transition-colors hover:bg-[#d0deda] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#027a3b] focus-visible:ring-offset-2"
            >
              Open in Google Maps
            </a>
          </div>
          <iframe
            title={`Map of ${officeLocation.shortLabel}`}
            src={mapEmbedSrc}
            className="h-[min(28rem,55vh)] w-full border-0"
            loading="lazy"
            allowFullScreen
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>

        <div className="mt-8 rounded-md border border-[#ededed] bg-white p-6 shadow-[0_2px_12px_rgba(0,0,0,0.06)] sm:p-8">
          <h2 className="font-sans text-[24px] font-bold leading-[1.2] text-[#027a3b]">
            Send us a message
          </h2>
          <p className="mt-2 font-sans text-[15px] font-normal leading-[1.4] text-[#838383]">
            Share a few details and we will get back to you as soon as we can.
          </p>
          <ContactMessageForm defaultSubject={contactUs.emailSubject} />
        </div>
      </section>

      <LandingFooter />
    </main>
  );
}
