import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";

const MarketingDeferredSections = dynamic(
  () => import("./_components/MarketingDeferredSections"),
  {
    loading: () => (
      <section className="mx-auto max-w-[1280px] px-4 sm:px-6 py-12">
        <div className="space-y-4 rounded-md border border-border bg-card p-6">
          <div className="h-4 w-40 animate-pulse rounded bg-muted" />
          <div className="h-4 w-72 animate-pulse rounded bg-muted" />
          <div className="grid gap-4 md:grid-cols-3">
            <div className="h-24 animate-pulse rounded-md bg-muted" />
            <div className="h-24 animate-pulse rounded-md bg-muted" />
            <div className="h-24 animate-pulse rounded-md bg-muted" />
          </div>
        </div>
      </section>
    ),
  }
);

const PlayStoreIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path
      d="M3.637 3.434L12.377 12.005L3.702 20.655C3.56 20.47 3.45 20.263 3.376 20.042C3.338 19.792 3.338 19.537 3.376 19.287V4.567C3.35 4.172 3.441 3.777 3.636 3.434M16.142 8.267L13.289 11.093L4.653 2.6C4.933 2.503 5.233 2.476 5.526 2.522C5.986 2.648 6.425 2.842 6.828 3.095L14.644 7.42C15.152 7.693 15.647 7.98 16.142 8.267ZM13.29 12.93L16.129 15.718L14.071 16.864L7.792 20.354C7.272 20.641 6.75 20.915 6.242 21.228C6.025 21.363 5.781 21.451 5.527 21.484C5.273 21.518 5.015 21.497 4.77 21.423L13.29 12.93ZM20.65 12.005C20.657 12.355 20.569 12.7 20.394 13.003C20.22 13.306 19.966 13.556 19.66 13.725L17.314 15.027L14.227 12.005L17.327 8.931C18.122 9.374 18.904 9.817 19.685 10.234C19.996 10.408 20.252 10.667 20.423 10.98C20.594 11.294 20.673 11.649 20.65 12.005Z"
      fill="currentColor"
    />
  </svg>
);

const VerifiedBadgeIcon = () => (
  <svg width="24" height="24" viewBox="0 0 30 30" fill="none" aria-hidden>
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M19.356 9.162C19.275 8.916 19.119 8.7 18.909 8.546C18.7 8.392 18.448 8.307 18.188 8.303L16.343 8.275C16.154 8.272 15.968 8.226 15.799 8.141L14.152 7.311C13.92 7.194 13.657 7.152 13.4 7.191C13.143 7.23 12.905 7.349 12.718 7.53L11.393 8.814C11.258 8.946 11.094 9.045 10.915 9.104L9.162 9.682C8.916 9.764 8.7 9.92 8.547 10.129C8.393 10.338 8.308 10.59 8.304 10.849L8.275 12.696C8.272 12.884 8.226 13.07 8.141 13.239L7.31 14.887C7.193 15.119 7.152 15.381 7.191 15.638C7.23 15.895 7.349 16.133 7.529 16.32L8.814 17.645C8.946 17.78 9.044 17.944 9.104 18.123L9.682 19.876C9.848 20.381 10.318 20.726 10.85 20.735L12.695 20.763C12.884 20.766 13.07 20.812 13.238 20.897L14.887 21.728C15.119 21.844 15.381 21.886 15.638 21.847C15.895 21.808 16.133 21.689 16.32 21.508L17.645 20.224C17.78 20.092 17.943 19.993 18.123 19.935L19.876 19.357C20.123 19.275 20.339 19.119 20.492 18.909C20.646 18.7 20.731 18.448 20.735 18.188L20.764 16.344C20.767 16.155 20.813 15.969 20.898 15.8L21.728 14.151C21.845 13.92 21.887 13.657 21.848 13.4C21.809 13.144 21.691 12.905 21.51 12.719L20.225 11.393C20.093 11.258 19.995 11.095 19.935 10.916L19.356 9.162ZM17.882 13.05C17.969 12.954 18.016 12.828 18.013 12.699C18.009 12.57 17.955 12.447 17.863 12.356C17.77 12.265 17.646 12.214 17.517 12.213C17.387 12.212 17.263 12.261 17.169 12.35L13.572 16.023L12.4 14.178C12.366 14.12 12.321 14.07 12.267 14.03C12.213 13.99 12.151 13.961 12.086 13.945C12.021 13.929 11.953 13.927 11.887 13.938C11.821 13.949 11.757 13.973 11.701 14.009C11.644 14.045 11.595 14.092 11.557 14.148C11.519 14.203 11.492 14.265 11.479 14.331C11.466 14.397 11.466 14.465 11.479 14.53C11.492 14.596 11.519 14.659 11.557 14.714L13.066 17.093C13.107 17.156 13.161 17.21 13.225 17.249C13.289 17.289 13.361 17.314 13.436 17.321C13.511 17.329 13.587 17.32 13.658 17.295C13.728 17.269 13.793 17.228 13.845 17.174L17.882 13.05Z"
      fill="black"
    />
  </svg>
);

