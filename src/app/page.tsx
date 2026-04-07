import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";

const MarketingDeferredSections = dynamic(
  () => import("./_components/MarketingDeferredSections"),
  {
    loading: () => (
      <section className="mx-auto max-w-[1100px] px-6 py-12">
        <div className="space-y-4 rounded-md border border-border bg-card p-6">
          <div className="h-4 w-40 animate-pulse rounded bg-muted" />
          <div className="h-4 w-72 animate-pulse rounded bg-muted" />
          <div className="grid gap-4 md:grid-cols-3">
            <div className="h-24 animate-pulse rounded-md bg-muted" />
            <div className="h-24 animate-pulse rounded-md bg-muted" />
            <div className="h-24 animate-pulse rounded-md bg-muted" />
          </div>
        </div>
      </section>
    ),
  }
);

export default function Home() {
  const trustItems = [
    { label: "Fast setup", value: "Create your profile in minutes" },
    { label: "Live updates", value: "Track every booking end-to-end" },
    { label: "Secure payments", value: "Built-in payment experience" },
  ];

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-[1100px] items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt="Zemen Service"
              width={56}
              height={56}
              className="h-14 w-14 rounded-md object-contain"
              priority
            />
            <div className="leading-tight">
              <p className="text-[14px] font-semibold">Zemen Service</p>
              <p className="text-[13px] font-semibold text-muted-foreground">Mobile apps marketplace</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/contact-us"
              className="h-[40px] rounded-md border border-border bg-card px-4 text-[14px] font-semibold leading-[40px] text-card-foreground transition-colors hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              Contact us
            </Link>
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

      <MarketingDeferredSections />
    </main>
  );
}
