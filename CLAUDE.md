# Amma Labs — project guide for Claude Code

Amma Labs is a blood-test lab in Bengaluru. This repo turns the approved clickable prototype into a production web app where patients book tests, get a home sample collection, and read their reports online.

Tagline: **"Tested with a mother's care."**

## Source of truth

- `prototype/index.html` is the approved UI (single file, inline CSS and JS). Open it in a browser to compare any screen. The app matches its look, layout and behaviour; placeholders and demo-only parts (sample report note, "next stage" button, wireframe-lines toggle, on-screen OTP in production) were replaced with real behaviour.
- `docs/SPEC.md` lists the features, data model, API and integrations to build.
- The catalogue (tests, packages, prices, report times, included parameters) came from the prototype's `T` array and `REF` table via `scripts/extract-prototype-data.mjs` into `prisma/data/catalogue.json`, which `prisma/seed.ts` loads (create-if-missing; `SEED_FORCE=1` to overwrite). **All prices and reference ranges are placeholders** from a competitor/rough adult ranges; the lab must supply real ones (see `docs/LAUNCH-CHECKLIST.md`).

## Stack (confirmed by VG)

Next.js 16 (App Router) + TypeScript + Tailwind CSS 4, PostgreSQL + Prisma 7, Vitest, Playwright. Phone + OTP auth with a server-side session in an httpOnly cookie. Hosting target: Vercel + managed Postgres (Neon/Supabase) + an S3-compatible bucket. The ASP.NET alternative was not chosen.

## Working in this repo

- Setup and commands are in `README.md`. Before saying something works, run `npm run lint && npm run typecheck && npm test`, and `npm run build && npm run e2e` for anything user-facing.
- **Next.js 16 differs from older versions** (`proxy.ts` replaces middleware, async `cookies()`/`params`, caching model). `AGENTS.md` and `node_modules/next/dist/docs/` are the reference; read the relevant guide before using an API from memory.
- `src/server/**` is server-only (`import 'server-only'`). `src/lib/**` is pure and shared with the browser. Never import `src/server` values into a client component (types only).
- **Money:** all pricing goes through `src/lib/pricing.ts`. The server recomputes the bill from the database at checkout and compares it with what the browser showed; never trust a client price.
- **Result flags** are decided by the server (`src/lib/results.ts`, `src/lib/report.ts`), per patient age and sex. A technician types a number, never a flag.
- **Authorization lives in the server code of each API route and page**, not in the UI. New staff/admin endpoints go in `src/server/rbac.int.test.ts`'s matrix.
- **Never log or audit** OTPs, result values, phone numbers or free text from patients. Use `src/server/log.ts` (redacts) and `audit()` (ids and counts only).
- Every mutation validates input with Zod and goes through `api()` in `src/server/http.ts` (origin check, auth, rate limit, error mapping).
- Admin edits that change what patients see must call `invalidateCatalogue()`.
- The prototype's CSS is ported as-is into `src/styles/` (components layer). Two status text colours (`--ok`, `--lo`) are a shade darker than the prototype for WCAG AA contrast; the five brand tokens are unchanged. Run the axe e2e after any colour or markup change.
- Dev-only providers (`SMS_PROVIDER=dev`, `PAYMENT_PROVIDER=mock`, `STORAGE_DRIVER=local`) are refused in production by `src/server/env.ts`. Keep it that way.

## Design system (keep it exactly)

| Token | Light | Use |
|---|---|---|
| Blue | `#3368A0` | Primary actions, links, gradient start |
| Sky | `#66A3BF` | Secondary, gradient end, dark-mode accent |
| Mint | `#C8DFDB` | Tags, highlights, character tiles |
| Cream | `#F2EFE7` | Page background |
| Ink / dock | `#0F2236` | Text, dark buttons, cart dock |

- **Font:** Manrope (400–800) from Google Fonts. JetBrains Mono for small labels and codes.
- **Shapes:** radius of 24–32px on cards and pill buttons, a floating glass nav, a bento hero and a floating cart dock.
- **Theming:** light and dark themes, both defined as CSS variables. The full token set is in the `:root` blocks of the prototype.
- **Characters:** every package, test and category has an animated SVG character, made by `person()`, the mascot builders in `M`, `AV` (test→mascot) and `PPL` (package→person). Port them into a `<Character id=… />` component. Keep the animations CSS-only and respect `prefers-reduced-motion`.
- **Speed:** interactions must feel instant. Add-to-cart updates optimistically with no full re-render, and search results appear as you type.

## Conventions

- Mobile-first, with no horizontal scroll at 360px.
- Indian formatting: `₹` with `en-IN` grouping, +91 numbers, 6-digit pincodes.
- Health data is sensitive. Never log report values or OTPs. Follow India's DPDP Act 2023 for consent and data handling.
- Keep copy plain and specific, like the prototype.
