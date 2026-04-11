---
name: Marketing copy trust and payments
overview: Refresh public marketing copy to replace vague "listings/payouts" language with admin-approved services, provider verification (including medical and criminal record checks), escrow-style safe payments, and clearer payout flows—aligned across hero, SEO metadata, and Why Choose bullets.
todos:
  - id: copy-hero
    content: Update hero paragraph in src/app/page.tsx (and badge if needed)
    status: completed
  - id: copy-layout-seo
    content: Sync src/app/layout.tsx metadata description, openGraph, twitter (length-aware)
    status: completed
  - id: copy-deferred
    content: Rewrite whyChooseItems and optional workflow one-liners in MarketingDeferredSections.tsx
    status: completed
isProject: false
---

# Marketing copy — trust, verification, escrow, payouts

## Goal

Replace unclear phrases (e.g. "admin-approved listings", generic "wallet payouts") with copy that reflects:

- **Services** are admin-approved (not vague "listings").
- **Providers** are verified with **medical status** and **criminal record** checks (per product reality — you confirmed exact wording is OK).
- **Payments**: escrow-style / safe transactions — customer funds protected until work is accepted; provider **payouts** after approval (align with existing journey: customer approval → wallet → withdrawal → admin-approved transfer).

## Files to change

### 1. [src/app/page.tsx](src/app/page.tsx)

- **Hero paragraph** (currently ~line 78–80): Rewrite to 2–3 short sentences max on mobile readability:
  - Lead with value (book verified services).
  - Admin-approved **services**; providers verified (ID + medical + criminal background checks) — concise, no duplicate words.
  - OTP at job start; **escrow** (or "secure held payments" if you prefer softer legal term) until completion; **payouts** to providers after customer approval and admin-approved withdrawal.

### 2. [src/app/layout.tsx](src/app/layout.tsx)

- **`description`**: Mirror the hero themes; keep under ~155–170 chars if possible for SERP snippets (trim or split priority phrases).
- **`openGraph.description` / `twitter.description`**: Same narrative, possibly slightly shorter than root `description`.

### 3. [src/app/_components/MarketingDeferredSections.tsx](src/app/_components/MarketingDeferredSections.tsx)

- **`whyChooseItems`** (array ~line 274–280): Replace bullets so they explicitly mention:
  - Admin-approved services for customers to browse.
  - Provider verification including medical and criminal record checks.
  - Escrow / safe payment flow (release after approval).
  - Payouts: admin-approved withdrawals / transfers (clearer than "wallet payouts" alone).
  - Keep OTP / lifecycle bullet or merge where redundant.

- **Optional (small):** Tweak 1–2 **workflow step** descriptions if they still say only "wallet" without context (e.g. customer "Wallet Top-up" / provider withdraw lines) — only if it fits the concise card format.

## Copy constraints

- **Tone:** Clear, scannable; avoid repeating "admin" in every bullet.
- **Terminology:** Use "escrow" only if product/legal agrees it matches behavior (held funds until release); otherwise "secure held payments" or "protected payments until completion".
- **Length:** Hero and metadata stay readable; use `text-balance` or line breaks only if already in design system.

## Verification

- Manual read of home + view-source or OG debugger after deploy for `zemenservice.com`.
- No admin app or API changes unless copy references something untrue.

## Out of scope

- New sections or illustrations; i18n; analytics.
