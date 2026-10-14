# Clothing store: project brief for Claude Code

Online clothing store for an Indian brand (name not chosen yet: keep it in one config place, never hard-code it).
Owner/developer: Varad (Windows, PowerShell, VS Code). Repo: `varadTheDeveloper/e-commerce`, **public, GPL-3.0** (client agreed).

## Working agreement
- Explain the plan first and wait for OK before building, and before every `git push`. Work on a branch, open a PR.
- Say plainly what was tested and what was not. Do not claim a feature works if it was not run.
- Never print, store or commit secrets. The repo is public: keys live only in `.env` files and AWS Secrets Manager. If a key is pasted in chat, say to revoke it.
- Short answers, simple language.

## Goal
Amazon/Flipkart-level experience for one clothing brand: fast on cheap phones and 4G, mobile first, mr / hi / en (every customer-facing string in all three), accessible (WCAG AA).
Copy *ideas* from Amazon/Flipkart/Myntra, never their code, logos, names or design assets.
Copying open-source code is fine (MIT, BSD, GPL); record every copy in `CREDITS.md` with the commit.

## Stack (decided)
```
backend/      Medusa v2 (2.21.x), Postgres 16, Redis 7     from medusa-starter-default (MIT)
storefront/   Next.js 16 + Tailwind                         from nextjs-starter-medusa (MIT)
```
Search: in-memory over the catalogue (`storefront/src/lib/util/search.ts`); move to Medusa's search module or Meilisearch if the catalogue grows past a few thousand products. Payments: Razorpay + COD. Shipping: Shiprocket. Hosting: AWS.
Prices are INR. Medusa v2 stores amounts in major units (999 = ₹999).

## Phase 1 steps
1. (done) Setup: starters, India/INR seed, strict typecheck, CI, Docker, licence, credits.
2. (done) Catalogue: home/category/collection/product/search pages, size+colour variants, gallery zoom, size chart, filters, sort, mr/hi/en, demo catalogue, browser wishlist, unit + browser tests.
   Design (approved): modern premium with an Indian touch (Westside/Zara-like): off-white, near-black, one maroon accent,
   Tiro Devanagari Marathi headings + Mukta text, square corners, photo-led. Real demo photos from Unsplash.
3. (done) Account + bag: phone OTP login (custom auth provider `phone-otp`), Indian addresses, account wishlist, bag page.
4. (done) Checkout: address, Razorpay (manual capture, checked on the server, signed webhook), COD (limit + SMS code), stock check, delivery charge, GST invoice PDF.
5. (done) Orders + shipping: Shiprocket (pincode check, booking from the admin, tracking webhook), order timeline, email (Resend) + SMS (Message Central, DLT) updates, cancel before dispatch.
6. (done) Returns + size exchange: 7 days after delivery, free pickup (Shiprocket), photos for damaged/wrong items, COD refunds by staff to UPI/bank, online refunds through Razorpay, staff page in the admin, staff guide `docs/STAFF-GUIDE.md`.
7. Quality, in 3 PRs:
   7a. (done) Legal/help pages (mr/hi/en, placeholder seller details, "draft" notice), consent at sign-up, delete my account.
   7b. (done) Phone speed check, accessibility (axe + keyboard), security review, "golden path" browser test.
       Results and what is left: `docs/QUALITY.md`.
   7c. (done, running at https://shop.lexauraa.in, API https://shop-api.lexauraa.in) Test copy on AWS: one t3.micro EC2 with Docker (Caddy + website + Medusa +
       Postgres + Redis), images built by GitHub Actions, demo password, nightly backups: `docs/EC2-SETUP.md`.
       Before real customers: at least t3.medium, production keys, demo password off.
Later phases: reviews, recommendations, offers, loyalty, PWA, CRM (customer profiles, segments, tickets), dashboards.

