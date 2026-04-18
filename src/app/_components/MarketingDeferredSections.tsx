"use client";

import Image from "next/image";
import {
  Apple,
  ArrowLeftRight,
  ArrowRight,
  Banknote,
  BookOpenCheck,
  Briefcase,
  Camera,
  CircleCheck,
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  FileCheck,
  Hammer,
  KeyRound,
  LogIn,
  Store,
  UserCheck,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { partnerLogoBoxClassName, partnerLogoImageSizes } from "./partner-logo-layout";

function PlayStoreIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3.637 3.434L12.377 12.005L3.702 20.655C3.56 20.47 3.45 20.263 3.376 20.042C3.338 19.792 3.338 19.537 3.376 19.287V4.567C3.35 4.172 3.441 3.777 3.636 3.434M16.142 8.267L13.289 11.093L4.653 2.6C4.933 2.503 5.233 2.476 5.526 2.522C5.986 2.648 6.425 2.842 6.828 3.095L14.644 7.42C15.152 7.693 15.647 7.98 16.142 8.267ZM13.29 12.93L16.129 15.718L14.071 16.864L7.792 20.354C7.272 20.641 6.75 20.915 6.242 21.228C6.025 21.363 5.781 21.451 5.527 21.484C5.273 21.518 5.015 21.497 4.77 21.423L13.29 12.93ZM20.65 12.005C20.657 12.355 20.569 12.7 20.394 13.003C20.22 13.306 19.966 13.556 19.66 13.725L17.314 15.027L14.227 12.005L17.327 8.931C18.122 9.374 18.904 9.817 19.685 10.234C19.996 10.408 20.252 10.667 20.423 10.98C20.594 11.294 20.673 11.649 20.65 12.005Z"
        fill="currentColor"
      />
    </svg>
  );
}

const mobileDownloadSharedDescription =
  "Book admin-approved services from providers verified with identity, medical status, and criminal record checks.";

const mobileDownloadLabels = [
  { heading: "Customer App", storeLabel: "Zemen Customer" },
  { heading: "Provider App", storeLabel: "Zemen Provider" },
  { heading: "Handyman App", storeLabel: "Zemen Handyman" },
] as const;

interface JourneyStep {
  title: string;
  description: string;
  Icon: LucideIcon;
}

interface JourneyColumnProps {
  title: string;
  description: string;
  steps: JourneyStep[];
}

