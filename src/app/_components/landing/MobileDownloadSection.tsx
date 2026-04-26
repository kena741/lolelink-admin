"use client";

import { LazyMount } from "./LazyMount";

interface AppItem {
  name: string;
  description: string;
  playStoreUrl: string;
  appStoreUrl?: string;
}

interface MobileLabel {
  heading: string;
  storeLabel: string;
}

interface MobileDownloadSectionProps {
  apps: AppItem[];
  labels: readonly MobileLabel[];
  sharedDescription: string;
}

function PlayStoreIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3.637 3.434L12.377 12.005L3.702 20.655C3.56 20.47 3.45 20.263 3.376 20.042C3.338 19.792 3.338 19.537 3.376 19.287V4.567C3.35 4.172 3.441 3.777 3.636 3.434M16.142 8.267L13.289 11.093L4.653 2.6C4.933 2.503 5.233 2.476 5.526 2.522C5.986 2.648 6.425 2.842 6.828 3.095L14.644 7.42C15.152 7.693 15.647 7.98 16.142 8.267ZM13.29 12.93L16.129 15.718L14.071 16.864L7.792 20.354C7.272 20.641 6.75 20.915 6.242 21.228C6.025 21.363 5.781 21.451 5.527 21.484C5.273 21.518 5.015 21.497 4.77 21.423L13.29 12.93ZM20.65 12.005C20.657 12.355 20.569 12.7 20.394 13.003C20.22 13.306 19.966 13.556 19.66 13.725L17.314 15.027L14.227 12.005L17.327 8.931C18.122 9.374 18.904 9.817 19.685 10.234C19.996 10.408 20.252 10.667 20.423 10.98C20.594 11.294 20.673 11.649 20.65 12.005Z"
        fill="currentColor"
      />
    </svg>
  );
}

function AppStoreIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M16.678 12.59C16.662 10.792 18.147 9.926 18.215 9.885C17.374 8.654 16.069 8.485 15.611 8.47C14.515 8.355 13.453 9.123 12.896 9.123C12.329 9.123 11.472 8.482 10.547 8.5C9.356 8.518 8.243 9.206 7.631 10.278C6.367 12.458 7.31 15.661 8.52 17.428C9.125 18.294 9.829 19.259 10.75 19.225C11.651 19.188 11.987 18.649 13.074 18.649C14.152 18.649 14.467 19.225 15.406 19.204C16.374 19.188 16.984 18.338 17.568 17.463C18.268 16.469 18.548 15.489 18.559 15.439C18.536 15.431 16.697 14.734 16.678 12.59ZM14.895 7.304C15.381 6.702 15.714 5.887 15.622 5.055C14.919 5.086 14.04 5.542 13.532 6.126C13.081 6.645 12.678 7.492 12.781 8.292C13.571 8.351 14.389 7.891 14.895 7.304Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function MobileDownloadSection({ apps, labels, sharedDescription }: MobileDownloadSectionProps) {
  return (
    <section id="download" className="hero-mobile-apps scroll-mt-24" aria-label="Download Zemen mobile apps">
      <LazyMount minHeightClassName="min-h-[200px]">
        <div className="hero-mobile-apps-inner">
          {labels.map((row, index) => {
            const app = apps[index];
            if (!app) return null;
            return (
              <div className="hero-mobile-apps-block" key={row.heading}>
                <div className="hero-mobile-apps-actions">
                  <a href={app.playStoreUrl} target="_blank" rel="noreferrer" className="hero-mobile-apps-btn">
                    <PlayStoreIcon />
                    {row.storeLabel}
                  </a>
                  {app.appStoreUrl ? (
                    <a href={app.appStoreUrl} target="_blank" rel="noreferrer" className="hero-mobile-apps-btn">
                      <AppStoreIcon />
                      {row.storeLabel}
                    </a>
                  ) : null}
                </div>
                <p className="hero-mobile-apps-desc">{sharedDescription}</p>
              </div>
            );
          })}
        </div>
      </LazyMount>
    </section>
  );
}
