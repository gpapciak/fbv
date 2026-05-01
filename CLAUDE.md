# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Finca Buena Vida (FBV) — community website for a ~20-owner property co-op on a 102-acre island in Dolphin Bay, Bocas del Toro, Panama. Two surfaces:

- **Public marketing site** — `index.html`, `fbv-map.html`
- **Member portal** — `member/login.html`, `member/portal.html` (Supabase auth, dues payment, directory, documents, board posts, lot listing management)

## Stack

Hand-written vanilla HTML / CSS / JS. **No build step, no test suite, no framework.** Dependencies in `package.json` are server-side only (Stripe, Supabase, Resend) for Netlify Functions.

- **Hosting (static):** GitHub Pages, deployed by `.github/workflows/deploy.yml` on push to `main`.
- **Hosting (serverless):** Netlify Functions for Stripe + email. **The site has two deploy targets** — GH Pages serves HTML/CSS/JS; Netlify runs only the functions in `netlify/functions/`. `netlify.toml` exists for the functions side.
- **Database / auth:** Supabase. Schema and RLS policies live in `supabase/schema.sql`; migrations in `supabase/migrate_*.sql` are applied by hand via the Supabase SQL Editor.
- **Payments:** Stripe (PaymentIntent flow + webhook).
- **Email:** Resend (dues reminders).

## Commands

There is no `npm run build`, lint, or test. Common operations:

```powershell
# Local preview of the static site (any static server works):
npx serve .

# Local dev with Netlify Functions (Stripe / Resend) running locally:
netlify dev

# Functions deps (when editing files in netlify/functions/):
cd netlify/functions ; npm install

# Deploy static site: just push to main — GH Pages workflow runs automatically.
# Deploy functions: handled by Netlify on its own pipeline when configured.

# Apply DB schema or a migration: paste the SQL file into Supabase Dashboard → SQL Editor.
```

## Architecture

### Data flow for public listings

`script.js` → tries Supabase `lot_listings` table (live) → falls back to `data/listings.json` and `data/lots.json` if Supabase is unreachable or unconfigured. Both code paths render through `renderListings()`. When editing listing rendering, keep the two sources in shape-parity or they'll diverge silently.

### Member portal

`member/portal.html` is a single-page tabbed app driven by `member/member.js`. Tabs (dashboard, dues, directory, profile, documents, board, my listing) are functions named `loadXxx()` / `submitXxx()`. Auth is Supabase email/password + magic link. **`DEMO_MODE`** kicks in when `FBV_CONFIG` isn't filled in — the portal renders mock data so the UI is testable without a backend.

### Supabase model

Tables: `owners`, `dues`, `documents`, `announcements`, `comments`, `lot_listings`. Every member-facing table has RLS enabled. Two helper functions gate everything:

- `current_owner_id()` — returns `owners.id` for `auth.uid()`
- `is_admin()` — `owners.is_admin = true`

A user is considered a "member" only after a row exists in `owners` with their `user_id`. Without that row, all RLS-gated reads return empty. Admins are flipped manually via `UPDATE owners SET is_admin = true ...` in the SQL editor.

### Stripe dues flow

1. Portal calls `netlify/functions/create-payment.js` with `{ dueId, amountCents, ownerEmail, passthrough }` → returns a PaymentIntent client secret. `dueId` is stuffed into `metadata`.
2. Stripe Elements collects card; client confirms PaymentIntent.
3. Stripe fires `payment_intent.succeeded` → `netlify/functions/stripe-webhook.js` reads `metadata.dueId` and marks `dues.paid_at` using the **service role key** (bypasses RLS — that's intentional and required).

### Lot number encoding (load-bearing convention)

Lots are stored as integers but displayed with a letter prefix:

- **Shore lots S1–S12 → 101–112**
- **Inland lots I1–I12 → 201–212**

`lotLabel(n)` in `utils.js` is the only place that decodes these. Don't introduce a competing scheme. The mapping appears in `data/lots.json`, `lot_listings.lot_number`, and `owners.lot_numbers[]`.

### Shared utilities

`utils.js` (`escHtml`, `lotLabel`, `formatDesc`) is loaded by both the public site and the portal. `formatDesc()` turns `- ` lines into bullets — used for property/map card descriptions.

### About-section scroll-build SVG

The "Who We Are" SVG illustration in `index.html` builds in stages as the section scrolls into view. Implementation:

- SVG groups carry `class="fbv-fade" data-stage="0.NN"` — the value is the scroll-progress (0–1) at which the group starts fading in.
- The driver script lives **inline at the bottom of `index.html`** (not in `script.js`). `FADE_DURATION = 0.08` is the per-stage fade length, so a stage at `0.37` is fully visible at progress `0.45`.
- The pull-quote threshold sits just past the last stage so the quote appears once the scene is complete.
- `fbv_about_preview.html` is a standalone sandbox of the same SVG + script. **Keep the two in sync** when adjusting timing or shapes — the preview is a visual diff tool, not a separate page.
- All `.fbv-fade` opacity is forced to 1 under `prefers-reduced-motion: reduce` (handled in both CSS and JS).

## Configuration

- `member/config.js` holds the **public** Supabase URL + anon key and Stripe publishable key. These are committed on purpose — they're public client tokens; RLS is the security boundary, not key obscurity.
- Server-side secrets (`SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`) are set in **Netlify env vars**, never in this repo. `.env.example` documents the full set.

## Conventions worth knowing

- The hero, about, and many other sections rely on `IntersectionObserver` + a `.fade-in` / `.visible` class pair. New sections should follow the same pattern.
- `prefers-reduced-motion` is respected throughout — any new animation should have a CSS escape hatch under that media query.
- The public site is fully static-loadable: opening `index.html` from disk should render (Supabase calls degrade to JSON fallback). Don't introduce hard dependencies on a running backend in the public site.
- Supabase Edge Function `supabase/functions/notify-admin-listing-change` is deployed via the Supabase CLI, not Netlify.
