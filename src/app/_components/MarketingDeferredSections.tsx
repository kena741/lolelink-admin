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
  ChevronDown,
  FileCheck,
  Facebook,
  Hammer,
  Instagram,
  KeyRound,
  LogIn,
  Music2,
  Send,
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

interface WhyChoosePlainCard {
  key: string;
  image: string;
  alt: string;
  variant: "plain";
  text: string;
}

interface WhyChooseEscrowCard {
  key: string;
  image: string;
  alt: string;
  variant: "escrow";
}

interface WhyChooseFeaturedCard {
  key: string;
  image: string;
  alt: string;
  variant: "featured";
  text: string;
}

interface WhyChooseThankYouCard {
  key: string;
  image: string;
  alt: string;
  variant: "thankyou";
}

type WhyChooseCard =
  | WhyChoosePlainCard
  | WhyChooseEscrowCard
  | WhyChooseFeaturedCard
  | WhyChooseThankYouCard;

function WhyChooseGridCard({ card, index }: { card: WhyChooseCard; index: number }) {
  const colSpanClass = index >= 4 ? "col-span-2 md:col-span-1" : "";

  const imageBlock = (
    <div className="flex min-h-[100px] w-full items-center justify-center sm:min-h-[120px]">
      <Image
        src={card.image}
        alt={card.alt}
        width={200}
        height={160}
        sizes="(max-width: 767px) 42vw, 28vw"
        className="h-auto max-h-[120px] w-auto max-w-full object-contain sm:max-h-[140px]"
      />
    </div>
  );

  if (card.variant === "featured") {
    return (
      <div
        className={`flex flex-col items-center gap-4 rounded-md bg-[#027a3b] px-4 py-5 text-center shadow-[0_2px_12px_rgba(2,122,59,0.2)] sm:px-5 sm:py-6 ${colSpanClass}`}
      >
        {imageBlock}
        <p className="font-[family-name:var(--font-outfit),sans-serif] text-[14px] font-medium leading-[1.35] text-white sm:text-[15px]">
          {card.text}
        </p>
      </div>
    );
  }

  if (card.variant === "thankyou") {
    return (
      <div
        className={`flex flex-col items-center gap-3 rounded-md border border-[#b8d4c4] bg-white p-4 text-center shadow-[0_1px_3px_rgba(0,0,0,0.05)] sm:p-5 ${colSpanClass}`}
      >
        {imageBlock}
        <p className="font-[family-name:var(--font-outfit),sans-serif] text-[14px] font-normal leading-[1.35] text-[#1b1b1b] sm:text-[15px]">
          Thank you for choosing{" "}
          <span className="font-bold text-[#027a3b]">Zemen</span>
        </p>
      </div>
    );
  }

  if (card.variant === "escrow") {
    return (
      <div
        className={`flex flex-col items-center gap-3 rounded-md border border-[#b8d4c4] bg-white p-4 text-center shadow-[0_1px_3px_rgba(0,0,0,0.05)] sm:p-5 ${colSpanClass}`}
      >
        {imageBlock}
        <p className="font-[family-name:var(--font-outfit),sans-serif] text-[14px] font-normal leading-[1.35] text-[#1b1b1b] sm:text-[15px]">
          <span className="font-semibold text-[#027a3b]">Escrow-style payments:</span> your money stays protected
          until you approve completed work.
        </p>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col items-center gap-3 rounded-md border border-[#b8d4c4] bg-white p-4 text-center shadow-[0_1px_3px_rgba(0,0,0,0.05)] sm:p-5 ${colSpanClass}`}
    >
      {imageBlock}
      <p className="font-[family-name:var(--font-outfit),sans-serif] text-[14px] font-normal leading-[1.35] text-[#1b1b1b] sm:text-[15px]">
        {card.text}
      </p>
    </div>
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

  const whyChooseCards: WhyChooseCard[] = [
    {
      key: "vetted",
      image: "/why/w1.png",
      alt: "Admin-approved listings",
      variant: "plain",
      text: "Every listing is vetted before it goes live.",
    },
    {
      key: "verified",
      image: "/why/w2.png",
      alt: "Verified providers",
      variant: "plain",
      text: "Providers are verified with identity, medical status, and criminal record checks.",
    },
    {
      key: "escrow",
      image: "/why/w3.png",
      alt: "Escrow payments",
      variant: "escrow",
    },
    {
      key: "payouts",
      image: "/why/w4.png",
      alt: "Provider payouts",
      variant: "plain",
      text: "Payouts after customer approval and admin-approved withdrawal transfers.",
    },
    {
      key: "lifecycle",
      image: "/why/w5.png",
      alt: "Booking steps",
      variant: "featured",
      text: "Clear booking lifecycle you can follow end to end.",
    },
    {
      key: "thanks",
      image: "/why/w6.png",
      alt: "Thank you",
      variant: "thankyou",
    },
  ];

  const faqItems = [
    {
      question: "Where can I Get the Service?",
      answer:
        "You can get service across Addis Ababa in areas currently covered by Zemen. Open the app, pick your location, and you will only see available providers near you.",
    },
    {
      question: "When can i payout?",
      answer:
        "Providers can request payout after work completion is approved by the customer and withdrawal is approved by admin.",
    },
    {
      question: "How do i get a service?",
      answer:
        "Create your customer account, browse approved services, book your preferred provider, then confirm completion with OTP and final approval.",
    },
    {
      question: "How to provide a service?",
      answer:
        "Sign up as a provider, upload required documents for verification, activate your account, then create services and start receiving bookings.",
    },
  ] as const;

  const [openFaqIndex, setOpenFaqIndex] = useState(0);
  const socialLinks = [
    { label: "Telegram", Icon: Send, href: "#" },
    { label: "Facebook", Icon: Facebook, href: "#" },
    { label: "TikTok", Icon: Music2, href: "#" },
    { label: "Instagram", Icon: Instagram, href: "#" },
  ] as const;

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

      <section id="why-choose" className="mx-auto max-w-[1280px] scroll-mt-24 px-4 py-12 sm:px-6">
        <LazyMount minHeightClassName="min-h-[320px]">
          <div>
            <header className="mx-auto mb-8 max-w-[720px] text-center">
              <h2 className="font-[family-name:var(--font-outfit),sans-serif] text-[24px] font-bold leading-[1.2] text-[#027a3b] sm:text-[28px]">
                Why Choose Zemen Service?
              </h2>
              <p className="mt-3 font-[family-name:var(--font-outfit),sans-serif] text-[15px] font-normal leading-[1.4] text-[#838383] sm:text-[16px]">
                {mobileDownloadSharedDescription}
              </p>
            </header>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5">
              {whyChooseCards.map((card, index) => (
                <WhyChooseGridCard key={card.key} card={card} index={index} />
              ))}
            </div>
          </div>
        </LazyMount>
      </section>

      <section id="faq" className="bg-[#eef3ef] px-4 py-10 sm:px-6 sm:py-12 scroll-mt-24">
        <LazyMount minHeightClassName="min-h-[320px]">
          <div className="mx-auto grid w-full max-w-[1280px] gap-8 lg:grid-cols-[34%_66%] lg:items-center">
            <div className="order-2 relative mx-auto w-full max-w-[320px] lg:order-1 lg:max-w-[380px]">
              <div className="absolute left-1/2 top-8 h-[220px] w-[220px] -translate-x-1/2 rounded-full bg-[#6ee260]/30 blur-3xl" />
              <Image
                src="/man.png"
                alt="Service professional"
                width={760}
                height={1000}
                sizes="(max-width: 1023px) 320px, 380px"
                className="relative z-10 h-auto w-full object-contain"
              />
            </div>

            <div className="order-1 lg:order-2">
              <h2 className="font-[family-name:var(--font-outfit),sans-serif] text-[32px] font-bold leading-[1.1] text-[#027a3b]">
                FAQ
              </h2>
              <p className="mt-2 max-w-[560px] font-[family-name:var(--font-outfit),sans-serif] text-[14px] font-normal leading-[1.4] text-[#7b7b7b] sm:text-[15px]">
                {mobileDownloadSharedDescription}
              </p>

              <div className="mt-5 space-y-3">
                {faqItems.map((item, index) => {
                  const isOpen = index === openFaqIndex;
                  return (
                    <article key={item.question} className="overflow-hidden rounded-md border border-[#e2e2e2] bg-white">
                      <button
                        type="button"
                        className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left"
                        onClick={() => setOpenFaqIndex((prevIndex) => (prevIndex === index ? -1 : index))}
                        aria-expanded={isOpen}
                      >
                        <span className="text-[16px] font-semibold leading-[1.2] text-[#1b1b1b]">{item.question}</span>
                        <ChevronDown
                          className={`h-4 w-4 shrink-0 text-[#027a3b] transition-transform duration-150 ${isOpen ? "rotate-180" : "rotate-0"}`}
                          aria-hidden
                        />
                      </button>
                      {isOpen ? (
                        <div className="border-t border-[#efefef] px-4 py-3">
                          <p className="text-[14px] font-normal leading-[1.45] text-[#5f5f5f]">{item.answer}</p>
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            </div>
          </div>
        </LazyMount>
      </section>

      <footer className="bg-[#01572a]">
        <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-6 px-5 py-6 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:py-4">
          <div className="flex items-center justify-center gap-3 text-center lg:justify-start lg:text-left">
            <Image
              src="/logo_white.svg"
              alt="Zemen Service logo"
              width={72}
              height={72}
              className="h-[64px] w-[64px] object-contain opacity-100 lg:h-[44px] lg:w-[44px]"
            />
            <div>
              <p className="text-[17px] font-semibold leading-[1.2] text-white lg:text-[20px]">Zemen Service</p>
              <p className="text-[14px] font-light leading-[1.2] text-white lg:text-[15px]">
                © {new Date().getFullYear()} Zemen Service
              </p>
            </div>
          </div>

          <div className="flex w-full flex-col items-center gap-3 border-t border-white/25 pt-6 text-center lg:w-auto lg:items-start lg:border-t-0 lg:pt-0 lg:text-left">
            <p className="text-[14px] font-semibold leading-[1.2] text-white lg:text-[14px]">Join us on our socials</p>
            <div className="flex items-center gap-3">
              {socialLinks.map(({ label, Icon, href }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  className="inline-flex h-[42px] w-[42px] items-center justify-center rounded-full bg-white/20 text-white/80 transition-all duration-150 hover:bg-white/30 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#01572a] lg:h-[30px] lg:w-[30px]"
                >
                  <Icon className="h-[21px] w-[21px] lg:h-[16px] lg:w-[16px]" aria-hidden />
                </a>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}
