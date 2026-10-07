# Amma Labs

A blood-test lab's web app: patients log in with their phone, book tests with home sample collection, pay at collection or online, track the order, and read their report online. Lab staff collect samples, enter results and release reports; admins run the catalogue, prices and coupons.

> **Tested with a mother's care.**

Built from the approved clickable prototype (`prototype/index.html`), which stays in the repo as the design reference.

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · PostgreSQL · Prisma 7 · Vitest · Playwright.

---

## Run it locally

You need Node 22+ and a Postgres database.

```bash
docker compose up -d db                 # Postgres on 127.0.0.1:5432 (or point DATABASE_URL at any Postgres)
cp .env.example .env                    # the defaults work for local development
npm install
npm run db:deploy                       # create the tables
npm run db:seed                         # load the catalogue from the prototype (safe to re-run, never overwrites edits)
npm run staff:add -- --phone 9876543210 --name "Your Name" --role ADMIN
npm run dev                             # http://localhost:3000
```

Log in with the phone number you gave `staff:add`. In development the one-time code is **shown on screen** ("Demo mode"), so you don't need an SMS account. Online payment uses a **test "Pay" button** that moves no money. Both switch off automatically in production (the app refuses to start with them).

### Everyday commands

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build && npm start` | Production build and server |
| `npm run lint` · `npm run typecheck` | ESLint · TypeScript |
| `npm test` | Unit tests, then integration tests against a real Postgres (`TEST_DATABASE_URL`) |
| `npm run e2e` | Browser tests against the production build (build first). Includes accessibility scans |
| `npm run db:migrate` | Create a migration after editing `prisma/schema.prisma` |
| `npm run db:deploy` | Apply migrations (what production runs) |
| `npm run staff:add -- --phone … --name … --role …` | Create or promote a staff account |

---

## How it works

```
src/app/            Pages and API routes (App Router)
src/components/     UI. chrome/ (nav, sheets, search), catalogue/, checkout/, orders/, staff/, admin/, character/
src/server/         Server-only code: auth, orders, results, payments, storage, notifications, admin. Nothing here reaches the browser
src/lib/            Pure logic shared by browser and server: pricing, coupons, result flags, IST dates, phone rules
src/config/         Lab defaults and business rules
src/styles/         The prototype's design tokens and component CSS, ported as-is (light + dark)
prisma/             Schema, migrations, seed and the catalogue extracted from the prototype
e2e/  test/         Browser tests · test helpers
```

**One source of truth for money.** The cart total shown in the browser and the amount charged come from the same pure function (`src/lib/pricing.ts`). At checkout the server recomputes everything from the database; the browser's total is only *compared*, and a mismatch is refused with a clear message instead of charging a different amount.

**People and what they can do**

| Role | Does |
|---|---|
| Patient | Log in by OTP, browse and book, pay, track, read and download reports, manage saved details, export or request deletion of their data |
| Phlebotomist | Sees assigned and unassigned pickups for the day, marks a sample collected (tube barcode, cash taken) |
| Lab technician | Enters result values |
| Pathologist | Reviews and releases the report (which locks the results and generates the PDF) |
| Admin | Everything above, plus tests and prices, reference ranges, coupons, slots, staff, call-back and prescription inbox, settings |

**An order's life:** Booked → Sample collected → Processing at lab → Report ready (online orders start at *Awaiting payment* and hold their slot for 15 minutes). The server decides every result flag: the technician types a number; the server rounds it, picks the reference range for that patient's age and sex, and sets Normal / High / Low.

---

## Security and privacy

What is built, so a reviewer can check it rather than trust it:

- **Login:** phone + 6-digit OTP. Codes expire in 5 minutes, are stored only as a keyed hash, allow 5 attempts, one resend per 30 seconds, 5 per hour per number, 20 per hour per network address, and a site-wide hourly ceiling (SMS-pumping protection). Same response whether or not a number has an account.
- **Sessions:** random token in an `httpOnly`, `SameSite=Lax`, `Secure` (`__Host-` prefixed in production) cookie. Only a SHA-256 of the token is stored, so a database leak yields no usable sessions, and sessions can be revoked. Staff sessions are shorter (4 h idle, 12 h max). Disabling or re-roling someone ends their sessions at once.
- **Authorization checked in the server code of every endpoint and page**, not just in the UI or middleware: patients see only their own orders and reports (someone else's order looks exactly like a missing one); staff APIs are role-gated; a test matrix covers every staff and admin endpoint against every role.
- **CSRF:** `SameSite` cookies plus an `Origin` / `Sec-Fetch-Site` check on every state-changing request.
- **Headers:** nonce-based Content-Security-Policy (no inline scripts, `frame-ancestors 'none'`), HSTS, `nosniff`, strict referrer and permissions policies. Pages with personal data are never cached by a shared cache.
- **Input:** every API validates with Zod; all database access goes through Prisma (parameterised). Uploads are judged by their bytes, not their name (JPEG/PNG/WebP/PDF, 5 MB), stored in private storage and served only through an authenticated route as a locked-down attachment.
- **Payments:** the gateway amount comes from the order row; checkout and webhook signatures are verified in constant time; webhooks are idempotent; an amount mismatch is never confirmed; money arriving for a lapsed order is recorded so staff can refund it.
- **Health data (DPDP Act 2023):** consent captured at first login (versioned, not pre-ticked); privacy notice; the patient can see, correct, export and request deletion of their data; every open or download of a report, and every result entry and release, is written to an audit log that **never stores result values, OTPs or phone numbers**. Logs redact sensitive fields, and database error text is cut to its first line because Prisma echoes submitted data after it.
- **Config safety:** the environment is validated at boot. Production refuses the dev SMS provider (it would show codes on screen), the mock payment provider, local disk storage, an `http` site URL, a missing cron secret, and an unset `TRUST_PROXY`.
- **Accessibility:** axe (WCAG 2.1 A/AA) runs in the browser tests on the storefront, report, staff and admin pages, in light and dark themes.

Known gaps and judgement calls are listed at the end of this file and in `docs/LAUNCH-CHECKLIST.md`.

---

## Deploy

The suggested setup is **Vercel + a managed Postgres (Neon or Supabase)** and an S3-compatible bucket.

1. **Database.** Create a Postgres. Set `DATABASE_URL` to the *pooled* connection string and `DIRECT_URL` to the direct one. After deploy, run `npm run db:deploy` against production (CI step or a one-off), then `npm run db:seed`, then `npm run staff:add` for the first admin.
2. **Environment.** Set everything in `.env.example` that is marked required for production. `APP_URL` must be `https://…`; set `TRUST_PROXY=true` on Vercel.
3. **SMS.** Register a DLT sender and an OTP template with MSG91 (Indian SMS requires it); set `SMS_PROVIDER=msg91` and the keys. Optional booking-message templates are listed in `src/server/notify.ts`.
4. **Payments.** Create Razorpay keys, enable auto-capture, and add a webhook to `https://YOUR-SITE/api/webhooks/razorpay` for `payment.captured`, `order.paid` and `payment.failed`. Set `PAYMENT_PROVIDER=razorpay`.
5. **Storage.** Create a private bucket (block all public access); set `STORAGE_DRIVER=s3` and the `S3_*` keys.
6. **Scheduled job.** `vercel.json` calls `/api/cron/maintenance` every 15 minutes (releases unpaid slot holds, retries failed messages, clears expired sessions and counters). Set `CRON_SECRET`; Vercel sends it automatically. On Vercel's free plan, crons run at most daily; the 15-minute hold still works because slot availability is computed live, the job only tidies up.
7. **Check it.** Place a test order, pay, collect, enter results, release, download the PDF. **Open the PDF on the first preview deploy**: PDF generation reads font files from disk, which is the one piece that behaves differently on serverless than locally (the file paths are declared in `next.config.ts`).

