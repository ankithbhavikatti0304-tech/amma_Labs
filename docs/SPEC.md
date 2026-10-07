# Amma Labs — product spec

## 1. Users and roles

| Role | Can do |
|---|---|
| Patient | Log in by OTP, browse and book tests, manage family members and addresses, pay, track orders, read and share reports |
| Phlebotomist | See assigned pickups for the day, mark a sample as collected (with a barcode scan later) |
| Lab technician | Enter result values for collected samples |
| Pathologist | Review and verify results, which releases the report |
| Admin | Manage the catalogue, prices, coupons, slots, staff and callback requests |

## 2. Patient features (all shown in `prototype/index.html`)

1. **Login:** name + mobile number, then a 6-digit OTP. Auto-advance boxes, paste support, a 30-second resend timer, rate limiting, and a 5-minute OTP expiry.
2. **Three ways to order:**
   - **Online:** add to cart, then checkout.
   - **WhatsApp:** a click-to-chat link with the cart pre-filled (phase 1). The WhatsApp Business API comes later.
   - **Phone call:** show the lab number with a copy button, plus a call-back request form that goes to the admin queue.
   - **Prescription upload:** image or PDF. The admin reads it, builds the cart and calls the patient.
3. **Catalogue:**
   - **Categories:** Full body packages, Men, Women, Liver & kidney, Thyroid, Hormones, Allergy, Fever, Diabetes, Vitamins, and X-rays, scans & more.
   - **Cards** show the name, test count with an expandable list of what's included, report time, price, MRP, % off and fasting needs.
   - **Filters and sort:** "packages only", "report in 24 hrs" and "no fasting"; sort by popularity, price or fastest report.
   - **Search:** a pop-up search box (opened with `/` or Cmd/Ctrl+K) that matches test names, included parameters and categories.
4. **Cart:**
   - Add or remove items instantly, with a floating cart bar at the bottom.
   - Coupons: `AMMA10` gives 10% off up to ₹300; `FIRST100` gives ₹100 off orders above ₹999.
   - Optional hard copy of reports for ₹150.
   - Home collection is free above ₹499, otherwise ₹99.
5. **Checkout:**
   - Patient details: name, age and gender.
   - Address with pincode.
   - Slot: date for the next 5 days, then a time slot. Only morning slots are open if any test needs fasting or a morning sample.
   - X-rays, scans and ECG need a centre visit, so show a note.
   - Payment: pay at collection, or online.
6. **Order tracking:** Booked → Sample collected → Processing at lab → Report ready.
7. **Report:** each parameter shows its value, unit, reference range, a bar showing where the value sits, and a Normal / High / Low flag. Reports have a PDF download and share-on-WhatsApp.

## 3. Data model (first cut)

- `User(id, name, phone, createdAt)` and `Patient(id, userId, name, age, gender)` for family members.
- `Address(id, userId, line, pincode, city)`.
- `Category(id, name, slug, mascot)`.
- `Test(id, name, slug, categoryIds[], isPackage, parameterCount, tatHours, price, mrp, fasting, morningSample, centreVisit, popular, includes[])`.
- `Parameter(id, name, unit, refLow, refHigh, decimals, sexSpecific?)` and `TestParameter(testId, parameterId)`.
- `Coupon(code, type, value, cap, minOrder, active)`.
- `Order(id, userId, patientId, addressId, slotDate, slotTime, status, payMode, subtotal, discount, couponCode, collectionFee, hardCopyFee, total)`.
- `OrderItem(orderId, testId, price, mrp)`.
- `Sample(id, orderId, barcode, collectedAt, phlebotomistId)`.
- `Result(id, orderId, parameterId, value, flag, enteredBy, verifiedBy, verifiedAt)`.
- `Report(id, orderId, pdfUrl, releasedAt)`.
- `OtpRequest(phone, codeHash, expiresAt, attempts)`, `CallbackRequest(phone, createdAt, status)`, `Prescription(id, userId, fileUrl, status)`.

## 4. API (REST or server actions)

- `POST /auth/otp/send`, `POST /auth/otp/verify`, `POST /auth/logout`
- `GET /catalogue/categories`, `GET /catalogue/tests?category=&q=&packagesOnly=&max24h=&noFasting=&sort=`
- `GET/POST/DELETE /cart` (or keep the cart client-side until checkout), `POST /cart/coupon`
- `GET /slots?date=&fasting=`
- `POST /orders`, `GET /orders`, `GET /orders/:id`, `GET /orders/:id/report`
- `POST /callbacks`, `POST /prescriptions` (file upload)
- Staff: `PATCH /orders/:id/status`, `POST /orders/:id/results`, `POST /orders/:id/verify`

## 5. Integrations

- **SMS OTP:** MSG91 or Twilio Verify. Indian SMS needs DLT-registered templates.
- **WhatsApp:** `wa.me` click-to-chat for phase 1. Use the Meta WhatsApp Cloud API or a provider such as Gupshup to send report-ready messages.
- **Payments:** Razorpay (UPI, cards, netbanking), with webhooks to confirm payment.
- **Storage:** S3-compatible storage for prescriptions and report PDFs, served through signed URLs.
- **PDF:** generate report PDFs on the server from the same template as the report screen.

## 6. Placeholders to replace

- Lab phone and WhatsApp number (the prototype uses +91 98765 43210).
- All test prices and MRPs.
- Accreditation claims: the copy says "NABL-certified", so confirm this is true before launch.
- Pathologist name and signature on reports.
- Reference ranges: the prototype uses rough adult ranges, and the lab should supply its own, including by sex and age.

## 7. Suggested build order

1. Scaffold the project, design tokens, layout, nav, footer and the Character component.
2. Catalogue: seed the database from the prototype data, then build the home, category, search and detail pages.
3. Cart and coupons (client-side state).
4. OTP auth.
5. Checkout, orders and slot logic.
6. Order tracking and the report view, with PDF output.
7. Staff and admin panel: results entry, verification, catalogue and coupons.
8. Integrations: SMS, Razorpay, WhatsApp notifications.
9. Polish: accessibility, SEO pages per test, analytics, tests.
