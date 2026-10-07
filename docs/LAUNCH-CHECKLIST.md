# Launch checklist

Tick each line before real patients use the site. Things the code cannot decide for you come first.

## Content only the lab can supply

- [ ] **Prices and MRPs** for every test and package (prototype values are placeholders copied from a competitor). *Admin → Tests & prices*
- [ ] **Reference ranges**, with sex- and age-specific rules where the lab's ranges differ. *Admin → Reference ranges*. A change applies to results entered afterwards; released reports keep the range they were flagged against.
- [ ] **Results each test reports.** Open every test you will sell and check *Results this test reports*. Tests with none cannot have a report released. The prototype did not model, for example, urine routine, blood group, or the infection panel inside the fever package.
- [ ] **Lab phone, WhatsApp number, hours, fees** (free-collection threshold, collection fee, hard-copy fee). *Admin → Settings*
- [ ] **Collection windows and capacity.** The seed gives each window room for 20 bookings a day, which is a guess. *Admin → Slots*
- [ ] **Serviceable area.** Pincodes starting with `5` are accepted (Karnataka), as in the prototype. Tighten it in `SERVICEABLE_PINCODE_PREFIXES` (`src/config/lab.ts`) if you do not cover all of it.
- [ ] **Cities** in the picker (`CITIES` in `src/config/lab.ts`): the prototype lists Bengaluru, Mysuru, Hubballi, Mangaluru. The picker only changes wording and the address city; it does not change prices or availability.
- [ ] **Coupons** AMMA10 and FIRST100 are from the prototype. Keep, change or remove. *Admin → Coupons*
- [ ] **Accreditation claim.** The site says "NABL-certified lab". Confirm it, or set `CLAIMS.nabl = false` (`src/config/claims.ts`).
- [ ] **Staff accounts** for each phlebotomist, technician and pathologist, with real names (the pathologist's name is printed on reports). *Admin → Staff*
- [ ] **Pathologist title** printed under "Verified by". *Admin → Settings*

## Legal

- [ ] **Privacy notice** (`src/app/privacy/page.tsx`): fill the bracketed retention period and grievance officer; have your legal advisor review it. When it changes materially, bump `CONSENT_VERSION` in `src/config/lab.ts`.
- [ ] **Retention rule.** Decide how long reports and records are kept, and what "delete my account" means given that. Requests arrive in *Admin → Inbox* marked `ACCOUNT DELETION REQUEST`.
- [ ] **Terms of service / refund and cancellation policy** if you want them; there is no terms page yet.

## Accounts and keys

- [ ] Postgres (pooled `DATABASE_URL`, direct `DIRECT_URL`), backups on, point-in-time recovery if offered.
- [ ] `APP_SECRET`, `CRON_SECRET` generated (`openssl rand -base64 48`), stored in the host's secret store only.
- [ ] **MSG91**: DLT entity, sender id and OTP template approved; `SMS_PROVIDER=msg91`. Optionally templates for booking-confirmed, sample-collected and report-ready.
- [ ] **Payments.** Launching with pay-at-collection only: set `PAYMENT_PROVIDER=none`. Adding online payment later: Razorpay live keys, auto-capture on, webhook for `payment.captured`, `order.paid`, `payment.failed`, then `PAYMENT_PROVIDER=razorpay`.
- [ ] **Bucket** created with *Block all public access*; server-side encryption on; access key limited to that bucket.
- [ ] **WhatsApp Cloud API** (optional): templates `al_booking_confirmed`, `al_sample_collected`, `al_report_ready` approved.
- [ ] `TRUST_PROXY=true` on Vercel. `APP_URL` is the final `https://` address.

## Prove it works

- [ ] Run the full journey on the deployed site: book (cash), book (online, if enabled), cancel, collect, enter results, release, read the report on a phone, download the PDF **and open it**.
- [ ] Send one real OTP, one booking message of each kind.
- [ ] If online payment is on: pay ₹1 for real and check the webhook flips the order, then refund it.
- [ ] Try to open one patient's report while logged in as another. It must look like a missing page.
- [ ] Run the browser tests against staging (`npm run e2e`) or at least the accessibility scans.
- [ ] Look at the site on a low-end Android phone on mobile data.

## Operate

- [ ] Uptime monitor on `/api/health` (returns 503 if the database is unreachable).
- [ ] Error alerts. The app logs structured JSON with redaction (`src/server/log.ts`); point Vercel log drains or your monitoring at it. Adding Sentry or similar is a small change in `src/instrumentation.ts`.
- [ ] Someone watches the **Inbox** (call-back requests, prescriptions) and the **payment.late / payment.mismatch** entries in the audit log (paid but cancelled orders need a refund).
- [ ] Review `npm audit` and Dependabot pull requests weekly.
- [ ] Decide who may be an admin. Admins can see every patient's reports.
