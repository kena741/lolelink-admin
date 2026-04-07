import Image from "next/image";
import Link from "next/link";
import { Apple, Store } from "lucide-react";

export default function Home() {
  const trustItems = [
    { label: "Fast setup", value: "Create your profile in minutes" },
    { label: "Live updates", value: "Track every booking end-to-end" },
    { label: "Secure payments", value: "Built-in payment experience" },
  ];

  const features = [
    {
      title: "Book services in seconds",
      description:
        "Customers discover services, request help, and track progress with clear job status updates.",
    },
    {
      title: "Provider-ready job flow",
      description:
        "Providers receive requests, accept jobs, manage schedules, and complete work with fewer back-and-forth messages.",
    },
    {
      title: "Handyman execution mode",
      description:
        "Handymen can focus on doing the work—quick status updates, clear task details, and completion flows.",
    },
    {
      title: "Clear status tracking",
      description:
        "Everyone stays aligned with consistent booking statuses—from request to completion.",
    },
    {
      title: "Ratings & trust signals",
      description:
        "Build confidence with profile details, transparent workflows, and marketplace-friendly experiences.",
    },
    {
      title: "Built to scale with you",
      description:
        "A consistent experience across customer, provider, and handyman apps—designed for growth.",
    },
  ];

  const steps = [
    {
      title: "Download the right app",
      description:
        "Choose ZS Customer, ZS Provider, or ZS Handyman based on your role.",
    },
    {
      title: "Create your profile",
      description:
        "Set up your account and preferences so bookings and job requests match your needs.",
    },
    {
      title: "Book, accept, and complete",
      description:
        "Customers request services, providers accept, and handymen complete tasks with clear tracking.",
    },
  ];

  const faqs = [
    {
      q: "Which app should I download?",
      a: "Download ZS Customer to book services, ZS Provider to accept and manage requests, and ZS Handyman to execute tasks and complete jobs.",
    },
    {
      q: "Do the apps support booking status tracking?",
      a: "Yes. Bookings move through clear statuses so customers, providers, and handymen stay aligned from request to completion.",
    },
    {
      q: "Which payments are supported?",
      a: "Payments are supported in the apps for a smooth booking experience, including popular gateways like Chapa and Flutterwave (availability depends on your region).",
    },
    {
      q: "Do you support multiple languages?",
      a: "Yes. The apps can support multiple languages so customers, providers, and handymen can use Zemen Service in the language they prefer.",
    },
  ];

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-[1100px] items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt="Zemen Service"
              width={40}
              height={40}
              className="h-10 w-10 rounded-md object-contain"
              priority
            />
            <div className="leading-tight">
              <p className="text-[14px] font-semibold">Zemen Service</p>
              <p className="text-[13px] font-semibold text-muted-foreground">Mobile apps marketplace</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="#download"
              className="h-[40px] rounded-md bg-primary px-4 text-[14px] font-semibold leading-[40px] text-primary-foreground transition-colors hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              Get the app
            </Link>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-primary via-accent to-secondary opacity-15" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(59,107,33,0.18),transparent_55%)]" />
        <div className="relative mx-auto max-w-[1100px] px-6 py-14 sm:py-20">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
            <div>
              <p className="inline-flex items-center rounded-full border border-border bg-card px-3 py-1 text-[13px] font-semibold text-muted-foreground">
                Built for on-demand services
              </p>
              <h1 className="mt-4 text-[32px] font-bold leading-[1.1] sm:text-[40px]">
                Three apps. One Zemen Service marketplace.
              </h1>
              <p className="mt-4 text-[16px] font-normal leading-[1.3] text-muted-foreground">
                ZS Customer for bookings, ZS Provider for managing requests, and ZS Handyman for getting the job done.
                Built to keep everyone in sync with clear status updates.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Link
                  href="#download"
                  className="h-[40px] rounded-md bg-primary px-5 text-[14px] font-semibold leading-[40px] text-primary-foreground transition-colors hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  Download the app
                </Link>
                <Link
                  href="#features"
                  className="h-[40px] rounded-md border border-border bg-card px-5 text-[14px] font-semibold leading-[40px] text-card-foreground transition-colors hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  Explore features
                </Link>
              </div>
              <div className="mt-10 grid gap-4 sm:grid-cols-3">
                {trustItems.map((item) => (
                  <div key={item.label} className="rounded-md border border-border bg-card p-4">
                    <p className="text-[13px] font-semibold text-muted-foreground">{item.label}</p>
                    <p className="mt-1 text-[14px] font-semibold">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-md border border-border bg-card p-6 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
              <div className="flex items-center justify-between">
                <p className="text-[14px] font-semibold">What you can do</p>
                <p className="text-[13px] font-semibold text-muted-foreground">Across the apps</p>
              </div>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {[
                  "Book services",
                  "Accept requests",
                  "Track job status",
                  "Chat & coordination",
                  "Payments",
                  "Earnings tracking",
                  "Ratings & reviews",
                  "Support flows",
                ].map((label) => (
                  <div
                    key={label}
                    className="rounded-md border border-border bg-background px-4 py-3 text-[14px] font-semibold text-foreground"
                  >
                    {label}
                  </div>
                ))}
              </div>
              <div className="mt-6 rounded-md border border-border bg-muted p-4">
                <p className="text-[13px] font-semibold text-muted-foreground">Tip</p>
                <p className="mt-1 text-[14px] font-semibold">
                  Choose the app for your role—customer, provider, or handyman.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-[1100px] px-6 py-14 scroll-mt-24">
        <div className="flex items-end justify-between gap-6">
          <div>
            <h2 className="text-[24px] font-bold leading-[1.2] sm:text-[24px]">Everything you need to operate</h2>
            <p className="mt-2 text-[16px] font-normal leading-[1.3] text-muted-foreground">
              Practical workflows for a services marketplace—optimized for day-to-day use.
            </p>
          </div>
          <Link
            href="#download"
            className="hidden h-[40px] rounded-md border border-border bg-card px-4 text-[14px] font-semibold leading-[40px] text-card-foreground transition-colors hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:inline-block"
          >
            Get the app
          </Link>
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-md border border-border bg-card p-6 shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
            >
              <p className="text-[20px] font-bold leading-[1.2]">{f.title}</p>
              <p className="mt-2 text-[16px] font-normal leading-[1.3] text-muted-foreground">{f.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-border bg-card/40">
        <div className="mx-auto max-w-[1100px] px-6 py-14">
          <h2 className="text-[24px] font-bold leading-[1.2] sm:text-[24px]">Get started in three steps</h2>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {steps.map((s, idx) => (
              <div key={s.title} className="rounded-md border border-border bg-card p-6">
                <p className="text-[13px] font-semibold text-muted-foreground">Step {idx + 1}</p>
                <p className="mt-2 text-[20px] font-bold leading-[1.2]">{s.title}</p>
                <p className="mt-2 text-[16px] font-normal leading-[1.3] text-muted-foreground">{s.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="download" className="mx-auto max-w-[1100px] px-6 py-14 scroll-mt-24">
        <div className="rounded-md border border-border bg-card p-8 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
          <div className="flex flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-[24px] font-bold leading-[1.2] sm:text-[24px]">Get the apps</h2>
              <p className="mt-2 text-[16px] font-normal leading-[1.3] text-muted-foreground">
                Download the right app for your role. Store links will be available soon.
              </p>
            </div>
          </div>

          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {[
              {
                name: "ZS Customer",
                description: "Book services, track progress, and manage payments.",
              },
              {
                name: "ZS Provider",
                description: "Accept jobs, manage availability, and track earnings.",
              },
              {
                name: "ZS Handyman",
                description: "Handle tasks, update statuses, and complete jobs faster.",
              },
            ].map((app) => (
              <div
                key={app.name}
                className="rounded-md border border-border bg-background p-6 shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
              >
                <p className="text-[20px] font-bold leading-[1.2]">{app.name}</p>
                <p className="mt-2 text-[16px] font-normal leading-[1.3] text-muted-foreground">
                  {app.description}
                </p>
                <div className="mt-6 flex flex-col gap-3">
                  <a
                    href="#"
                    aria-disabled="true"
                    tabIndex={-1}
                    className="inline-flex h-[40px] items-center justify-center gap-2 rounded-md bg-primary px-5 text-[14px] font-semibold text-primary-foreground opacity-60"
                  >
                    <Store className="h-4 w-4 shrink-0" aria-hidden />
                    Google Play (coming soon)
                  </a>
                  <a
                    href="#"
                    aria-disabled="true"
                    tabIndex={-1}
                    className="inline-flex h-[40px] items-center justify-center gap-2 rounded-md border border-border bg-card px-5 text-[14px] font-semibold text-card-foreground opacity-60"
                  >
                    <Apple className="h-4 w-4 shrink-0" aria-hidden />
                    App Store (coming soon)
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-border bg-card/40">
        <div className="mx-auto max-w-[1100px] px-6 py-14">
          <h2 className="text-[24px] font-bold leading-[1.2] sm:text-[24px]">FAQ</h2>
          <div className="mt-6 space-y-3">
            {faqs.map((f) => (
              <details
                key={f.q}
                className="rounded-md border border-border bg-card px-5 py-4 open:bg-muted"
              >
                <summary className="cursor-pointer text-[16px] font-semibold leading-[1.3]">
                  {f.q}
                </summary>
                <p className="mt-3 text-[16px] font-normal leading-[1.3] text-muted-foreground">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1100px] px-6 py-14">
        <div className="rounded-md border border-border bg-primary p-8 text-primary-foreground">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[24px] font-bold leading-[1.2]">Ready to launch Zemen Service?</p>
              <p className="mt-2 text-[16px] font-normal leading-[1.3] text-primary-foreground/90">
                Download the mobile app and start booking services in minutes.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href="#download"
                className="h-[40px] rounded-md bg-card px-5 text-[14px] font-semibold leading-[40px] text-card-foreground transition-colors hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                Get the app
              </Link>
              <Link
                href="#features"
                className="h-[40px] rounded-md border border-primary-foreground/30 px-5 text-[14px] font-semibold leading-[40px] text-primary-foreground transition-colors hover:bg-primary-foreground/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                Explore features
              </Link>
            </div>
          </div>
        </div>
        <footer className="mt-10 border-t border-border pt-6 text-[13px] font-semibold text-muted-foreground">
          © {new Date().getFullYear()} Zemen Service
        </footer>
      </section>
    </main>
  );
}
