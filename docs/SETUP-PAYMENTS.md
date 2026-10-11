# Setting up payments, delivery charges and GST invoices

The shop takes two kinds of payment:

- **Online (Razorpay):** UPI, cards, net banking and wallets.
- **Cash on delivery (COD):** for orders up to a limit. The customer confirms the order with a
  6-digit SMS code, unless they logged in by SMS in the last 10 minutes.

Until the Razorpay keys are on the server, online payment shows "not available" and only
cash on delivery works.

## Shop rules (one file)

`backend/src/config/shop.ts`:

| Setting | Now | Meaning |
|---|---|---|
| `freeShippingFrom` | 999 | Delivery is free when the items total ₹999 or more |
| `shippingFee` | 79 | Delivery charge below that |
| `codMaxOrder` | 5000 | Cash on delivery only up to this order total (delivery included) |

The website's top banner reads the free-delivery amount from `storefront/src/config/brand.ts`
(`freeDeliveryFrom`). A test checks that the two numbers match.

The delivery price itself lives in the database (created by the seed). After launch, change it in the
admin panel (Settings → Locations & Shipping → Standard delivery) **and** in `shop.ts`.

## Razorpay

### Step 1: Sign up (the client, in the business's name)
1. Sign up at razorpay.com with the business email and mobile number.
2. Complete KYC: PAN, address proof, bank account in the business or owner's name, GST certificate
   (or another business proof), website link and a short description.
3. Razorpay checks the website before turning on live payments. The shop must show contact details,
   terms, privacy policy, refund/return policy and shipping policy pages (planned in Step 7).

### Step 2: Test keys (available right after sign-up, before KYC)
1. Dashboard → switch to **Test mode** → Account & Settings → **API keys** → Generate key.
2. Copy the **Key ID** (starts with `rzp_test_`) and the **Key Secret**. The secret is shown once.

### Step 3: Webhook
The webhook places the order even if the customer closes the page right after paying.
1. Dashboard → Account & Settings → **Webhooks** → Add new webhook.
2. URL: `https://<backend address>/hooks/payment/razorpay_razorpay`
3. Secret: a long random value (for example from `openssl rand -hex 32`). Write it down.
4. Active event: **payment.authorized** (others are ignored).

Do this once in Test mode and once in Live mode (each has its own keys and webhook).

### Step 4: Put the settings on the server (never in GitHub, never in chat)
In the backend's `.env` on the server, or AWS Secrets Manager:

```
RAZORPAY_KEY_ID=<Key ID>
RAZORPAY_KEY_SECRET=<Key Secret>
RAZORPAY_WEBHOOK_SECRET=<the webhook secret from step 3>
```

Leave `RAZORPAY_API_BASE` empty (it is for automated tests only; production refuses to start with it).
In production the server refuses to start without the three values above.

### Step 5: Test
With test keys, place an order and pay with one of Razorpay's
[test cards or UPI IDs](https://razorpay.com/docs/payments/payments/test-card-details/).
The order should appear in the admin panel as **captured**.

### How the money flow works (for the developer)
- When the customer clicks "Pay", the server creates a Razorpay order for the exact cart total, set to
  **manual capture**.
- After payment, the server asks Razorpay which payments the order has. It never trusts what the
  browser says. The server then places the order and reserves the stock, and only then captures
  (takes) the money.
- If placing the order fails (for example, the last piece sold meanwhile), the money is not
  captured. Razorpay returns uncaptured payments to the customer automatically.
- Refunds made in the admin panel are sent to Razorpay.

## Cash on delivery
- No setup needed beyond SMS (see `docs/SETUP-SMS.md`). Without real SMS, codes appear only in the
  server log (development).
- The courier collects the money. When it reaches the business, mark the payment as **captured**
  in the admin panel (Orders → the order → Payment).
- A COD refund (for a return) is paid by bank transfer or UPI and recorded in the admin panel.

## GST invoices

Customers download a PDF tax invoice from their order page ("Download invoice").

**Before launch, the client and their accountant must give:**
1. Legal name, address, GSTIN and state for `backend/src/config/seller.ts` (now placeholders).
2. A confirmation of the HSN code for each product (`hsn` in the product's metadata; the demo products
   have common codes such as 6109 for T-shirts and 6211 for kurtas). Products without one use 6211.
3. A check of the GST rules the shop uses (`backend/src/lib/gst.ts`):
   - Clothing at **5%** when one piece costs up to ₹2,500 before tax, **18%** above that
     (rates from 22 September 2025).
   - Prices on the site include GST.
   - Delivery charges are taxed at the highest rate in the order.
   - CGST + SGST for buyers in the seller's state, IGST for other states.
   - Invoice numbers look like `VS/2026-27/000123` (prefix / financial year / order number).

The shop does not file GST returns; the accountant does that from the orders.
