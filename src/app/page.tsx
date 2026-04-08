import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Apple, ChevronsDown, Store } from "lucide-react";

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
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur">
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
            <p className="text-[14px] font-semibold">Zemen Service</p>
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

      <section className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-accent/15 to-secondary/20" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_left_top,rgba(59,107,33,0.25),transparent_45%)]" />
        <div className="relative mx-auto max-w-[1100px] px-6 py-14 sm:py-20">
          <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:items-center">
            <div>
              <p className="inline-flex items-center rounded-full border border-border bg-card px-3 py-1 text-[13px] font-semibold text-muted-foreground">
                Three apps, one marketplace
              </p>
              <h1 className="mt-4 text-[32px] font-bold leading-[1.1] sm:text-[40px]">
                Get Zemen apps on your phone and start today.
              </h1>
              <p className="mt-4 text-[16px] font-normal leading-[1.3] text-muted-foreground">
                Zemen Service, Zemen Provider, and Zemen Handyman in one ecosystem.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <a
                  href="https://play.google.com/store/apps/details?id=com.zemen.service"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-[40px] items-center justify-center gap-2 rounded-md bg-primary px-5 text-[14px] font-semibold text-primary-foreground transition-colors hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <Store className="h-4 w-4 shrink-0" aria-hidden />
                  Play Store
                </a>
                <a
                  href="#"
                  aria-disabled="true"
                  tabIndex={-1}
                  className="inline-flex h-[40px] items-center justify-center gap-2 rounded-md border border-border bg-card px-5 text-[14px] font-semibold text-card-foreground opacity-70"
                >
                  <Apple className="h-4 w-4 shrink-0" aria-hidden />
                  App Store
                </a>
              </div>
            </div>

            <div className="grid gap-4">
              <div className="-rotate-2 overflow-hidden rounded-md border border-border bg-card p-2 shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
                <Image
                  src="/Zemen-Service-Main-Preview.png"
                  alt="Zemen Service app preview"
                  width={1200}
                  height={700}
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
                  className="h-auto w-full rounded-sm object-cover"
                  priority
                />
              </div>
              <div className="-rotate-1 overflow-hidden rounded-md border border-border bg-card p-2 shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
                <Image
                  src="/mock-handyman.png"
                  alt="Zemen Handyman app preview"
                  width={1200}
                  height={700}
                  className="h-auto w-full rounded-sm object-cover"
                  priority
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
