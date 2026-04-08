import Link from "next/link";

export default function ContactUsPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="border-b border-border">
        <div className="mx-auto max-w-[1100px] px-6 py-12">
          <p className="text-[13px] font-semibold text-muted-foreground">Contact</p>
          <h1 className="mt-2 text-[32px] font-bold leading-[1.1] sm:text-[40px]">Get in touch with Zemen Service</h1>
          <p className="mt-3 max-w-[720px] text-[16px] font-normal leading-[1.3] text-muted-foreground">
            We are here to help with onboarding, partnerships, and app-related questions.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/"
              className="h-[40px] rounded-md border border-border bg-card px-5 text-[14px] font-semibold leading-[40px] text-card-foreground transition-colors hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              Back to home
            </Link>
            <Link
              href="/#download"
              className="h-[40px] rounded-md bg-primary px-5 text-[14px] font-semibold leading-[40px] text-primary-foreground transition-colors hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              Get the apps
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1100px] px-6 py-12">
        <div className="grid gap-6 md:grid-cols-3">
          <div className="rounded-md border border-border bg-card p-6">
            <p className="text-[13px] font-semibold text-muted-foreground">Email</p>
            <p className="mt-2 text-[16px] font-medium">support@zemenservice.com</p>
          </div>
          <div className="rounded-md border border-border bg-card p-6">
            <p className="text-[13px] font-semibold text-muted-foreground">Phone</p>
            <p className="mt-2 text-[16px] font-medium">+251941024355</p>
          </div>
          <div className="rounded-md border border-border bg-card p-6">
            <p className="text-[13px] font-semibold text-muted-foreground">Address</p>
            <p className="mt-2 text-[16px] font-medium">Addis Ababa, Ethiopia</p>
          </div>
        </div>

        <div className="mt-8 rounded-md border border-border bg-card p-6">
          <h2 className="text-[24px] font-bold leading-[1.2]">Send us a message</h2>
          <form className="mt-6 grid gap-4 md:grid-cols-2">
            <input
              type="text"
              placeholder="Your name"
              className="h-[44px] rounded-md border border-border bg-background px-4 text-[14px] focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <input
              type="email"
              placeholder="Your email"
              className="h-[44px] rounded-md border border-border bg-background px-4 text-[14px] focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <input
              type="text"
              placeholder="Subject"
              className="h-[44px] rounded-md border border-border bg-background px-4 text-[14px] focus:outline-none focus:ring-2 focus:ring-ring md:col-span-2"
            />
            <textarea
              placeholder="How can we help?"
              rows={5}
              className="rounded-md border border-border bg-background px-4 py-3 text-[14px] focus:outline-none focus:ring-2 focus:ring-ring md:col-span-2"
            />
            <button
              type="button"
              className="h-[40px] rounded-md bg-primary px-5 text-[14px] font-semibold text-primary-foreground transition-colors hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:col-span-2 md:w-fit"
            >
              Send message
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}

