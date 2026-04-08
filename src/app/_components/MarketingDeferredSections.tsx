import Image from "next/image";
import { Apple, Store } from "lucide-react";

export default function MarketingDeferredSections() {
  const customerAppSteps = [
    "Customer signup",
    "Customer login",
    "Customer sees list of services",
  ];

  const providerAppSteps = [
    "Provider signup",
    "Provider sends documents (national ID)",
    "Admin approves provider account",
    "Provider signin",
    "Provider pays activation fee before creating service",
    "Provider creates service",
    "Admin approves or declines service",
  ];

  const serviceFlowSteps = [
    "Customer sees approved service",
    "Customer books service",
    "Provider accepts assignment (self or worker) or rejects",
    "After assignment, provider starts work with customer OTP",
    "Provider completes work (with or without extra charges)",
    "Customer approves completed task (provider wallet top-up)",
    "Provider sends withdrawal request",
    "Admin approves withdrawal and transfers to provider",
  ];

  const apps = [
    { name: "ZS Customer", description: "Find, book, and approve completed services." },
    { name: "ZS Provider", description: "Create services, accept jobs, and request withdrawals." },
  ];

  const flowSections = [
    {
      title: "Customer app",
      badge: "3 steps",
      steps: customerAppSteps,
      toneClassName: "bg-accent-info-bg text-accent-info",
    },
    {
      title: "Provider app",
      badge: "7 steps",
      steps: providerAppSteps,
      toneClassName: "bg-accent-success text-primary",
    },
    {
      title: "Service lifecycle",
      badge: "8 steps",
      steps: serviceFlowSteps,
      toneClassName: "bg-accent-primary/20 text-primary",
    },
  ];

  const partners = [
    { name: "Zulu Tech", logo: "/partners/zulu_tech-removebg-preview.png" },
    { name: "IBEX", logo: "/partners/ibexeth_logo-removebg-preview.png" },
    { name: "Ethio Telecom", logo: "/partners/ethiotelecom-removebg-preview.png" },
    { name: "CBE", logo: "/partners/cbe-removebg-preview.png" },
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

      <section id="features" className="mx-auto max-w-[1100px] px-6 py-12 scroll-mt-24">
        <div className="rounded-md border border-border bg-card p-6 sm:p-8">
          <div className="grid gap-6 lg:grid-cols-[1fr_300px] lg:items-start">
            <div>
              <h2 className="text-[24px] font-bold leading-[1.2]">How Zemen Service works</h2>
              <p className="mt-2 text-[16px] font-normal leading-[1.3] text-muted-foreground">
                A clear journey for customers, providers, and service completion.
              </p>
              <div className="mt-6 grid gap-4">
                {flowSections.map((section) => (
                  <div key={section.title} className="rounded-md border border-border bg-background p-4 sm:p-5">
                    <div className="flex items-center justify-between gap-3 border-b border-subtle pb-3">
                      <p className="text-[20px] font-bold leading-[1.2] text-primary">{section.title}</p>
                      <span className={`rounded-full px-3 py-1 text-[13px] font-semibold leading-[1.2] ${section.toneClassName}`}>
                        {section.badge}
                      </span>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      {section.steps.map((step, idx) => (
                        <div key={step} className="flex items-center gap-2">
                          <div className="inline-flex min-h-[40px] items-center gap-2 rounded-full border border-subtle bg-surface px-3 py-2">
                            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-subtle text-[13px] font-semibold text-primary">
                              {idx + 1}
                            </span>
                            <p className="text-[14px] font-medium leading-[1.2] text-primary">{step}</p>
                          </div>
                          {idx < section.steps.length - 1 ? (
                            <span className="text-[14px] font-semibold leading-[1.2] text-secondary" aria-hidden>
                              →
                            </span>
                          ) : null}
                        </div>
                      ))}
                    </div>
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
                        href="https://play.google.com/store/apps/details?id=com.zemen.service"
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-[40px] items-center justify-center gap-2 rounded-md bg-primary px-4 text-[14px] font-semibold text-primary-foreground transition-colors hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      >
                        <Store className="h-4 w-4" aria-hidden />
                        Play Store
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
