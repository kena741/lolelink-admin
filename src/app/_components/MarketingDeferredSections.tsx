"use client";

import Image from "next/image";
import { Apple, Store } from "lucide-react";

export default function MarketingDeferredSections() {
  const steps = [
    {
      title: "Choose your app",
      description: "Pick ZS Customer, ZS Provider, or ZS Handyman based on your role.",
    },
    {
      title: "Set up your profile",
      description: "Add your details and preferences to get matched quickly.",
    },
    {
      title: "Start using the platform",
      description: "Book, accept, and complete services with real-time status updates.",
    },
  ];

  const apps = [
    { name: "ZS Customer", description: "Book services and track progress." },
    { name: "ZS Provider", description: "Manage requests and earnings." },
    { name: "ZS Handyman", description: "Deliver tasks faster on the go." },
  ];

  return (
    <>
      <section id="partners" className="border-b border-subtle bg-base scroll-mt-24">
        <div className="mx-auto max-w-[1100px] px-6 py-10">
          <div className="rounded-md border border-subtle bg-surface p-6 sm:p-8">
            <div className="flex flex-col items-center text-center">
              <p className="text-[13px] font-semibold leading-[1.2] text-muted-foreground">Trusted Partners</p>
              <h2 className="mt-2 text-[24px] font-bold leading-[1.2] text-primary">Our Partners</h2>
            </div>
            <div className="partner-marquee mt-8">
              <div className="partner-marquee-track">
                {["ibex.et", "Zulu Tech", "Zulu Dine", "Zemen Service", "Ezedin Kamil", "Testing"].map((partner, idx) => (
                  <div
                    key={`${partner}-${idx}`}
                    className="-rotate-2 flex h-[72px] min-w-[240px] items-center justify-center rounded-md border border-subtle bg-base px-6"
                  >
                    <p className="rotate-2 text-[24px] font-bold leading-[1.2] text-primary">{partner}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-[1100px] px-6 py-12 scroll-mt-24">
        <div className="rounded-md border border-border bg-card p-6 sm:p-8">
          <div className="grid gap-6 sm:grid-cols-[1fr_220px] sm:items-start lg:grid-cols-[1fr_300px] lg:items-center">
            <div>
              <h2 className="text-[24px] font-bold leading-[1.2]">Start in 3 simple steps</h2>
              <div className="mt-6 space-y-4">
                {steps.map((step, idx) => (
                  <div key={step.title} className="rounded-md border border-border bg-background p-4">
                    <p className="text-[13px] font-semibold text-muted-foreground">Step {idx + 1}</p>
                    <p className="mt-1 text-[18px] font-semibold leading-[1.2]">{step.title}</p>
                    <p className="mt-1 text-[14px] text-muted-foreground">{step.description}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="mx-auto w-[170px] overflow-hidden rounded-md border border-border bg-background p-2 lg:w-[190px]">
              <Image
                src="/zs_4.png"
                alt="Zemen Service app preview"
                width={700}
                height={1200}
                className="h-[300px] w-auto rounded-sm object-contain lg:h-[340px]"
              />
            </div>
          </div>
        </div>
      </section>

      <section id="download" className="mx-auto max-w-[1100px] px-6 py-12 scroll-mt-24">
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
                  <div>
                    <p className="text-[20px] font-bold">{app.name}</p>
                    <p className="mt-1 text-[14px] text-muted-foreground">{app.description}</p>
                    <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                      <a
                        href="#"
                        aria-disabled="true"
                        tabIndex={-1}
                        className="inline-flex h-[40px] items-center justify-center gap-2 rounded-md bg-primary px-4 text-[14px] font-semibold text-primary-foreground opacity-70"
                      >
                        <Store className="h-4 w-4" aria-hidden />
                        Google Play
                      </a>
                      <a
                        href="#"
                        aria-disabled="true"
                        tabIndex={-1}
                        className="inline-flex h-[40px] items-center justify-center gap-2 rounded-md border border-border bg-card px-4 text-[14px] font-semibold opacity-70"
                      >
                        <Apple className="h-4 w-4" aria-hidden />
                        App Store
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <footer className="mx-auto mt-4 max-w-[1100px] border-t border-border px-6 py-6 text-[13px] font-semibold text-muted-foreground">
        © {new Date().getFullYear()} Zemen Service
      </footer>
    </>
  );
}
