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
2. (done) Catalogue: redesign, home/category/collection/product/search pages, size+colour variants, gallery zoom, size chart, filters, sort, mr/hi/en, demo catalogue, unit + browser tests.
3. Account + cart: phone OTP login (needs DLT-registered SMS), addresses, saved cart, wishlist.
4. Checkout: pincode check, Razorpay (verify on server + webhook signature), COD with limits and OTP confirm, stock hold, GST invoice.
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
- Cart, checkout and account pages are still the Medusa starter (English, `@medusajs/ui`); they are redone in Steps 3–4.
  Keep `prefetch={false}` on links to them, or every page downloads their 200 KB of JS.

## Checks before asking to push
```
cd backend;    yarn build; yarn typecheck; yarn test:integration:http   (needs DB_HOST/DB_USERNAME/DB_PASSWORD)
cd storefront; yarn typecheck; yarn lint; yarn test; yarn build         (build needs the backend running + publishable key)
cd storefront; yarn start; yarn test:e2e                                (seeded backend running)
```
Run `yarn build` in backend before `yarn typecheck`: it generates `.medusa/types`.

## Known limits
- Hindi/Marathi wording (UI and demo products) is not reviewed by a native speaker yet.
- Brand name "Vastra", colours, logo, demo pictures and size charts are placeholders.
- Pincode box only checks the format; real dates come with Shiprocket (Step 5).
- Footer help/legal entries are plain text until those pages exist (Step 7).
- `next.config.js` image hosts list only localhost and Medusa's demo buckets: add the production image host (S3/CloudFront) at deploy time.
- The Next.js build fetches products from the backend, so CI starts the backend first.
- Docker compose file not tested in the cloud dev box (no Docker daemon there); local Postgres/Redis were used instead.
