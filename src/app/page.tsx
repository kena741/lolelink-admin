import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Apple, ChevronsDown, Store } from "lucide-react";

const MarketingDeferredSections = dynamic(
  () => import("./_components/MarketingDeferredSections"),
  {
    loading: () => (
      <section className="mx-auto max-w-[1280px] px-4 sm:px-6 py-12">
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
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-2 px-3 py-3 sm:gap-4 sm:px-6 sm:py-4">
          <Link
            href="/"
            className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-md"
          >
            <Image
              src="/logo.png"
              alt=""
              width={56}
              height={56}
              className="h-10 w-10 shrink-0 rounded-md object-contain sm:h-14 sm:w-14"
              priority
            />
            <span className="truncate text-[13px] font-semibold leading-tight sm:text-[14px]">Zemen Service</span>
          </Link>
          <nav
            className="flex shrink-0 items-center gap-2 sm:gap-3"
            aria-label="Primary"
          >
            <Link
              href="/contact-us"
              className="inline-flex h-10 min-h-10 min-w-[40px] items-center justify-center rounded-md border border-border bg-card px-2.5 text-[13px] font-semibold text-card-foreground transition-colors hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:h-[40px] sm:min-h-[40px] sm:px-4 sm:text-[14px]"
            >
              <span className="sm:hidden">Contact</span>
              <span className="hidden sm:inline">Contact us</span>
            </Link>
            <Link
              href="#download"
              className="inline-flex h-10 min-h-10 min-w-[40px] items-center justify-center rounded-md bg-primary px-2.5 text-[13px] font-semibold text-primary-foreground transition-colors hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:h-[40px] sm:min-h-[40px] sm:px-4 sm:text-[14px]"
            >
              <span className="sm:hidden">Apps</span>
              <span className="hidden sm:inline">Get the app</span>
            </Link>
          </nav>
        </div>
      </header>

      <section className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-accent/15 to-secondary/20" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_left_top,rgba(59,107,33,0.25),transparent_45%)]" />
        <div className="relative mx-auto max-w-[1280px] px-4 sm:px-6 py-14 sm:py-20">
          <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:items-center">
            <div>
              <p className="inline-flex items-center rounded-full border border-border bg-card px-3 py-1 text-[13px] font-semibold text-muted-foreground">
                Book services · Verified providers
              </p>
              <h1 className="mt-4 text-[32px] font-bold leading-[1.1] sm:text-[40px]">
                Trusted local services, booked in minutes.
              </h1>
              <p className="mt-4 text-[16px] font-normal leading-[1.3] text-muted-foreground">
                Zemen connects customers with verified providers in Ethiopia—admin-approved listings, OTP-verified work start, and secure wallet payouts.
              </p>
              <div className="mt-8 flex flex-col gap-3">
                <Link
                  href="#features"
                  className="inline-flex w-fit items-center rounded-sm text-[14px] font-semibold leading-[1.2] text-primary underline underline-offset-4 transition-colors hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  How it works
                </Link>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <a
                    href="https://play.google.com/store/apps/details?id=com.zemen.service"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-[40px] w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-[14px] font-semibold text-primary-foreground transition-colors hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <Store className="h-4 w-4 shrink-0" aria-hidden />
                    Zemen Service
                  </a>
                  <a
                    href="https://play.google.com/store/apps/details?id=com.zemen.provider"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-[40px] w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-[14px] font-semibold text-primary-foreground transition-colors hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <Store className="h-4 w-4 shrink-0" aria-hidden />
                    Zemen Provider
                  </a>
                  <a
                    href="https://play.google.com/store/apps/details?id=com.zemen.handyman"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-[40px] w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-[14px] font-semibold text-primary-foreground transition-colors hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <Store className="h-4 w-4 shrink-0" aria-hidden />
                    Zemen Handyman
                  </a>
                  <a
                    href="#"
                    aria-disabled="true"
                    tabIndex={-1}
                    className="inline-flex h-[40px] w-full items-center justify-center gap-2 rounded-md border border-border bg-card px-4 text-[14px] font-semibold text-card-foreground opacity-70 sm:col-span-3"
                  >
                    <Apple className="h-4 w-4 shrink-0" aria-hidden />
                    App Store — coming soon
                  </a>
                </div>
              </div>
            </div>

            <div className="grid gap-4">
              <div className="-rotate-2 overflow-hidden rounded-md border border-border bg-card p-2 shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
                <Image
                  src="/Zemen-Service-Main-Preview.png"
                  alt="Zemen Service app preview"
                  width={1200}
                  height={700}
                  sizes="(max-width: 1024px) 100vw, 52vw"
                  className="h-auto w-full rounded-sm object-cover"
                  priority
                />
              </div>
              <div className="rotate-1 overflow-hidden rounded-md border border-border bg-card p-2 shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
                <Image
                  src="/Zemen-Provider-Main-Preview.png"
                  alt="Zemen Provider app preview"
                  width={1200}
                  height={700}
                  sizes="(max-width: 1024px) 100vw, 52vw"
                  className="h-auto w-full rounded-sm object-cover"
                />
              </div>
              <div className="-rotate-1 overflow-hidden rounded-md border border-border bg-card p-2 shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
                <Image
                  src="/mock-handyman.png"
                  alt="Zemen Handyman app preview"
                  width={1200}
                  height={700}
                  sizes="(max-width: 1024px) 100vw, 52vw"
                  className="h-auto w-full rounded-sm object-cover"
                />
              </div>
            </div>
          </div>

          <div className="mt-10 flex justify-center">
            <Link
              href="#partners"
              className="inline-flex flex-col items-center gap-1 text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-md px-3 py-2"
            >
              <span className="text-[13px] font-semibold">Scroll</span>
              <ChevronsDown className="h-5 w-5 animate-bounce" aria-hidden />
            </Link>
          </div>
        </div>
      </section>

      <MarketingDeferredSections />
    </main>
  );
}