function JourneyColumn({ title, description, steps }: JourneyColumnProps) {
  return (
    <article className="how-platforms-card flex h-full flex-col rounded-md border border-[#ededed] bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.06)] sm:p-6">
      <h3 className="font-[family-name:var(--font-outfit),sans-serif] text-[20px] font-bold leading-[1.2] text-[#027a3b] sm:text-[22px]">
        {title}
      </h3>
      <p className="mt-2 font-[family-name:var(--font-outfit),sans-serif] text-[15px] font-normal leading-[1.4] text-[#838383]">
        {description}
      </p>
      <ol className="mt-6 list-none space-y-0 pl-0">
        {steps.map((step, index) => {
          const Icon = step.Icon;
          const showConnector = index < steps.length - 1;
          return (
            <li key={step.title} className="flex gap-3">
              <div className="flex w-9 flex-col items-center">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#027a3b] text-white">
                  <Icon className="h-4 w-4" strokeWidth={2} aria-hidden />
                </span>
                {showConnector ? (
                  <span className="mb-px mt-1 block h-10 w-0.5 shrink-0 bg-[#027a3b]" aria-hidden />
                ) : null}
              </div>
              <div className={`min-w-0 flex-1 pt-0.5 ${showConnector ? "pb-4" : ""}`}>
                <p className="text-[15px] font-semibold leading-[1.2] text-[#1b1b1b]">{step.title}</p>
                <p className="mt-1 text-[14px] font-normal leading-[1.35] text-[#838383]">
                  {step.description}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </article>
  );
}

interface LazyMountProps {
  children: ReactNode;
  minHeightClassName?: string;
}

function LazyMount({ children, minHeightClassName = "min-h-[200px]" }: LazyMountProps) {
  const [isMounted, setIsMounted] = useState(false);
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const element = hostRef.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setIsMounted(true);
          observer.disconnect();
        }
      },
      { rootMargin: "250px 0px" }
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return <div ref={hostRef} className={isMounted ? "" : minHeightClassName}>{isMounted ? children : null}</div>;
}

export default function MarketingDeferredSections() {
  const customerJourneySteps: JourneyStep[] = [
    {
      title: "Sign Up",
      description: "Create your customer account in minutes.",
      Icon: UserPlus,
    },
    {
      title: "Browse & Book Service",
      description: "Pick a service and schedule your booking.",
      Icon: BookOpenCheck,
    },
    {
      title: "Provider Assigned",
      description: "A provider or worker is assigned to your request.",
      Icon: UserCheck,
    },
    {
      title: "Share OTP",
      description: "Share OTP at work start for secure verification.",
      Icon: KeyRound,
    },
    {
      title: "Work Completion",
      description: "Review the result and confirm completion.",
      Icon: ClipboardCheck,
    },
    {
      title: "Complete Process",
      description: "After you approve, payment releases from escrow to the provider wallet.",
      Icon: CircleCheck,
    },
  ];

  const providerJourneySteps: JourneyStep[] = [
    {
      title: "Provider Sign Up",
      description: "Register your provider account.",
      Icon: UserPlus,
    },
    {
      title: "Admin Approval for Submitted Documents",
      description: "Upload ID, medical, criminal record, and other required documents.",
      Icon: FileCheck,
    },
    {
      title: "Pay Activation Fee",
      description: "Pay activation fee before creating services.",
      Icon: CreditCard,
    },
    {
      title: "Create Approved Services",
      description: "Create Approved services with pricing and availability.",
      Icon: Briefcase,
    },
    {
      title: "Accept/Reject Booking",
      description: "Accept or reject bookings and assign worker.",
      Icon: ArrowLeftRight,
    },
    {
      title: "Complete Work",
      description: "Complete work and add extra charges if needed.",
      Icon: Hammer,
    },
    {
      title: "Withdraw Your Payment",
      description: "Request a payout from your wallet balance.",
      Icon: Banknote,
    },
  ];

  const handymanJourneySteps: JourneyStep[] = [
    {
      title: "Sign In",
      description: "Sign in with your handyman account to see assigned jobs.",
      Icon: LogIn,
    },
    {
      title: "Browse Assigned Services",
      description: "Explore admin-approved services by category and price.",
      Icon: ClipboardList,
    },
    {
      title: "Start Service and Fill OTP",
      description: "Share OTP at work start for secure verification with the customer.",
      Icon: KeyRound,
    },
    {
      title: "Work Completion",
      description: "Review the result and confirm completion.",
      Icon: ClipboardCheck,
    },
    {
      title: "Upload Proof of Completion",
      description: "Upload Photos and Videos to confirm completion.",
      Icon: Camera,
    },
    {
      title: "Complete Process",
      description: "After you approve, payment releases from escrow to the provider wallet.",
      Icon: CircleCheck,
    },
  ];

  const apps = [
    {
      name: "Zemen Service",
      description: "Find, book, and approve completed services.",
      playStoreUrl: "https://play.google.com/store/apps/details?id=com.zemen.service",
    },
    {
      name: "Zemen Provider",
      description: "Create services, accept jobs, and request withdrawals.",
      playStoreUrl: "https://play.google.com/store/apps/details?id=com.zemen.provider",
    },
    {
      name: "Zemen Handyman",
      description: "Complete assigned jobs and track work on the go.",
      playStoreUrl: "https://play.google.com/store/apps/details?id=com.zemen.handyman",
    },
  ];

  const partners = [
    { name: "Zulu Tech", logo: "/partners/zulu.png" },
    { name: "Chapa", logo: "/partners/chapa.png" },
    { name: "Ethio Telecom", logo: "/partners/et.png" },
    { name: "IBEX", logo: "/partners/ibex.png" },
    { name: "CBE", logo: "/partners/cbe.png" },
    { name: "Telebirr", logo: "/partners/telebirr.png" },
  ];

  const whyChooseItems = [
    "Customers only see admin-approved services—every listing is vetted before it goes live.",
    "Providers are verified with identity, medical status, and criminal record checks.",
    "Escrow-style payments: your money stays protected until you approve completed work.",
    "OTP when work starts, plus a clear booking lifecycle you can follow end to end.",
    "Providers receive payouts after customer approval and admin-approved withdrawal transfers.",
  ];

  return (
    <>
      <section id="partners" className="partners-bar scroll-mt-24">
        <div className="mx-auto max-w-[1640px] px-3 py-2 sm:px-6 sm:py-4">
          <LazyMount minHeightClassName="min-h-[72px] sm:min-h-[120px]">
            <div className="partner-marquee">
              <div className="partner-marquee-track">
                {partners.map((partner) => (
                  <div
                    key={partner.name}
                    className="flex items-center justify-center"
                  >
                    <div className={partnerLogoBoxClassName}>
                      <Image
                        src={partner.logo}
                        alt={`${partner.name} logo`}
                        fill
                        sizes={partnerLogoImageSizes()}
                        className="object-contain"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </LazyMount>
        </div>
      </section>

      <section
        id="download"
        className="hero-mobile-apps scroll-mt-24"
        aria-label="Download Zemen mobile apps"
      >
        <div className="hero-mobile-apps-inner">
          {mobileDownloadLabels.map((row, index) => {
            const app = apps[index];
            if (!app) return null;
            return (
              <div className="hero-mobile-apps-block" key={row.heading}>
                <h2 className="hero-mobile-apps-title">{row.heading}</h2>
                <p className="hero-mobile-apps-desc">{mobileDownloadSharedDescription}</p>
                <a
                  href={app.playStoreUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="hero-mobile-apps-btn"
                >
                  <PlayStoreIcon />
                  {row.storeLabel}
                </a>
              </div>
            );
          })}
        </div>
      </section>

      <section id="features" className="how-platforms-work scroll-mt-24">
        <LazyMount minHeightClassName="min-h-[480px]">
          <div className="how-platforms-work__inner mx-auto max-w-[1280px] px-4 py-12 sm:px-6">
            <header className="mx-auto mb-10 max-w-[720px] text-center">
              <h2 className="font-[family-name:var(--font-outfit),sans-serif] text-[28px] font-bold leading-[1.15] text-[#027a3b] sm:text-[32px]">
                How Zemen Platforms work
              </h2>
              <p className="mt-3 font-[family-name:var(--font-outfit),sans-serif] text-[16px] font-normal leading-[1.4] text-[#838383]">
                {mobileDownloadSharedDescription}
              </p>
            </header>
            <div className="grid gap-6 lg:grid-cols-3">
              <JourneyColumn
                title="Customer Journey"
                description={mobileDownloadSharedDescription}
                steps={customerJourneySteps}
              />
              <JourneyColumn
                title="Provider Journey"
                description={mobileDownloadSharedDescription}
                steps={providerJourneySteps}
              />
              <JourneyColumn
                title="Handyman Journey"
                description={mobileDownloadSharedDescription}
                steps={handymanJourneySteps}
              />
            </div>
          </div>
        </LazyMount>
      </section>

      <section className="mx-auto max-w-[1280px] px-4 sm:px-6 pb-12">
        <LazyMount minHeightClassName="min-h-[240px]">
          <div className="rounded-md border border-subtle bg-background p-6 sm:p-8">
            <h3 className="text-[24px] font-bold leading-[1.2] text-primary">Why Choose Zemen Service?</h3>
            <p className="mt-2 text-[14px] font-medium leading-[1.3] text-muted-foreground">
              Built for reliable service delivery, trust, and transparent payments.
            </p>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {whyChooseItems.map((item) => (
                <div key={item} className="rounded-md border border-subtle bg-surface p-3">
                  <p className="text-[14px] font-medium leading-[1.3] text-primary">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </LazyMount>
      </section>

      <section id="download" className="mx-auto max-w-[1280px] px-4 sm:px-6 py-12 scroll-mt-24">
        <LazyMount minHeightClassName="min-h-[280px]">
          <div className="rounded-md border border-border bg-card p-6 sm:p-8">
            <h2 className="text-[24px] font-bold leading-[1.2]">Get the apps</h2>
            <div className="mt-6 grid gap-6 md:grid-cols-[30%_70%] md:items-start lg:items-center">
              <div className="mx-auto w-[170px] overflow-hidden rounded-md border border-border bg-background p-2 sm:order-1 lg:w-[190px]">
                <Image
                  src="/zp_4.png"
                  alt="Zemen Provider app preview"
                  width={700}
                  height={1200}
                  className="h-[300px] w-auto rounded-sm object-contain lg:h-[340px]"
                />
              </div>

              <div className="space-y-4 sm:order-2">
                {apps.map((app) => (
                  <div key={app.name} className="rounded-md border border-border bg-background p-4">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <p className="text-[20px] font-bold">{app.name}</p>
                        <p className="mt-1 text-[14px] text-muted-foreground">{app.description}</p>
                      </div>
                      <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:items-stretch lg:max-w-md lg:shrink-0 xl:max-w-none">
                        <a
                          href={app.playStoreUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex h-[40px] min-h-[40px] flex-1 items-center justify-center gap-2 rounded-md bg-primary px-4 text-[14px] font-semibold text-primary-foreground transition-colors hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        >
                          <Store className="h-4 w-4 shrink-0" aria-hidden />
                          Play Store
                          <ArrowRight className="h-4 w-4 shrink-0" aria-hidden />
                        </a>
                        <a
                          href="#"
                          aria-disabled="true"
                          tabIndex={-1}
                          className="inline-flex h-[40px] min-h-[40px] flex-1 items-center justify-center gap-2 rounded-md border border-border bg-card px-4 text-[14px] font-semibold opacity-70"
                        >
                          <Apple className="h-4 w-4 shrink-0" aria-hidden />
                          Coming soon
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </LazyMount>
      </section>

      <footer className="mx-auto mt-4 max-w-[1280px] border-t border-border px-4 sm:px-6 py-6 text-[13px] font-semibold text-muted-foreground">
        © {new Date().getFullYear()} Zemen Service
      </footer>
    </>
  );
}
