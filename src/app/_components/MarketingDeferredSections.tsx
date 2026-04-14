"use client";

import Image from "next/image";
import { Apple, ArrowRight, Store } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

interface WorkflowStep {
  id: number;
  title: string;
  description: string;
}

interface WorkflowBoardProps {
  steps: WorkflowStep[];
  isVisible: boolean;
}

interface WorkflowSectionProps {
  steps: WorkflowStep[];
  title: string;
  description: string;
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

function WorkflowBoard({ steps, isVisible }: WorkflowBoardProps) {
  return (
    <div className="space-y-6">
      <div className="hidden md:block">
        <div className="flex flex-wrap items-center gap-4">
          {steps.map((step, index) => {
            const transitionDelay = `${index * 90}ms`;
            return (
              <div
                key={step.id}
                style={{ transitionDelay }}
                className={`flex items-center gap-4 transition-all duration-500 motion-reduce:transition-none ${isVisible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0 motion-reduce:translate-y-0"}`}
              >
              <div className="min-w-[240px] max-w-[320px] flex-1">
                <div className="rounded-md border border-subtle bg-gradient-to-br from-accent-info-bg to-base p-5 transition-all duration-200 hover:border-strong">
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-primary text-inverse text-[13px] font-bold leading-[1.2]">
                      {step.id}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-[14px] font-semibold leading-[1.2] text-primary">{step.title}</h4>
                      <p className="mt-1 text-[13px] font-medium leading-[1.2] text-primary">{step.description}</p>
                    </div>
                  </div>
                </div>
              </div>
              {index < steps.length - 1 ? (
                <div className="hidden shrink-0 lg:block">
                  <ArrowRight className="h-5 w-5 text-secondary" aria-hidden />
                </div>
              ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-4 md:hidden">
        {steps.map((step, index) => {
          const transitionDelay = `${index * 90}ms`;
          return (
            <div
              key={step.id}
              style={{ transitionDelay }}
              className={`flex gap-4 transition-all duration-500 motion-reduce:transition-none ${isVisible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0 motion-reduce:translate-y-0"}`}
            >
            <div className="flex shrink-0 flex-col items-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-primary text-inverse text-[14px] font-bold leading-[1.2]">
                {step.id}
              </div>
              {index < steps.length - 1 ? <div className="mt-2 h-12 w-px bg-border-strong" /> : null}
            </div>
            <div className="flex-1 rounded-md border border-subtle bg-gradient-to-br from-accent-info-bg to-base p-4">
              <h4 className="text-[16px] font-semibold leading-[1.2] text-primary">{step.title}</h4>
              <p className="mt-1 text-[14px] font-medium leading-[1.2] text-primary">{step.description}</p>
            </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WorkflowSection({ steps, title, description }: WorkflowSectionProps) {
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const element = sectionRef.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "160px 0px" }
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={sectionRef} className="space-y-8 rounded-md border border-subtle bg-background p-4 sm:p-5">
      <div className="space-y-3">
        <h3 className="text-[24px] font-bold leading-[1.2] text-primary">{title}</h3>
        <p className="text-[16px] font-normal leading-[1.3] text-primary">{description}</p>
        <div className="inline-block pt-2">
          <span className="rounded-full bg-accent-info-bg px-3 py-1 text-[13px] font-semibold leading-[1.2] text-accent-info">
            {steps.length} Steps
          </span>
        </div>
      </div>
      <WorkflowBoard steps={steps} isVisible={isVisible} />
    </div>
  );
}

export default function MarketingDeferredSections() {
  const customerAppSteps: WorkflowStep[] = [
    {
      id: 1,
      title: "Sign Up",
      description: "Create your customer account in minutes.",
    },
    {
      id: 2,
      title: "Browse Services",
      description: "Explore admin-approved services by category and price.",
    },
    {
      id: 3,
      title: "Book Service",
      description: "Pick a service and schedule your booking.",
    },
    {
      id: 4,
      title: "Provider Assigned",
      description: "A provider or worker is assigned to your request.",
    },
    {
      id: 5,
      title: "Share OTP",
      description: "Share OTP at work start for secure verification.",
    },
    {
      id: 6,
      title: "Work Completion",
      description: "Review the result and confirm completion.",
    },
    {
      id: 7,
      title: "Wallet Top-up",
      description: "After you approve, payment releases from escrow to the provider wallet.",
    },
  ];

  const providerAppSteps: WorkflowStep[] = [
    {
      id: 1,
      title: "Provider Sign Up",
      description: "Register your provider account.",
    },
    {
      id: 2,
      title: "Submit Documents",
      description: "Upload ID, medical, criminal record, and other required documents.",
    },
    {
      id: 3,
      title: "Admin Approval",
      description: "Admin verifies your documents and background checks.",
    },
    {
      id: 4,
      title: "Provider Sign In",
      description: "Sign in and access your provider dashboard.",
    },
    {
      id: 5,
      title: "Pay Activation Fee",
      description: "Pay activation fee before creating services.",
    },
    {
      id: 6,
      title: "Create Service",
      description: "Create service with pricing and availability.",
    },
    {
      id: 7,
      title: "Service Approval",
      description: "Admin approves or declines your service.",
    },
    {
      id: 8,
      title: "Accept/Reject Booking",
      description: "Accept or reject bookings and assign worker.",
    },
    {
      id: 9,
      title: "Complete Work",
      description: "Complete work and add extra charges if needed.",
    },
    {
      id: 10,
      title: "Withdraw Request",
      description: "Request a payout from your wallet balance.",
    },
    {
      id: 11,
      title: "Admin Approval",
      description: "Admin approves the withdrawal and transfers funds to you.",
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
    { name: "Zulu Tech", logo: "/partners/zulu_tech-removebg-preview.png" },
    { name: "IBEX", logo: "/partners/ibexeth_logo-removebg-preview.png" },
    { name: "Ethio Telecom", logo: "/partners/ethiotelecom-removebg-preview.png" },
    { name: "CBE", logo: "/partners/cbe-removebg-preview.png" },
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
        <div className="mx-auto max-w-[1640px] px-4 sm:px-6 py-4">
          <LazyMount minHeightClassName="min-h-[120px]">
            <div className="partner-marquee">
              <div className="partner-marquee-track">
                {[...partners, ...partners].map((partner, index) => (
                  <div
                    key={`${partner.name}-${index}`}
                    className="flex items-center gap-3 px-6"
                  >
                    <div className="relative h-[64px] w-[130px] shrink-0">
                      <Image
                        src={partner.logo}
                        alt={`${partner.name} logo`}
                        fill
                        sizes="130px"
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

      <section id="features" className="mx-auto max-w-[1280px] px-4 sm:px-6 py-12 scroll-mt-24">
        <LazyMount minHeightClassName="min-h-[380px]">
          <div className="rounded-md border border-border bg-card p-6 sm:p-8">
            <div className="grid gap-6">
              <div>
                <h2 className="text-[24px] font-bold leading-[1.2]">How Zemen Service works</h2>
                <p className="mt-2 text-[16px] font-normal leading-[1.3] text-muted-foreground">
                  A clear journey for customers, providers, and service completion.
                </p>
                <div className="mt-6 grid gap-4">
                  <WorkflowSection
                    title="Customer Journey"
                    description="From account creation to secure service completion and payment."
                    steps={customerAppSteps}
                  />
                  <WorkflowSection
                    title="Provider Journey"
                    description="From onboarding and verification to service delivery and payout."
                    steps={providerAppSteps}
                  />
                </div>
              </div>
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
