"use client";

import Image from "next/image";

import { LazyMount } from "./LazyMount";

interface WhyChoosePlainCard {
  key: string;
  image: string;
  alt: string;
  variant: "plain";
  text: string;
}

interface WhyChooseEscrowCard {
  key: string;
  image: string;
  alt: string;
  variant: "escrow";
}

interface WhyChooseFeaturedCard {
  key: string;
  image: string;
  alt: string;
  variant: "featured";
  text: string;
}

interface WhyChooseThankYouCard {
  key: string;
  image: string;
  alt: string;
  variant: "thankyou";
}

export type WhyChooseCard = WhyChoosePlainCard | WhyChooseEscrowCard | WhyChooseFeaturedCard | WhyChooseThankYouCard;

interface WhyChooseSectionProps {
  sharedDescription: string;
  cards: WhyChooseCard[];
}

function WhyChooseGridCard({ card, index }: { card: WhyChooseCard; index: number }) {
  const colSpanClass = index >= 4 ? "col-span-2 md:col-span-1" : "";

  const imageBlock = (
    <div className="flex min-h-[100px] w-full items-center justify-center sm:min-h-[120px]">
      <Image
        src={card.image}
        alt={card.alt}
        width={200}
        height={160}
        sizes="(max-width: 767px) 42vw, 28vw"
        className="h-auto max-h-[120px] w-auto max-w-full object-contain sm:max-h-[140px]"
      />
    </div>
  );

  if (card.variant === "featured")
    return (
      <div
        className={`flex flex-col items-center gap-4 rounded-md bg-[#027a3b] px-4 py-5 text-center shadow-[0_2px_12px_rgba(2,122,59,0.2)] sm:px-5 sm:py-6 ${colSpanClass}`}
      >
        {imageBlock}
        <p className="font-sans text-[14px] font-medium leading-[1.35] text-white sm:text-[15px]">
          {card.text}
        </p>
      </div>
    );

  if (card.variant === "thankyou")
    return (
      <div
        className={`flex flex-col items-center gap-3 rounded-md border border-[#b8d4c4] bg-white p-4 text-center shadow-[0_1px_3px_rgba(0,0,0,0.05)] sm:p-5 ${colSpanClass}`}
      >
        {imageBlock}
        <p className="font-sans text-[14px] font-normal leading-[1.35] text-[#1b1b1b] sm:text-[15px]">
          Thank you for choosing <span className="font-bold text-[#027a3b]">Zemen</span>
        </p>
      </div>
    );

  if (card.variant === "escrow")
    return (
      <div
        className={`flex flex-col items-center gap-3 rounded-md border border-[#b8d4c4] bg-white p-4 text-center shadow-[0_1px_3px_rgba(0,0,0,0.05)] sm:p-5 ${colSpanClass}`}
      >
        {imageBlock}
        <p className="font-sans text-[14px] font-normal leading-[1.35] text-[#1b1b1b] sm:text-[15px]">
          <span className="font-semibold text-[#027a3b]">Escrow-style payments:</span> your money stays protected until you approve
          completed work.
        </p>
      </div>
    );

  return (
    <div
      className={`flex flex-col items-center gap-3 rounded-md border border-[#b8d4c4] bg-white p-4 text-center shadow-[0_1px_3px_rgba(0,0,0,0.05)] sm:p-5 ${colSpanClass}`}
    >
      {imageBlock}
      <p className="font-sans text-[14px] font-normal leading-[1.35] text-[#1b1b1b] sm:text-[15px]">
        {card.text}
      </p>
    </div>
  );
}

export function WhyChooseSection({ sharedDescription, cards }: WhyChooseSectionProps) {
  return (
    <section id="why-choose" className="mx-auto max-w-[1280px] scroll-mt-24 px-4 py-12 sm:px-6">
      <LazyMount minHeightClassName="min-h-[320px]">
        <div>
          <header className="mx-auto mb-8 max-w-[720px] text-center">
            <h2 className="font-sans text-[24px] font-bold leading-[1.2] text-[#027a3b] sm:text-[28px]">
              Why Choose Zemen Service?
            </h2>
            <p className="mt-3 font-sans text-[15px] font-normal leading-[1.4] text-[#838383] sm:text-[16px]">
              {sharedDescription}
            </p>
          </header>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5">
            {cards.map((card, index) => (
              <WhyChooseGridCard key={card.key} card={card} index={index} />
            ))}
          </div>
        </div>
      </LazyMount>
    </section>
  );
}
