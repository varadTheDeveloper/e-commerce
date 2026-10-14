# Quality checks: speed, accessibility, security

Results of Step 7b (12 October 2026), on a local production build with the demo catalogue.
Repeat these checks before launch and after big changes.

## 1. Speed on phones

**How measured:** Lighthouse 13.5, mobile, slow 4G and a 4× slower CPU.

**Before:** main content appeared after 4.3–5.7 s. Every page first downloaded 10 font files (~415 KB),
because the fonts were "preloaded".

**Fixed:**
- Fonts are no longer preloaded. Each page now fetches only the weights and scripts it uses.
  English pages skip the Devanagari files.
- The heavy bold weight (700) is no longer loaded; the one place that used it now uses semibold.
- Product pages no longer download the computer-only pictures on phones.

**After (real throttling):**

| Page | Main content appears | Score |
|---|---|---|
| Home (mr) | 1.8 s | 87 |
| Listing (mr) | 1.6 s | 91 |
| Home (en) | 1.6 s | 95 |

- Product page (simulated): 2.0–2.4 s, score 97–99.
- Layout shift: none (CLS ≤ 0.03) on every page.

**Guard:** `storefront/e2e/speed.spec.ts` fails if fonts are preloaded again, or if a first visit
downloads more than 180 KB of scripts or 300 KB of fonts. Today it is about 120 KB and 250 KB.

**Still to watch:**
- Marathi and Hindi pages need about 250 KB of Devanagari fonts (3 files).
- Lighthouse's simulated mode is pessimistic about this. Phones show their own Devanagari font
  until ours arrive.
- Real product photos must be sized like the demo ones.

## 2. Accessibility (WCAG 2.1 AA)

**Tested:**
- axe-core checks on home, listing, product, search, bag, login, checkout, account pages and legal pages,
  on desktop and phone sizes (`e2e/a11y.spec.ts`).
- A keyboard-only purchase: colour, size, bag, login, address, cash on delivery, order placed.
- Lighthouse accessibility score: 100 on every page measured.

**Fixed:**
- The bag's product picture was a second, unnamed link to the product. It is now hidden from
  screen readers and the keyboard; the product name link remains.
- The checkout's "←" back link had no name on phones.

**Not tested:**
- With a real screen reader (TalkBack or NVDA).
- Zoom to 200%.
- The admin panel (Medusa's own).

## 3. Security review

### Dependencies (`yarn npm audit`)

**Fixed:**
- **Next.js 15.3.9 → 16.3.8.**
  - 15.3.9 had a critical remote-code-execution hole in the image optimiser, which the shop uses for every photo.
    The fix exists only in 15.5.24 and later.
  - 15.5 had another problem (Next.js issues vercel/next.js#86055 and #98303): after some server actions, such as
    changing the bag or sending a return, the page sometimes never updated and buttons stayed on "Sending…".
    Measured: 4 failures in 40 runs on 15.5.24 and on 15.5.27; 0 in 40 on 15.3.9 and on 16.3.8.
  - Moving to 16 meant:
    - `revalidateTag` → `updateTag` in server actions
    - `middleware.ts` → `proxy.ts`
    - ESLint 9 (`next lint` was removed)
    - fixing 4 new React lint findings
  - Two unused loading screens left over from the starter template were removed.
- Patched versions of packages that run on the live backend:
  - proxy-addr, jws, compression, protobufjs, path-to-regexp, fast-xml-builder
  - tar and axios, used by tools and tests
- vitest 3.2.7, lodash 4.18 and ESLint 9 in the storefront.

**Left:**
- Advisories in build and test tools only (vite, jest, vitest/tinypool, eslint, postcss, node-gyp).
  They don't run on the live servers, and their attacks need hostile input fed into a build.
- Medusa 2.21.2 is the newest stable release; update when 2.22 is out.

### Secrets

- The whole git history was searched for keys (Razorpay, AWS, Resend, GitHub, JWTs, private keys,
  the Unsplash key). None found.
- No `.env` file is tracked.
- Example files hold only placeholders such as `supersecret`, which production refuses.

### Customer API routes

Every custom route was checked for login and ownership:
- Orders, tracking, invoice, cancel and returns: the order must belong to the logged-in customer.
  Otherwise the answer is 404.
- Cash-on-delivery routes: the cart must belong to the customer and not be completed. The session
  is HMAC-signed.
- Return photos: images only (checked by file bytes, not name), 5 MB maximum, stored under the
  customer's own folder. A request can attach only the customer's own photos.
- Webhooks compare their secret in constant time:
  - Razorpay: HMAC signature
  - delivery updates: token in `x-api-key`
- Admin routes `/admin/*` need a staff login (Medusa).
- Emails escape everything customers can type. The website and admin show it as text, never as HTML.

### Fixed in this review

- **Security headers on the website:**
  - X-Frame-Options DENY and CSP `frame-ancestors 'none'` (no clickjacking)
  - `object-src 'none'` and `base-uri 'self'`
  - nosniff
  - Referrer-Policy
  - Permissions-Policy (no camera, microphone or location; payment only for Razorpay)
  - HSTS
  - The "X-Powered-By" banner is removed.
- **Return photo uploads:** at most 20 per customer per hour. Before, one account could fill the storage.
- **Staff login:** after 10 wrong passwords for one email from one address in 15 minutes, login waits.
  Only failures count.

### Deployment (Step 7c, `docs/EC2-SETUP.md`)

- **Client addresses behind a proxy: done.**
  - Medusa trusts one proxy hop (Caddy).
  - The website passes the visitor's address on for login codes and pincode checks.
  - Caddy overwrites any address a visitor sends.
  - Without this, every customer would have shared one limit of 10 login codes per 15 minutes.
- **Image hosts: done.** They're set at build time; localhost and Medusa's demo buckets are gone on the server.
- **Admin over HTTPS only, with `X-Frame-Options`: done** (Caddy).
- **Test copy behind a demo password: done** (Caddy).
- **Backups: done.** Nightly `pg_dump`, 14 kept, with an optional S3 copy.
- **Still to do:**
  - A private bucket with short links for return photos.
  - Admin access limited to the office IP.
  - Secrets in AWS Secrets Manager (today: chmod 600 files, as for Lexauraa).

### Known limits

- No full Content-Security-Policy for scripts yet. Next.js needs inline scripts, and Razorpay loads
  its own. Adding nonces is possible later.
- Rate-limit counters are in memory (one server). Move them to Redis if the backend runs on several machines.
- No penetration test by an outside team, and no check against the live Razorpay, Shiprocket or SMS services.