const AdminBadgeIcon = () => (
  <svg width="18" height="18" viewBox="0 0 22 22" fill="none" aria-hidden>
    <path
      d="M10.341 1.466L2.826 5.353L3.13 10.498C3.412 15.257 6.968 19.513 11.457 20.332C15.818 18.99 18.848 14.344 18.566 9.585L18.262 4.44L10.341 1.466ZM10.539 4.811C11.048 4.78 11.554 4.902 11.994 5.16C12.434 5.417 12.787 5.8 13.01 6.258C13.232 6.717 13.314 7.231 13.244 7.736C13.174 8.241 12.956 8.714 12.618 9.095C12.279 9.476 11.835 9.748 11.342 9.877C10.849 10.005 10.329 9.985 9.847 9.818C9.366 9.651 8.944 9.345 8.637 8.939C8.329 8.533 8.149 8.044 8.118 7.535C8.078 6.853 8.31 6.183 8.764 5.672C9.218 5.161 9.857 4.851 10.539 4.811ZM10.94 11.585C12.655 11.484 16.14 12.216 16.241 13.922C15.728 14.804 15.005 15.546 14.135 16.081C13.266 16.616 12.278 16.927 11.259 16.988C10.24 17.048 9.222 16.855 8.296 16.426C7.37 15.998 6.564 15.346 5.951 14.531C5.85 12.824 9.225 11.687 10.94 11.585Z"
      fill="black"
    />
  </svg>
);