## How the shop works (storefront)
- URLs: `/[locale]/...` with locale `mr` (default) | `hi` | `en`. `src/proxy.ts` (Next.js 16 name for middleware) redirects and keeps `_medusa_locale` in step.
  `[locale]/layout.tsx` is the root layout (sets `<html lang>`). Region is always India (`NEXT_PUBLIC_DEFAULT_REGION=in`).
- UI strings: `src/lib/i18n/dictionaries/{en,hi,mr}.ts` (en defines the type). Server: `getDictionary(locale)`; client: `useI18n()`.
- Catalogue reads: `src/lib/data/catalog.ts`, always passing the locale explicitly (sends `x-medusa-locale`), so pre-built pages are right.
- Filters/sort/search are pure functions in `src/lib/util/catalog.ts` and `search.ts`, applied in memory (catalogue loaded whole, max 500).
- Product pages are rendered on each visit (the layout reads cookies), not pre-built, although `generateStaticParams`
  exists. Catalogue data is cached and fetched again at most every 5 minutes (`lib/data/catalog.ts`), so admin
  changes show without a deploy.
- Backend: translation module is listed explicitly in `medusa-config.ts` (the feature flag alone is read too late).
- Login: `backend/src/modules/phone-otp-auth` (code hash in the auth identity's provider_metadata), routes
  `/store/otp/request` (send code, rate-limited) and `/store/otp/account` (create customer from the verified phone),
  then `/auth/customer/phone-otp`. SMS: `backend/src/lib/sms` (console | msg91 | messagecentral). With
  messagecentral, Message Central makes and checks the code; we keep only their verification id (`provider_ref`)
  and our own limits still apply. Admin users keep emailpass.
- Wishlist: module `backend/src/modules/wishlist` + `/store/customers/me/wishlist`; storefront `WishlistProvider`
  uses the account when logged in, browser storage for guests, and merges after login.
- Checkout (`modules/checkout/checkout-view.tsx`, actions in `lib/data/checkout.ts`): login required, saved address
  → delivery method → Razorpay or COD → `/order/[id]/confirmed`. Order pages use `modules/order/order-view.tsx`
  (owner only). Invoice: `/api/invoice/[id]` proxies `GET /store/orders/:id/invoice` with the login cookie.
- Payments (backend): providers `src/modules/razorpay` (id `pp_razorpay_razorpay`) and `src/modules/cod`
  (`pp_cod_cod`); the region allows only these two (never `pp_system_default`, which accepts unpaid orders).
  Razorpay orders use manual capture: `authorizePayment` asks Razorpay for the order's payments and captures only
  after Medusa has created the order and reserved stock. Webhook `/hooks/payment/razorpay_razorpay` handles
  `payment.authorized` (signature checked, session id read from the Razorpay order's notes).
  COD: `POST /store/cod/request|confirm` (customer's login phone; no new code within 10 min of an SMS login);
  confirm signs the session (HMAC of session id + amount) and the provider refuses unsigned sessions.
- Shop rules: `backend/src/config/shop.ts` (delivery ₹79, free from ₹999, COD up to ₹5,000), exposed at
  `GET /store/shop-settings`. GST: `backend/src/lib/gst.ts` (5%/18% by piece value, CGST+SGST vs IGST),
  PDF `backend/src/lib/invoice-pdf.ts` (Mukta font, copied into the build by `yarn build`), seller `config/seller.ts`.
- Delivery: Shiprocket fulfillment provider `src/modules/shiprocket` (`shiprocket_shiprocket`, the only delivery
  option). Staff press "Create fulfillment" in the admin → Shiprocket order + AWB + pickup + label. COD vs prepaid
  comes from `order.metadata.payment_method`, set by the `order-payment-method` subscriber; booking refuses orders
  without it. Pincode check: `GET /store/delivery-estimate` (cached 6 h); the complete-cart `validate` hook refuses
  unserved pincodes and COD where couriers can't collect. Tracking webhook `POST /hooks/delivery-updates`
  (x-api-key token; the URL must not contain "shiprocket") → `order.metadata.tracking`, shipment/delivery
  workflows, COD captured on delivery. Customers read it via `GET /store/orders/:id/tracking` (Medusa's store
  order endpoint drops metadata). Cancel: `POST /store/orders/:id/cancel` (owner, before shipping).
- Order updates: `src/subscribers/order-updates.ts` → `src/notifications/send.ts` (Resend email, Message Central
  MessageNow SMS when `SMS_ORDER_UPDATES=true` and the DLT template id is set). Texts in mr/hi/en in
  `src/notifications/messages.ts`; SMS texts must match docs/SETUP-SHIPPING.md (a test checks).
  Order language = `order.locale` (from the cart, set from the language cookie).
- Returns: module `backend/src/modules/returns` (`ReturnRequest`: requested → approved → picked_up → received →
  refund_due/refunded, or completed for exchanges; rejected). Rules in `src/lib/returns.ts`
  (`SHOP.returnWindowDays` after delivery; product `metadata.returnable: false` excluded; one exchange per item,
  same colour, size in stock). Customer: `GET/POST /store/orders/:id/returns`, photos `POST /store/returns/photos`
  (checked image bytes, stored under `returns/<customer id>/`). Staff: `/admin/return-requests/...` (approve books
  a Shiprocket return pickup and starts Medusa's return/exchange in `src/lib/medusa-returns.ts`; receive restocks
  and refunds online payments; COD refunds are recorded by staff, then the UPI/bank details are deleted). Admin page
  `src/admin/routes/return-requests`. Return pickup tracking comes through the same delivery webhook (by AWB).
  Emails in mr/hi/en: `src/notifications/return-messages.ts`. Storefront: order page section
  `modules/order/returns-section.tsx`, form `/account/orders/details/[id]/return`.
- Legal pages: `/[locale]/{about,contact,shipping,returns-policy,privacy,terms,grievance,faq}`, texts in
  `storefront/src/lib/legal/{en,hi,mr}.ts` with {placeholders} from `src/config/seller.ts` (PLACEHOLDERS; name, GSTIN
  and email must match backend `config/seller.ts`, a test checks) and `config/brand.ts`. `SELLER.policiesDraft`
  shows the "draft for testing" notice. A lawyer must review the wording before launch.
- Privacy: sign-up needs `privacy_consent: true` (18+, privacy policy and terms); stored as
  `customer.metadata.privacy_consent` {version (`backend/src/config/privacy.ts`, change it when the policy changes), at}.
  "Delete my account": `POST /store/customers/me/delete` (`src/lib/delete-account.ts`): refused while an order is
  undelivered or a return open; removes name, phone, email, addresses, wishlist and the login; orders stay (GST records).
- Next.js 16 (moved from 15 in Step 7b: 15.3 had a critical security hole and 15.5 left buttons stuck after server
  actions). Server actions refresh data with `updateTag` (not `revalidateTag`); don't add `router.refresh()` after an
  action that already updates a tag. Lint is ESLint 9 (`eslint.config.mjs`, `yarn lint` = `eslint src`).
- Quality guards (browser tests): `e2e/speed.spec.ts` (no font preloading; script/font budget),
  `e2e/a11y.spec.ts` (axe WCAG 2.1 AA on the main pages + keyboard-only purchase), `e2e/golden-path.spec.ts`.
  Fonts are not preloaded on purpose (`[locale]/layout.tsx`); keep it that way.
- Security: website headers in `storefront/next.config.js`; staff login limited after 10 wrong passwords
  (`backend/src/api/middlewares.ts`); return photo uploads limited to 20 per customer per hour.
- Tests use fakes: `backend/integration-tests/fake-razorpay.js`, `fake-shiprocket.js` (both also run by CI for the
  browser tests; Playwright replaces Razorpay's checkout.js with a stand-in) and `fake-messaging.js` (Resend +
  Message Central, backend tests only). The "shipped by staff" browser test needs E2E_ADMIN_EMAIL/PASSWORD and
  E2E_WEBHOOK_TOKEN (CI creates a throwaway admin user).

## Checks before asking to push
```
cd backend;    yarn build; yarn typecheck; yarn test:unit; yarn test:integration:http   (needs DB_HOST/DB_USERNAME/DB_PASSWORD)
cd storefront; yarn typecheck; yarn lint; yarn test; yarn build         (build needs the backend running + publishable key)
cd storefront; yarn start; yarn test:e2e                                (seeded backend running)
```
Run `yarn build` in backend before `yarn typecheck`: it generates `.medusa/types`.
Stop a running dev backend before `yarn test:integration:http`: both use the same Redis queues, and the dev
server would pick up the tests' delayed jobs (the Razorpay webhook test then fails).

## Known limits
- Hindi/Marathi wording (UI and demo products) is not reviewed by a native speaker yet.
- Brand name "Vastra", colours, logo, demo photos and size charts are placeholders. Demo photos are Unsplash
  (credited on /credits, hotlinked from images.unsplash.com); replace with the brand's photos before launch.
- Real SMS: the client is signing up with Message Central (docs/SETUP-SMS.md, option A); until the keys are on the
  server, login works only in test mode. Message Central is tested only against a fake of their API, not the live service.
- Rate limits (codes, staff login, photo uploads, pincode checks) are in memory (one server); move to Redis if
  scaled out. They key on `req.ip` (Medusa trusts one proxy hop). Calls the website makes for a visitor
  (login codes, pincode checks) pass the visitor's address in X-Forwarded-For (`storefront/src/lib/util/client-ip.ts`);
  without it every customer would share one limit. Caddy overwrites X-Forwarded-For, so visitors can't fake it.
- No full Content-Security-Policy for scripts yet (Next.js inline scripts, Razorpay). Build/test tools still have
  audit advisories (not on the live servers); see docs/QUALITY.md.
- Shiprocket, Resend and MessageNow SMS are tested only against fakes built from their docs, not the live services.
  Shiprocket's webhook body format is assumed (`awb`, `current_status`, `order_id`); unknown statuses are logged.
- Order-update SMS need DLT templates (docs/SETUP-SHIPPING.md); off until then. Emails need a verified Resend domain.
- Returns: no SMS for return updates (email only). If Shiprocket refuses a return pickup, staff book it by hand
  (the admin shows the error). No button to refuse a parcel after pickup. Shiprocket's return API is tested only
  against the fake. The warehouse address for returns (`config/seller.ts`) is a placeholder.
- Uploaded photos: server disk (`FILE_BASE_URL`) or S3 with the server's IAM role (`S3_BUCKET`, `S3_FILE_URL`;
  `medusa-config.ts`). Return photos are public but unguessable URLs; a private bucket with short links is still to do.
- Razorpay is tested only against a fake of its API and a stand-in for its payment window, not the live service.
- Seller details, HSN codes and the GST rules need the client's accountant to confirm before launch (docs/SETUP-PAYMENTS.md).
- Medusa's own tax is 0: prices include GST, and the invoice splits GST out. Change this if B2B (GST credit) sales are added.
- Stock is checked before payment and again when the order is placed; it is not held while the customer pays.
- Legal pages use placeholder seller and grievance-officer details and are drafts (not reviewed by a lawyer).
- Image hosts for the website are set at build time (`IMAGE_HOSTS`; `ALLOW_LOCALHOST_IMAGES=false` on the server).
- The Next.js build fetches products from the backend, so CI starts the backend first.
- Docker is not available in the cloud dev box: the server setup (`deploy/`) was checked by building and running the
  same steps without Docker, validating the compose file and Caddyfile, and running Caddy; the images themselves are
  first built by GitHub Actions and first run on the server.
