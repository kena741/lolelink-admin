import Image from "next/image";
import Link from "next/link";
import { LandingFooter } from "@/app/_components/landing/LandingFooter";

interface PublicPolicyPageProps {
  title: string;
  badge: string;
  htmlContent: string;
}

function normalizePolicyHtml(htmlContent: string): string {
  const trimmed = htmlContent.trim();
  if (!trimmed) return "";

  const bodyMatch = trimmed.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const bodyContent = bodyMatch?.[1] ?? trimmed;

  return bodyContent
    .replace(/<!doctype[^>]*>/gi, "")
    .replace(/<html[\s\S]*?>|<\/html>/gi, "")
    .replace(/<head[\s\S]*?<\/head>/gi, "")
    .replace(/<body[\s\S]*?>|<\/body>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<meta[^>]*>/gi, "")
    .replace(/<title[\s\S]*?<\/title>/gi, "")
    .replace(/<link[^>]*>/gi, "")
    .trim();
}

export function PublicPolicyPage({ title, badge, htmlContent }: PublicPolicyPageProps) {
  const normalizedHtmlContent = normalizePolicyHtml(htmlContent);

  return (
    <main className="landing-page flex min-h-screen flex-col bg-base">
      <header className="border-b border-subtle bg-base">
        <nav className="mx-auto flex w-full max-w-[1100px] items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/" className="flex items-center gap-3">
            <Image src="/logo.png" alt="Zemen Service logo" width={56} height={56} priority />
            <span className="text-[20px] font-bold leading-[1.2] text-primary">Zemen Service</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/privacy-policy"
              className="inline-flex h-[40px] items-center rounded-md px-3 text-[14px] font-medium leading-[1.2] text-primary transition-all duration-150 hover:bg-subtle focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-info focus-visible:ring-offset-2"
            >
              Privacy
            </Link>
            <Link
              href="/terms-of-service"
              className="inline-flex h-[40px] items-center rounded-md px-3 text-[14px] font-medium leading-[1.2] text-primary transition-all duration-150 hover:bg-subtle focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-info focus-visible:ring-offset-2"
            >
              Terms
            </Link>
          </div>
        </nav>
      </header>

      <section className="border-b border-subtle bg-subtle">
        <div className="mx-auto w-full max-w-[1100px] px-4 py-10 sm:px-6 sm:py-12">
          <p className="text-[14px] font-semibold leading-[1.2] text-secondary">{badge}</p>
          <h1 className="mt-2 text-[32px] font-bold leading-[1.1] text-primary sm:text-[40px]">{title}</h1>
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1100px] flex-1 px-4 py-8 sm:px-6 sm:py-10">
        <article className="rounded-md border border-subtle bg-surface p-6 sm:p-8">
          {normalizedHtmlContent ? (
            <div
              className="policy-rich-text text-[16px] font-normal leading-[1.3] text-primary [&_a]:text-accent-info [&_a]:underline [&_h1]:text-[24px] [&_h1]:font-bold [&_h1]:leading-[1.2] [&_h2]:text-[20px] [&_h2]:font-bold [&_h2]:leading-[1.2] [&_h3]:text-[18px] [&_h3]:font-semibold [&_h3]:leading-[1.2] [&_li]:ml-5 [&_li]:list-disc [&_p]:mb-3 [&_ul]:mb-3"
              dangerouslySetInnerHTML={{ __html: normalizedHtmlContent }}
            />
          ) : (
            <p className="text-[16px] font-normal leading-[1.3] text-secondary">
              Content is not available yet.
            </p>
          )}
        </article>
      </section>

      <LandingFooter />
    </main>
  );
}
