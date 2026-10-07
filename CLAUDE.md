# Amma Labs — project guide for Claude Code

Amma Labs is a blood-test lab in Bengaluru. This repo turns the approved clickable prototype into a production web app where patients book tests, get a home sample collection, and read their reports online.

Tagline: **"Tested with a mother's care."**

## Source of truth

- `prototype/index.html` is the approved UI. It is a single file with inline CSS and JS. Open it in a browser to see every screen and flow. Match its look, layout and behaviour.
- `docs/SPEC.md` lists the features, data model, API and integrations to build.
- The catalogue (tests, packages, prices, report times, included parameters) is in the prototype's `<script>` as the `T` array, built with `add(...)`. Reference ranges are in `REF`. Move both into the database seed. **All prices are placeholders** copied from a competitor, so the lab must supply real ones.

## Decide before writing code

Confirm the stack with VG first. The suggested default is:

- **Next.js (App Router) + TypeScript + Tailwind CSS**, with server actions and route handlers.
- **PostgreSQL + Prisma**.
- **Auth:** phone number + OTP, with the session in an httpOnly cookie.
- **Hosting:** Vercel plus a managed Postgres, such as Neon or Supabase.

Alternative: an ASP.NET Core Web API backend with a React (Vite) frontend, if VG prefers .NET.

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
