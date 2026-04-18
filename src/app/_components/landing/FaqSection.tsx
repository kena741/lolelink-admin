"use client";

import Image from "next/image";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

import { LazyMount } from "./LazyMount";

interface FaqItem {
  question: string;
  answer: string;
}

interface FaqSectionProps {
  sharedDescription: string;
  faqItems: readonly FaqItem[];
}

export function FaqSection({ sharedDescription, faqItems }: FaqSectionProps) {
  const [openFaqIndex, setOpenFaqIndex] = useState(0);

  return (
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
            <h2 className="font-[family-name:var(--font-outfit),sans-serif] text-[32px] font-bold leading-[1.1] text-[#027a3b]">FAQ</h2>
            <p className="mt-2 max-w-[560px] font-[family-name:var(--font-outfit),sans-serif] text-[14px] font-normal leading-[1.4] text-[#7b7b7b] sm:text-[15px]">
              {sharedDescription}
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
  );
}
