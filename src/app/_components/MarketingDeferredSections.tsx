"use client";

import {
  ArrowLeftRight,
  Banknote,
  BookOpenCheck,
  Briefcase,
  Camera,
  CircleCheck,
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  FileCheck,
  Hammer,
  KeyRound,
  LogIn,
  UserCheck,
  UserPlus,
} from "lucide-react";
import { FaqSection } from "./landing/FaqSection";
import { HowPlatformsSection, type JourneyStep } from "./landing/HowPlatformsSection";
import { LandingFooter } from "./landing/LandingFooter";
import { MobileDownloadSection } from "./landing/MobileDownloadSection";
import { PartnersSection } from "./landing/PartnersSection";
import { WhyChooseSection, type WhyChooseCard } from "./landing/WhyChooseSection";

const mobileDownloadSharedDescription =
  "Book admin-approved services from providers verified with identity, medical status, and criminal record checks.";

const mobileDownloadLabels = [
  { heading: "Customer App", storeLabel: "Customer App" },
  { heading: "Provider App", storeLabel: "Provider App" },
  { heading: "Handyman App", storeLabel: "Handyman App" },
] as const;

export default function MarketingDeferredSections() {
  const customerJourneySteps: JourneyStep[] = [
    {
      title: "Sign Up",
      description: "Create your customer account in minutes.",
      Icon: UserPlus,
    },
    {
      title: "Browse & Book Service",
      description: "Pick a service and schedule your booking.",
      Icon: BookOpenCheck,
    },
    {
      title: "Provider Assigned",
      description: "A provider or worker is assigned to your request.",
      Icon: UserCheck,
    },
    {
      title: "Share OTP",
      description: "Share OTP at work start for secure verification.",
      Icon: KeyRound,
    },
    {
      title: "Work Completion",
      description: "Review the result and confirm completion.",
      Icon: ClipboardCheck,
    },
    {
      title: "Complete Process",
      description: "After you approve, payment releases from escrow to the provider wallet.",
      Icon: CircleCheck,
    },
  ];

  const providerJourneySteps: JourneyStep[] = [
    {
      title: "Provider Sign Up",
      description: "Register your provider account.",
      Icon: UserPlus,
    },
    {
      title: "Admin Approval for Submitted Documents",
      description: "Upload ID, medical, criminal record, and other required documents.",
      Icon: FileCheck,
    },
    {
      title: "Pay Activation Fee",
      description: "Pay activation fee before creating services.",
      Icon: CreditCard,
    },
    {
      title: "Create Approved Services",
      description: "Create Approved services with pricing and availability.",
      Icon: Briefcase,
    },
    {
      title: "Accept/Reject Booking",
      description: "Accept or reject bookings and assign worker.",
      Icon: ArrowLeftRight,
    },
    {
      title: "Complete Work",
      description: "Complete work and add extra charges if needed.",
      Icon: Hammer,
    },
    {
      title: "Withdraw Your Payment",
      description: "Request a payout from your wallet balance.",
      Icon: Banknote,
    },
  ];

  const handymanJourneySteps: JourneyStep[] = [
    {
      title: "Sign In",
      description: "Sign in with your handyman account to see assigned jobs.",
      Icon: LogIn,
    },
    {
      title: "Browse Assigned Services",
      description: "Explore admin-approved services by category and price.",
      Icon: ClipboardList,
    },
    {
      title: "Start Service and Fill OTP",
      description: "Share OTP at work start for secure verification with the customer.",
      Icon: KeyRound,
    },
    {
      title: "Work Completion",
      description: "Review the result and confirm completion.",
      Icon: ClipboardCheck,
    },
    {
      title: "Upload Proof of Completion",
      description: "Upload Photos and Videos to confirm completion.",
      Icon: Camera,
    },
    {
      title: "Complete Process",
      description: "After you approve, payment releases from escrow to the provider wallet.",
      Icon: CircleCheck,
    },
  ];

  const apps = [
    {
      name: "Zemen Service",
      description:
        "Find trusted services, book in minutes, and approve completed work with a clear and secure customer flow.",
      playStoreUrl: "https://play.google.com/store/apps/details?id=com.zemen.service",
      appStoreUrl: "https://apps.apple.com/app/zemen-provider/id6763142218",
    },
    {
      name: "Zemen Provider",
      description:
        "Create and manage services, accept customer bookings, and track earnings with controlled payout requests.",
      playStoreUrl: "https://play.google.com/store/apps/details?id=com.zemen.provider",
      appStoreUrl: "https://apps.apple.com/app/zemen-provider/id6763142218",
    },
    {
      name: "Zemen Handyman",
      description:
        "View assigned tasks, complete jobs on-site, and upload proof of completion while tracking progress on the go.",
      playStoreUrl: "https://play.google.com/store/apps/details?id=com.zemen.handyman",
      appStoreUrl: "https://apps.apple.com/us/app/zemen-handyman/id6765632136",
    },
  ];

  const partners = [
    { name: "Zulu Tech", logo: "/partners/zulu.png" },
    { name: "Chapa", logo: "/partners/chapa.png" },
    { name: "Ethio Telecom", logo: "/partners/et.png" },
    { name: "IBEX", logo: "/partners/ibex.png" },
    { name: "CBE", logo: "/partners/cbe.png" },
    { name: "Telebirr", logo: "/partners/telebirr.png" },
  ];

  const whyChooseCards: WhyChooseCard[] = [
    {
      key: "vetted",
      image: "/why/w1.png",
      alt: "Admin-approved listings",
      variant: "plain",
      text: "Every listing is vetted before it goes live.",
    },
    {
      key: "verified",
      image: "/why/w2.png",
      alt: "Verified providers",
      variant: "plain",
      text: "Providers are verified with identity, medical status, and criminal record checks.",
    },
    {
      key: "escrow",
      image: "/why/w3.png",
      alt: "Escrow payments",
      variant: "escrow",
    },
    {
      key: "payouts",
      image: "/why/w4.png",
      alt: "Provider payouts",
      variant: "plain",
      text: "Payouts after customer approval and admin-approved withdrawal transfers.",
    },
    {
      key: "lifecycle",
      image: "/why/w5.png",
      alt: "Booking steps",
      variant: "featured",
      text: "Clear booking lifecycle you can follow end to end.",
    },
    {
      key: "thanks",
      image: "/why/w6.png",
      alt: "Thank you",
      variant: "thankyou",
    },
  ];

  const faqItems = [
    {
      question: "Where can I Get the Service?",
      answer:
        "You can get service across Addis Ababa in areas currently covered by Zemen. Open the app, pick your location, and you will only see available providers near you.",
    },
    {
      question: "When can i payout?",
      answer:
        "Providers can request payout after work completion is approved by the customer and withdrawal is approved by admin.",
    },
    {
      question: "How do i get a service?",
      answer:
        "Create your customer account, browse approved services, book your preferred provider, then confirm completion with OTP and final approval.",
    },
    {
      question: "How to provide a service?",
      answer:
        "Sign up as a provider, upload required documents for verification, activate your account, then create services and start receiving bookings.",
    },
  ] as const;

  return (
    <>
      <PartnersSection partners={partners} />
      <MobileDownloadSection apps={apps} labels={mobileDownloadLabels} />
      <HowPlatformsSection
        sharedDescription={mobileDownloadSharedDescription}
        customerJourneySteps={customerJourneySteps}
        providerJourneySteps={providerJourneySteps}
        handymanJourneySteps={handymanJourneySteps}
      />
      <WhyChooseSection sharedDescription={mobileDownloadSharedDescription} cards={whyChooseCards} />
      <FaqSection sharedDescription={mobileDownloadSharedDescription} faqItems={faqItems} />
      <LandingFooter />
    </>
  );
}