export default function Home() {
  return (
    <main className="landing-page">
      {/* ── Navbar ─────────────────────────────────────────── */}
      <header className="landing-nav-wrapper">
        <nav className="landing-nav">
          <Link href="/" className="landing-nav-brand">
            <Image
              src="/logo.png"
              alt="Zemen Service logo"
              width={72}
              height={72}
              className="landing-nav-logo"
              priority
            />
            <span className="landing-nav-title">Zemen Service</span>
          </Link>
          <div className="landing-nav-links">
            <Link href="/contact-us" className="landing-nav-contact">
              Contact Us
            </Link>
            <Link href="#download" className="landing-nav-cta">
              Get The App
            </Link>
          </div>
        </nav>
      </header>

      {/* ── Hero ───────────────────────────────────────────── */}
      <section className="hero-section">
        {/* Background glow blobs */}
        <div className="hero-blob hero-blob--teal" />
        <div className="hero-blob hero-blob--green-right" />
        <div className="hero-blob hero-blob--green-left" />

        <div className="hero-inner">
          {/* Title */}
          <h1 className="hero-title">
            <span className="hero-title-word hero-title-word--trusted">
              <span className="hero-title--trusted">Trusted</span>
              <span className="hero-badge hero-badge--blue hero-badge--title">
                <AdminBadgeIcon />
                <span>Admin Approved Services</span>
              </span>
            </span>
            <span className="hero-title--middle"> local services, booked in </span>
            <span className="hero-title-word hero-title-word--minutes">
              <span className="hero-title--minutes">minutes.</span>
              <span className="hero-badge hero-badge--green hero-badge--title">
                <VerifiedBadgeIcon />
                <span>Verified Providers</span>
              </span>
            </span>
          </h1>

          {/* Three-column layout: Provider | Service | Handyman */}
          <div className="hero-columns">
            <div className="hero-arrows" aria-hidden>
              <svg className="hero-arrow hero-arrow--left" viewBox="0 0 140 90" fill="none">
                <path
                  d="M126 70C106 42 82 26 44 24"
                  stroke="#027A3B"
                  strokeWidth="10"
                  strokeOpacity="0.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M126 70C106 42 82 26 44 24"
                  stroke="#027A3B"
                  strokeWidth="7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path d="M56 12L36 24L56 36" stroke="#027A3B" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M56 12L36 24L56 36" stroke="#027A3B" strokeWidth="10" strokeOpacity="0.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <svg className="hero-arrow hero-arrow--center" viewBox="0 0 80 100" fill="none">
                <path d="M40 84C42 64 42 48 40 24" stroke="#027A3B" strokeWidth="10" strokeOpacity="0.2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M40 84C42 64 42 48 40 24" stroke="#027A3B" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M28 36L40 20L52 36" stroke="#027A3B" strokeWidth="10" strokeOpacity="0.2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M28 36L40 20L52 36" stroke="#027A3B" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <svg className="hero-arrow hero-arrow--right" viewBox="0 0 140 90" fill="none">
                <path
                  d="M14 70C34 42 58 26 96 24"
                  stroke="#027A3B"
                  strokeWidth="10"
                  strokeOpacity="0.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M14 70C34 42 58 26 96 24"
                  stroke="#027A3B"
                  strokeWidth="7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path d="M84 12L104 24L84 36" stroke="#027A3B" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M84 12L104 24L84 36" stroke="#027A3B" strokeWidth="10" strokeOpacity="0.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            {/* Left – Provider */}
            <div className="hero-col hero-col--provider">
              <div className="hero-app-info">
                <h2 className="hero-app-name">Zemen Provider</h2>
                <p className="hero-app-desc">
                  Book admin-approved services from providers verified with
                  identity, medical status, and criminal record checks.
                </p>
              </div>
              <a
                href="https://play.google.com/store/apps/details?id=com.zemen.provider"
                target="_blank"
                rel="noreferrer"
                className="hero-app-btn hero-app-btn--outline"
              >
                <PlayStoreIcon />
                Zemen Provider
              </a>
              <div className="hero-phone hero-phone--side hero-phone--plain">
                <Image
                  src="/provider_.png"
                  alt="Zemen Provider app screenshot"
                  width={390}
                  height={808}
                  className="hero-phone-img"
                />
              </div>
            </div>

            {/* Center – Service */}
            <div className="hero-col hero-col--service">
              <a
                href="https://play.google.com/store/apps/details?id=com.zemen.service"
                target="_blank"
                rel="noreferrer"
                className="hero-app-btn hero-app-btn--filled"
              >
                <PlayStoreIcon />
                Zemen Service
              </a>
              <div className="hero-phone hero-phone--center hero-phone--plain">
                <Image
                  src="/zemen_.png"
                  alt="Zemen Service app screenshot"
                  width={390}
                  height={808}
                  className="hero-phone-img"
                  priority
                />
              </div>
            </div>

            {/* Right – Handyman */}
            <div className="hero-col hero-col--handyman">
              <div className="hero-app-info">
                <h2 className="hero-app-name">Zemen Handyman</h2>
                <p className="hero-app-desc">
                  Book admin-approved services from providers verified with
                  identity, medical status, and criminal record checks.
                </p>
              </div>
              <a
                href="https://play.google.com/store/apps/details?id=com.zemen.handyman"
                target="_blank"
                rel="noreferrer"
                className="hero-app-btn hero-app-btn--outline"
              >
                <PlayStoreIcon />
                Zemen Handyman
              </a>
              <div className="hero-phone hero-phone--side hero-phone--plain">
                <Image
                  src="/handyman_.png"
                  alt="Zemen Handyman app screenshot"
                  width={390}
                  height={808}
                  className="hero-phone-img"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <MarketingDeferredSections />
    </main>
  );
}
