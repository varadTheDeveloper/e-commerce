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
Search: Meilisearch (later). Payments: Razorpay + COD. Shipping: Shiprocket. Hosting: AWS.
Prices are INR. Medusa v2 stores amounts in major units (999 = ₹999).

## Phase 1 steps
1. (done) Setup: starters, India/INR seed, strict typecheck, CI, Docker, licence, credits.
2. Catalogue: full redesign, home/category/product, size+colour variants, gallery zoom, size chart, filters, search, mr/hi/en.
3. Account + cart: phone OTP login (needs DLT-registered SMS), addresses, saved cart, wishlist.
4. Checkout: pincode check, Razorpay (verify on server + webhook signature), COD with limits and OTP confirm, stock hold, GST invoice.
5. Orders + shipping: Shiprocket, tracking page, email/SMS updates, cancel before dispatch.
6. Returns + size exchange.
7. Quality: Playwright end-to-end purchase test, phone speed check, security review, legal pages (India E-Commerce Rules 2020: seller details, grievance officer, country of origin, return policy; DPDP Act consent), staging on AWS.
Later phases: reviews, recommendations, offers, loyalty, PWA, CRM (customer profiles, segments, tickets), dashboards.

## Checks before asking to push
```
cd backend;    yarn build; yarn typecheck; yarn test:integration:http   (needs DB_HOST/DB_USERNAME/DB_PASSWORD)
cd storefront; yarn typecheck; yarn build                                (needs the backend running + publishable key)
```
Run `yarn build` in backend before `yarn typecheck`: it generates `.medusa/types`.

## Known limits
- `yarn lint` in storefront is broken upstream (eslint 8 vs Next 15 config); fix during the Step 2 redesign.
- The Next.js build fetches products from the backend, so CI starts the backend first.
- Docker compose file not tested in the cloud dev box (no Docker daemon there); local Postgres/Redis were used instead.
