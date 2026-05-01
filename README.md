# Finca Buena Vida

Community website for **Finca Buena Vida** — a ~20-owner property co-op on a 102-acre island in Dolphin Bay, Bocas del Toro, Panama.

Live: [fincabuenavidapanama.com](https://fincabuenavidapanama.com)

## What's here

- **Public site** (`index.html`, `fbv-map.html`) — about the community, property listings, an interactive Leaflet map, weather and climate widgets.
- **Member portal** (`member/`) — Supabase-authenticated area for owners: HOA dues payment via Stripe, member directory, document library, board announcements, and lot-listing management.

Hand-written vanilla HTML / CSS / JS. No build step, no framework.

## Project layout

```
index.html, fbv-map.html        Public pages
script.js, styles.css, utils.js Shared front-end code
member/                         Owner portal (login + tabbed SPA)
data/                           Static JSON fallback for listings & lots
netlify/functions/              Stripe payment + email reminders (Node)
supabase/                       DB schema, migrations, edge functions
.github/workflows/deploy.yml    GH Pages deploy on push to main
```

## Deployment

Two targets:

- **GitHub Pages** serves the static site. Push to `main` → workflow deploys.
- **Netlify** runs the serverless functions in `netlify/functions/` (Stripe, Resend).

Database and auth are hosted on **Supabase**. The schema lives in `supabase/schema.sql`; migrations are applied by hand through the Supabase SQL Editor.

## Local development

```bash
# Static site only:
npx serve .

# With Netlify Functions running locally (for Stripe / email work):
netlify dev
```

The public site degrades gracefully if Supabase is unreachable — it falls back to `data/listings.json` and `data/lots.json`.

## Configuration

- `member/config.js` — **public** Supabase URL, anon key, Stripe publishable key. Safe to commit; RLS protects data.
- `.env.example` — server-side secrets needed by the Netlify Functions. Set these as Netlify environment variables, never commit them.

## Architecture notes

See [`CLAUDE.md`](./CLAUDE.md) for a developer-oriented walkthrough of the data flow, RLS model, Stripe dues flow, and the lot-number encoding convention (S1–S12 → 101–112, I1–I12 → 201–212).
