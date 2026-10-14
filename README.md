# Clothing store

An online clothing store for India, in Marathi, Hindi and English. Open source under the GPL-3.0 (see `LICENSE`).
The brand name is a placeholder until the client confirms it.

```
backend/      Medusa v2 server + admin panel (TypeScript, Postgres, Redis)   http://localhost:9000  (admin: /app)
storefront/   Next.js shop                                                   http://localhost:8000
```

Both started from Medusa's MIT-licensed starters; see `CREDITS.md`.

Shop addresses carry the language: `/mr/...` (Marathi, default), `/hi/...`, `/en/...`.
Visitors without one are sent to their saved or browser language, else Marathi.

## Run it locally

Needs Node 20+ (22 recommended), Docker, and Yarn (`corepack enable` once).

```
docker compose up -d                        # Postgres 16 + Redis 7

cd backend
copy .env.template .env                     # Windows (macOS/Linux: cp)
yarn install
npx medusa db:migrate
yarn seed                                   # demo catalogue: 12 clothes, India region, ₹ prices, mr/hi/en text
npx medusa user -e you@example.com -p <password>   # first admin user
yarn dev                                    # http://localhost:9000/app

cd ../storefront
copy .env.template .env.local
# Put the publishable key in NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY:
#   admin panel -> Settings -> Publishable API Keys
yarn install
yarn dev                                    # http://localhost:8000
```

## Checks (also run on GitHub for every push and pull request)

```
cd backend;    yarn build; yarn typecheck; yarn test:unit; yarn test:integration:http
cd storefront; yarn typecheck; yarn lint; yarn test; yarn build   # build needs the backend running
cd storefront; yarn start; yarn test:e2e     # browser tests (desktop + phone); backend seeded, with OTP_TEST_CODE=123456
                                             # and the fake Razorpay (see "Checkout and payments")
```

Browser tests need Chromium once: `npx playwright install chromium`.

The backend tests create and drop their own database. They read `DB_HOST`, `DB_USERNAME` and `DB_PASSWORD`.

## Where things are

| What | Where |
|---|---|
| Brand name, policies shown on the site | `storefront/src/config/brand.ts` |
| Delivery charge, free-delivery amount, COD limit | `backend/src/config/shop.ts` |
| Seller details on GST invoices, pickup address for couriers | `backend/src/config/seller.ts` |
| Texts of order emails and SMS (mr/hi/en) | `backend/src/notifications/messages.ts` |
| Brand colours | `storefront/tailwind.config.js` (`brand`, `accent`, …) |
| Shop texts in mr / hi / en | `storefront/src/lib/i18n/dictionaries/` |
| Colour names and swatches | `storefront/src/lib/i18n/colours.ts` |
| Size charts | `storefront/src/lib/size-charts.ts` |
| Demo products (with Hindi/Marathi text) | `backend/src/scripts/data/catalogue.ts` |
| Demo photos (Unsplash links + photographer credits) | `backend/src/scripts/data/demo-photos.json`, banners in `storefront/src/config/banners.ts` |

Product, category and collection text in Hindi and Marathi is stored with Medusa's translation module
(editable in the admin panel). Colour and size values stay in English as keys.

Demo photos are free Unsplash photos, loaded from Unsplash's servers (their rules), and credited on `/credits`.
They are stand-ins: before launch every product must show the brand's own photos. Each picture is matched
to a colour by its `colour` metadata, or by attaching it to that colour's variants in the admin panel.

## Customer login (phone codes)

Customers log in with their mobile number and a 6-digit SMS code; staff log in to the admin
with email and password. For development, `backend/.env` has `SMS_PROVIDER=console`: no SMS
is sent and the code is printed in the backend log. Set `OTP_TEST_CODE=123456` to make every
code 123456 (tests use this; it is ignored in production). Real SMS: Message Central
(no DLT paperwork; `SMS_PROVIDER=messagecentral`) or your own DLT registration + MSG91
(`SMS_PROVIDER=msg91`). Steps for both: `docs/SETUP-SMS.md`.

## Checkout and payments

Customers log in (phone code), choose a saved address or add one, and pay online with Razorpay
or by cash on delivery (orders up to ₹5,000, confirmed by SMS code). Delivery is ₹79, free from ₹999.
After the order they can download a GST invoice (PDF). Shop rules: `backend/src/config/shop.ts`;
seller details for invoices: `backend/src/config/seller.ts` (placeholders). Setup steps for
Razorpay, the webhook and GST: `docs/SETUP-PAYMENTS.md`.

To try online payment without Razorpay keys, run the fake Razorpay and start the backend with test keys:

```
cd backend
node integration-tests/fake-razorpay.js     # http://127.0.0.1:9911
# in backend/.env: RAZORPAY_KEY_ID=rzp_test_fake  RAZORPAY_KEY_SECRET=fake-secret  RAZORPAY_API_BASE=http://127.0.0.1:9911
```

(The real Razorpay payment window will not open with these keys; the browser tests replace it.)

## Delivery and order updates

Staff ship an order from the admin panel (**Create fulfillment**): this books the courier with Shiprocket.
Customers see the delivery date for their pincode, follow the parcel on their order page, can cancel until it is
shipped, and get emails/SMS at each step. Setup: `docs/SETUP-SHIPPING.md`. For local testing without Shiprocket:
`node integration-tests/fake-shiprocket.js` (port 9912) and, in `backend/.env`,
`SHIPROCKET_EMAIL=api@example.com SHIPROCKET_PASSWORD=fake-password SHIPROCKET_API_BASE=http://127.0.0.1:9912`.
With the fake, pincodes starting with 9 are not served and those starting with 8 have no cash on delivery.

## Returns and size exchange

Within 7 days of delivery, customers ask for a return or another size from their order page. Staff decide in the
admin panel (**Returns**); approving books a free courier pickup. Online payments are refunded through Razorpay when
the item comes back; cash-on-delivery refunds are sent by staff to the customer's UPI ID or bank account. How staff
handle orders, cancellations and returns: `docs/STAFF-GUIDE.md`.

## Legal pages and privacy

About, contact, shipping, returns, privacy, terms, grievance officer and FAQ pages in mr/hi/en. The seller details
in `storefront/src/config/seller.ts` are placeholders, and the pages show a "draft" notice until a lawyer has checked
them. Customers agree to the privacy policy when they sign up, and can delete their account from their profile
(orders are kept for tax records).

## Quality

Phone speed, accessibility and security checks, with results and what is left: `docs/QUALITY.md`.
The browser tests include an accessibility check (axe), a keyboard-only purchase, a speed budget and one full
"golden path" from search to refund.

## Server (test copy on AWS)

One small EC2 server runs everything in Docker: Caddy (HTTPS), the website, Medusa, Postgres and Redis. GitHub
Actions builds the images, and the website sits behind a demo password. Step by step: `docs/EC2-SETUP.md`.

## Secrets

Keys live only in `.env` / `.env.local` files (git-ignored) and in AWS Secrets Manager in production.
In production the server refuses to start without real `JWT_SECRET`, `COOKIE_SECRET`, `OTP_SECRET`, `REDIS_URL`,
the `RAZORPAY_*` and `SHIPROCKET_*` values and the email settings, or with the console SMS provider or a
test-only API address.
