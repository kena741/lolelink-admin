"use client";

import type { LucideIcon } from "lucide-react";

import { LazyMount } from "./LazyMount";

export interface JourneyStep {
  title: string;
  description: string;
  Icon: LucideIcon;
}

interface JourneyColumnProps {
  title: string;
  description: string;
  steps: JourneyStep[];
}

interface HowPlatformsSectionProps {
  sharedDescription: string;
  customerJourneySteps: JourneyStep[];
  providerJourneySteps: JourneyStep[];
  handymanJourneySteps: JourneyStep[];
}

function JourneyColumn({ title, description, steps }: JourneyColumnProps) {
  return (
    <article className="how-platforms-card flex h-full flex-col rounded-md border border-[#ededed] bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.06)] sm:p-6">
      <h3 className="font-sans text-[20px] font-bold leading-[1.2] text-[#027a3b] sm:text-[22px]">
        {title}
      </h3>
      <p className="mt-2 font-sans text-[15px] font-normal leading-[1.4] text-[#838383]">
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
                <p className="mt-1 text-[14px] font-normal leading-[1.35] text-[#838383]">{step.description}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </article>
  );
}

export function HowPlatformsSection({
  sharedDescription,
  customerJourneySteps,
  providerJourneySteps,
  handymanJourneySteps,
}: HowPlatformsSectionProps) {
  return (
    <section id="features" className="how-platforms-work scroll-mt-24">
      <LazyMount minHeightClassName="min-h-[480px]">
        <div className="how-platforms-work__inner mx-auto max-w-[1280px] px-4 py-12 sm:px-6">
          <header className="mx-auto mb-10 max-w-[720px] text-center">
            <h2 className="font-sans text-[28px] font-bold leading-[1.15] text-[#027a3b] sm:text-[32px]">
              How Zemen Platforms work
            </h2>
            <p className="mt-3 font-sans text-[16px] font-normal leading-[1.4] text-[#838383]">
              {sharedDescription}
            </p>
          </header>
          <div className="grid gap-6 lg:grid-cols-3">
            <JourneyColumn title="Customer Journey" description={sharedDescription} steps={customerJourneySteps} />
            <JourneyColumn title="Provider Journey" description={sharedDescription} steps={providerJourneySteps} />
            <JourneyColumn title="Handyman Journey" description={sharedDescription} steps={handymanJourneySteps} />
          </div>
        </div>
      </LazyMount>
    </section>
  );
}
