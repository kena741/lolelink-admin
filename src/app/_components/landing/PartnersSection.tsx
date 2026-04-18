"use client";

import Image from "next/image";

import { partnerLogoBoxClassName, partnerLogoImageSizes } from "../partner-logo-layout";
import { LazyMount } from "./LazyMount";

interface PartnerItem {
  name: string;
  logo: string;
}

interface PartnersSectionProps {
  partners: PartnerItem[];
}

export function PartnersSection({ partners }: PartnersSectionProps) {
  return (
    <section id="partners" className="partners-bar scroll-mt-24">
      <div className="mx-auto max-w-[1640px] px-3 py-2 sm:px-6 sm:py-4">
        <LazyMount minHeightClassName="min-h-[72px] sm:min-h-[120px]">
          <div className="partner-marquee">
            <div className="partner-marquee-track">
              {partners.map((partner) => (
                <div key={partner.name} className="flex items-center justify-center">
                  <div className={partnerLogoBoxClassName}>
                    <Image
                      src={partner.logo}
                      alt={`${partner.name} logo`}
                      fill
                      sizes={partnerLogoImageSizes()}
                      className="object-contain"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </LazyMount>
      </div>
    </section>
  );
}
