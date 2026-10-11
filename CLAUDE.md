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
storefront/   Next.js 15 + Tailwind                         from nextjs-starter-medusa (MIT)
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
5. Orders + shipping: Shiprocket, tracking page, email/SMS updates, cancel before dispatch.
6. Returns + size exchange.
7. Quality: Playwright end-to-end purchase test, phone speed check, security review, legal pages (India E-Commerce Rules 2020: seller details, grievance officer, country of origin, return policy; DPDP Act consent), staging on AWS.
Later phases: reviews, recommendations, offers, loyalty, PWA, CRM (customer profiles, segments, tickets), dashboards.

## How the shop works (storefront)
- URLs: `/[locale]/...` with locale `mr` (default) | `hi` | `en`. `src/middleware.ts` redirects and keeps `_medusa_locale` in step.
  `[locale]/layout.tsx` is the root layout (sets `<html lang>`). Region is always India (`NEXT_PUBLIC_DEFAULT_REGION=in`).
- UI strings: `src/lib/i18n/dictionaries/{en,hi,mr}.ts` (en defines the type). Server: `getDictionary(locale)`; client: `useI18n()`.
- Catalogue reads: `src/lib/data/catalog.ts`, always passing the locale explicitly (sends `x-medusa-locale`), so pre-built pages are right.
- Filters/sort/search are pure functions in `src/lib/util/catalog.ts` and `search.ts`, applied in memory (catalogue loaded whole, max 500).
- Product pages are pre-built for every language (`generateStaticParams`).
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
- Tests use a fake Razorpay: `backend/integration-tests/fake-razorpay.js` (also run by CI for the browser tests,
  where Playwright replaces Razorpay's checkout.js with a stand-in).

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
- Rate limits for code requests are in memory (one server); move to Redis if scaled out.
- Pincode box only checks the format; real dates and serviceable pincodes come with Shiprocket (Step 5).
- Razorpay is tested only against a fake of its API and a stand-in for its payment window, not the live service.
- Seller details, HSN codes and the GST rules need the client's accountant to confirm before launch (docs/SETUP-PAYMENTS.md).
- Medusa's own tax is 0: prices include GST, and the invoice splits GST out. Change this if B2B (GST credit) sales are added.
- Stock is checked before payment and again when the order is placed; it is not held while the customer pays.
- Footer help/legal entries are plain text until those pages exist (Step 7).
- `next.config.js` image hosts list only localhost and Medusa's demo buckets: add the production image host (S3/CloudFront) at deploy time.
- The Next.js build fetches products from the backend, so CI starts the backend first.
- Docker compose file not tested in the cloud dev box (no Docker daemon there); local Postgres/Redis were used instead.
