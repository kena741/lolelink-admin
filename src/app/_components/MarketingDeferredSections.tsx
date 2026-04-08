import Image from "next/image";
import { Apple, ArrowRight, Store } from "lucide-react";

interface WorkflowStep {
  id: number;
  title: string;
  description: string;
}

interface WorkflowBoardProps {
  steps: WorkflowStep[];
}

interface WorkflowSectionProps {
  steps: WorkflowStep[];
  title: string;
  description: string;
}

function WorkflowBoard({ steps }: WorkflowBoardProps) {
  return (
    <div className="space-y-6">
      <div className="hidden md:block">
        <div className="flex flex-wrap items-center gap-4">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center gap-4">
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
          ))}
        </div>
      </div>

      <div className="space-y-4 md:hidden">
        {steps.map((step, index) => (
          <div key={step.id} className="flex gap-4">
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
        ))}
      </div>
    </div>
  );
}

function WorkflowSection({ steps, title, description }: WorkflowSectionProps) {
  return (
    <div className="space-y-8 rounded-md border border-subtle bg-background p-4 sm:p-5">
      <div className="space-y-3">
        <h3 className="text-[24px] font-bold leading-[1.2] text-primary">{title}</h3>
        <p className="text-[16px] font-normal leading-[1.3] text-primary">{description}</p>
        <div className="inline-block pt-2">
          <span className="rounded-full bg-accent-info-bg px-3 py-1 text-[13px] font-semibold leading-[1.2] text-accent-info">
            {steps.length} Steps
          </span>
        </div>
      </div>
      <WorkflowBoard steps={steps} />
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
      description: "Explore approved services by category and price.",
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
      description: "Payment is processed to the provider wallet.",
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
      description: "Upload national ID and required documents.",
    },
    {
      id: 3,
      title: "Admin Approval",
      description: "Admin reviews and verifies your documents.",
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
      description: "Submit wallet withdrawal request.",
    },
    {
      id: 11,
      title: "Admin Approval",
      description: "Admin approves and transfers funds.",
    },
  ];

  const apps = [
    { name: "ZS Customer", description: "Find, book, and approve completed services." },
    { name: "ZS Provider", description: "Create services, accept jobs, and request withdrawals." },
  ];

  const partners = [
    { name: "Zulu Tech", logo: "/partners/zulu_tech-removebg-preview.png" },
    { name: "IBEX", logo: "/partners/ibexeth_logo-removebg-preview.png" },
    { name: "Ethio Telecom", logo: "/partners/ethiotelecom-removebg-preview.png" },
    { name: "CBE", logo: "/partners/cbe-removebg-preview.png" },
  ];

  const whyChooseItems = [
    "Verified providers with admin-led document checks.",
    "Secure service start using customer OTP verification.",
    "Only approved services are shown to customers.",
    "Clear booking lifecycle with real-time progress visibility.",
    "Reliable wallet payouts with admin-approved withdrawals.",
  ];

  return (
    <>
      <section id="partners" className="border-b border-subtle bg-base scroll-mt-24">
        <div className="mx-auto max-w-[1280px] px-4 sm:px-6 py-10">
          <div className="rounded-md border border-subtle bg-surface p-6 sm:p-8">
            <div className="flex flex-col items-center text-center">
              <p className="text-[13px] font-semibold leading-[1.2] text-muted-foreground">Trusted Partners</p>
              <h2 className="mt-2 text-[24px] font-bold leading-[1.2] text-primary">Our Partners</h2>
            </div>
            <div className="partner-marquee mt-8">
              <div className="partner-marquee-track">
                {[...partners, ...partners].map((partner, index) => (
                  <div
                    key={`${partner.name}-${index}`}
                    className="rounded-md bg-gradient-to-r from-accent-info/40 via-border-subtle to-accent-primary/45 p-px"
                  >
                    <div className="flex items-center gap-4 rounded-md bg-base px-4 py-3">
                      <div className="relative h-[56px] w-[120px] shrink-0">
                        <Image
                          src={partner.logo}
                          alt={`${partner.name} logo`}
                          fill
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                          className="object-contain"
                        />
                      </div>
                      <p className="text-[16px] font-bold leading-[1.2] text-primary">{partner.name}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-[1280px] px-4 sm:px-6 py-12 scroll-mt-24">
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
      </section>

      <section className="mx-auto max-w-[1280px] px-4 sm:px-6 pb-12">
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
      </section>

      <section id="download" className="mx-auto max-w-[1280px] px-4 sm:px-6 py-12 scroll-mt-24">
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
                    <div className="flex flex-col gap-2 sm:flex-row lg:shrink-0">
                      <a
                        href="https://play.google.com/store/apps/details?id=com.zemen.service"
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-[40px] items-center justify-center gap-2 rounded-md bg-primary px-4 text-[14px] font-semibold text-primary-foreground transition-colors hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      >
                        <Store className="h-4 w-4" aria-hidden />
                        Play Store
                        <ArrowRight className="h-4 w-4" aria-hidden />
                      </a>
                      <a
                        href="#"
                        aria-disabled="true"
                        tabIndex={-1}
                        className="inline-flex h-[40px] items-center justify-center gap-2 rounded-md border border-border bg-card px-4 text-[14px] font-semibold opacity-70"
                      >
                        <Apple className="h-4 w-4" aria-hidden />
                        Coming soon
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <footer className="mx-auto mt-4 max-w-[1280px] border-t border-border px-4 sm:px-6 py-6 text-[13px] font-semibold text-muted-foreground">
        © {new Date().getFullYear()} Zemen Service
      </footer>
    </>
  );
}