CI (`.github/workflows/ci.yml`) runs lint, types, unit, integration and browser tests plus a production-dependency audit on every pull request. Dependabot proposes updates weekly.

---

## Before real patients use it

The prototype's data is placeholder. **Do not launch until the lab has replaced it** (full list in `docs/LAUNCH-CHECKLIST.md`):

- **All test prices and MRPs** (copied from a competitor). Admin → Tests & prices.
- **Reference ranges** (rough adult ranges), including the sex- and age-specific rules. Admin → Reference ranges.
- **Which results each test reports.** The seed only knows the parameters in the prototype; tests such as urine routine, blood group or infection panels have none yet, so no report can be released for them until the lab adds them (Admin → Tests & prices → *Results this test reports*).
- **Lab phone and WhatsApp number** (the prototype's `+91 98765 43210` is a stand-in). Admin → Settings.
- **The "NABL-certified" claim.** Confirm it is true, or set `CLAIMS.nabl = false` in `src/config/claims.ts`.
- **Privacy notice**: fill the bracketed items (retention period, grievance officer) and have the lab's legal advisor review `src/app/privacy/page.tsx`.
- **Pathologist name** on reports comes from the pathologist's own account name; set it (with "Dr.") under Admin → Staff.

## Not built / limits

- Refunds are done in the Razorpay dashboard; the app records money that needs refunding (paid + cancelled orders, `payment.late` in the audit log) but does not issue refunds itself.
- A released report can be corrected only by an admin reopening it (with a reason on record); there is no versioned amendment history.
- One sample per order is the normal case; the data model allows several, the staff screen collects one.
- Staff screens are functional rather than polished, and are not optimised for very small phones.
- No barcode-scanner integration yet (the tube barcode is typed or pasted from a scanner that types).
- The MSG91 and WhatsApp Cloud adapters are written against the providers' documented APIs but have **not** been exercised against the live services; send one real code and one of each message in staging before launch.
- JavaScript is required for the booking flow.
