"use client";

import Image from "next/image";
import { Facebook, Instagram, Music2, Send, type LucideIcon } from "lucide-react";

interface SocialLink {
  label: string;
  Icon: LucideIcon;
  href: string;
}

interface LandingFooterProps {
  socialLinks?: readonly SocialLink[];
}

const defaultSocialLinks: readonly SocialLink[] = [
  { label: "Telegram", Icon: Send, href: "#" },
  { label: "Facebook", Icon: Facebook, href: "#" },
  { label: "TikTok", Icon: Music2, href: "#" },
  { label: "Instagram", Icon: Instagram, href: "#" },
];

export function LandingFooter({ socialLinks = defaultSocialLinks }: LandingFooterProps) {
  return (
    <footer className="bg-[#01572a]">
      <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-6 px-5 py-6 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:py-4">
        <div className="flex items-center justify-center gap-3 text-center lg:justify-start lg:text-left">
          <Image
            src="/logo_white.svg"
            alt="Zemen Service logo"
            width={72}
            height={72}
            className="h-[64px] w-[64px] object-contain opacity-100 lg:h-[44px] lg:w-[44px]"
          />
          <div>
            <p className="text-[17px] font-semibold leading-[1.2] text-white lg:text-[20px]">Zemen Service</p>
            <p className="text-[14px] font-light leading-[1.2] text-white lg:text-[15px]">
              © {new Date().getFullYear()} Zemen Service
            </p>
          </div>
        </div>

        <div className="flex w-full flex-col items-center gap-3 border-t border-white/25 pt-6 text-center lg:w-auto lg:items-start lg:border-t-0 lg:pt-0 lg:text-left">
          <p className="text-[14px] font-semibold leading-[1.2] text-white lg:text-[14px]">Join us on our socials</p>
          <div className="flex items-center gap-3">
            {socialLinks.map(({ label, Icon, href }) => (
              <a
                key={label}
                href={href}
                aria-label={label}
                className="inline-flex h-[42px] w-[42px] items-center justify-center rounded-full bg-white/20 text-white/80 transition-all duration-150 hover:bg-white/30 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#01572a] lg:h-[30px] lg:w-[30px]"
              >
                <Icon className="h-[21px] w-[21px] lg:h-[16px] lg:w-[16px]" aria-hidden />
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
