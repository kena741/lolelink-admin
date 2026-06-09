import Image from "next/image";
import Link from "next/link";

import { LandingFooter } from "../_components/landing/LandingFooter";

const productHighlights = [
  {
    title: "Verified Service Ecosystem",
    description:
      "Providers pass identity, medical, and criminal record checks before they can publish or operate services.",
  },
  {
    title: "Secure Booking Workflow",
    description:
      "Bookings are managed with clear statuses, OTP-based work start confirmation, and completion proof submission.",
  },
  {
    title: "Escrow-Style Payment Control",
    description:
      "Customer approvals drive payment release, and provider payouts are routed through admin-approved withdrawal flow.",
  },
  {
    title: "Multi-App Architecture",
    description:
      "Customer, Provider, and Handyman apps each have focused experiences with a shared service and payment backbone.",
  },
];

const targetUsers = [
  "Households and businesses booking trusted local services",
  "Service providers managing teams, pricing, and assignments",
  "Handymen executing assigned jobs and uploading completion evidence",
  "Operations teams supervising compliance, payouts, and quality control",
];

export default function SoftwareProductProfilePage() {
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
        <div className="mx-auto max-w-[1100px] px-4 py-10 sm:px-6 sm:py-14">
          <p className="font-sans text-[13px] font-semibold uppercase tracking-wide text-[#027a3b]">
            Software Product Profile
          </p>
          <h1 className="mt-2 font-sans text-[28px] font-bold leading-[1.15] text-[#027a3b] sm:text-[36px]">
            Zemen Service Platform
          </h1>
          <p className="mt-4 max-w-[820px] font-sans text-[16px] font-normal leading-[1.45] text-[#4b4b4b]">
            Zemen Service is a managed local-services platform built for trust, quality, and controlled payouts. It
            connects customers, providers, and field workers through one end-to-end operational system.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link
              href="/customer-app"
              className="inline-flex h-[40px] items-center justify-center rounded-md border border-[#027a3b] bg-[#027a3b] px-6 font-sans text-[14px] font-semibold text-white shadow-[0_4px_4px_rgba(0,0,0,0.15)] transition-colors hover:bg-[#015d2c] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#027a3b] focus-visible:ring-offset-2"
            >
              Open Customer App
            </Link>
            <Link
              href="/contact-us"
              className="inline-flex h-[40px] items-center justify-center rounded-md border border-[#027a3b] bg-[#e1eae7] px-6 font-sans text-[14px] font-semibold text-[#027a3b] transition-colors hover:bg-[#d0deda] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#027a3b] focus-visible:ring-offset-2"
            >
              Contact Product Team
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1100px] flex-1 px-4 py-10 sm:px-6 sm:py-12">
        <div className="grid gap-6 md:grid-cols-2">
          {productHighlights.map((item) => (
            <article
              key={item.title}
              className="rounded-md border border-[#ededed] bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
            >
              <h2 className="font-sans text-[20px] font-bold leading-[1.2] text-[#027a3b]">
                {item.title}
              </h2>
              <p className="mt-3 font-sans text-[15px] font-normal leading-[1.45] text-[#5a5a5a]">
                {item.description}
              </p>
            </article>
          ))}
        </div>

        <section className="mt-8 rounded-md border border-[#ededed] bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.06)] sm:p-8">
          <h2 className="font-sans text-[24px] font-bold leading-[1.2] text-[#027a3b]">
            Who it is for
          </h2>
          <ul className="mt-4 space-y-3">
            {targetUsers.map((item) => (
              <li
                key={item}
                className="rounded-md border border-[#d8e7cd] bg-[#f6fbf2] px-4 py-3 font-sans text-[15px] font-medium text-[#234a12]"
              >
                {item}
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-8 rounded-md border border-[#027a3b] bg-[#f6fbf2] p-6 sm:p-8">
          <h2 className="font-sans text-[24px] font-bold leading-[1.2] text-[#027a3b]">
            Platform availability
          </h2>
          <p className="mt-3 max-w-[760px] font-sans text-[15px] font-normal leading-[1.45] text-[#3f3f3f]">
            The platform currently supports Android and iOS distribution paths for customer and provider journeys, plus
            dedicated operational experiences for provider and handyman workflows.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <a
              href="https://play.google.com/store/apps/details?id=com.zemen.service"
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-[40px] items-center justify-center rounded-md border border-[#027a3b] bg-[#027a3b] px-6 font-sans text-[14px] font-semibold text-white transition-colors hover:bg-[#015d2c] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#027a3b] focus-visible:ring-offset-2"
            >
              Customer Play Store
            </a>
            <a
              href="https://apps.apple.com/us/app/zemen-service/id6763512421"
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-[40px] items-center justify-center rounded-md border border-[#027a3b] bg-white px-6 font-sans text-[14px] font-semibold text-[#027a3b] transition-colors hover:bg-[#eef5e8] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#027a3b] focus-visible:ring-offset-2"
            >
              App Store
            </a>
          </div>
        </section>
      </section>

      <LandingFooter />
    </main>
  );
}
