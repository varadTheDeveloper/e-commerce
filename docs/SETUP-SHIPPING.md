# Setting up delivery, tracking and order updates

The shop books parcels with **Shiprocket**, follows them with Shiprocket's tracking updates,
and tells customers by **email (Resend)** and **SMS (Message Central)** when an order is placed,
shipped, delivered or cancelled.

Until these are set up:
- Every valid pincode is accepted, with no delivery date.
- Staff cannot book couriers.
- Emails are only written to the server log.
- No update SMS are sent.

## How staff ship an order

1. Pack the parcel.
2. In the admin panel: **Orders** → the order → **Create fulfillment** (all items) → Create.
   - This books the parcel with Shiprocket, assigns the recommended courier, requests a pickup and
     makes the label.
   - Cash-on-delivery orders are booked as COD, so the courier collects the money.
3. Print the label from the Shiprocket panel (Orders → the order → Download label) and stick it on
   the parcel.
4. Everything after that happens by itself:
   - "Shipped" when the courier picks the parcel up, then "Out for delivery" and "Delivered".
   - The customer gets an email and SMS for each of these.
   - On delivery, a COD payment is marked as collected.

If the booking fails (for example, no courier for that pincode), the admin shows the error and nothing
is booked.

**Customers can cancel** from their order page until the parcel is shipped. The courier booking is
cancelled, online payments are refunded in full through Razorpay, and the stock is put back.

## Shiprocket

### Step 1: Account and pickup address (the client)
1. Sign up at shiprocket.in with the business details and complete KYC.
2. **Settings → Pickup addresses:** add the warehouse/shop address.
3. Write the pickup address's **name** (Shiprocket calls it the "pickup location", e.g. "Primary")
   and its **pincode** into `backend/src/config/seller.ts` (`pickupLocation`, `pickupPincode`).
4. Recharge the Shiprocket wallet (courier charges are paid from it).

### Step 2: API user
1. **Settings → API → Configure → Create an API user.** Use a different email from the main login.
   Shiprocket emails the password.
2. These are the `SHIPROCKET_EMAIL` and `SHIPROCKET_PASSWORD` below.

### Step 3: Tracking webhook
1. **Settings → API → Webhooks.**
2. URL: `https://<backend address>/hooks/delivery-updates`. Shiprocket does not accept addresses
   containing words like "shiprocket", which is why it has this name.
3. Token: a long random value (for example from `openssl rand -hex 32`). This is
   `SHIPROCKET_WEBHOOK_TOKEN`.
4. Turn it on.

Not tested yet: the real Shiprocket service. The shop was built from Shiprocket's API documentation
and tested against a fake copy. The webhook accepts `awb` and `current_status`. After the first real
parcel, check the backend log for "Delivery update ignored" lines. They show any status text the
shop does not know yet.

### Package size
Products are sent with their weight (grams, from the product). Pieces without a weight count as
300 g. Every parcel is at least 0.5 kg and 30 × 25 × 5 cm. Change these in
`backend/src/config/shop.ts` (`defaultPackage`, `defaultItemGrams`). A product's weight can be
changed in the admin panel.

## Emails (Resend)

1. In Resend: **Domains → Add domain** (e.g. `brand.in`). Add the DNS records it shows at the domain
   provider, then wait for "Verified".
2. **API keys → Create** (permission: sending access).
3. Choose the sender, e.g. `Vastra <orders@brand.in>` (the domain must be the verified one).

Customers only get emails if they gave an email address. The phone number is the login, and email
is optional. The shop also emails itself (`ORDER_ALERT_EMAIL`) for every new order.

## Update SMS (Message Central "MessageNow")

Login codes need no DLT registration. **Order-update SMS do:**
- the business's DLT registration (PE/entity ID)
- a sender ID
- each message text approved as a template

Message Central can help with the DLT steps.

Register these 12 templates **exactly as written**, as "Service Implicit" or "Transactional".
`{#var#}` is a value the shop fills in: the shop name, the order number, the amount, a link.

| Key | Template |
|---|---|
| `placed.en` | Your {#var#} order {#var#} of Rs.{#var#} is placed. Details: {#var#} |
| `shipped.en` | Your {#var#} order {#var#} is shipped. Track: {#var#} |
| `delivered.en` | Your {#var#} order {#var#} is delivered. Thank you for shopping with us. |
| `canceled.en` | Your {#var#} order {#var#} is cancelled. Details: {#var#} |
| `placed.hi` | आपका {#var#} ऑर्डर {#var#} (Rs.{#var#}) हो गया है। विवरण: {#var#} |
| `shipped.hi` | आपका {#var#} ऑर्डर {#var#} भेज दिया गया है। ट्रैक करें: {#var#} |
| `delivered.hi` | आपका {#var#} ऑर्डर {#var#} डिलीवर हो गया है। धन्यवाद। |
| `canceled.hi` | आपका {#var#} ऑर्डर {#var#} रद्द हो गया है। विवरण: {#var#} |
| `placed.mr` | तुमची {#var#} ऑर्डर {#var#} (Rs.{#var#}) नोंदवली आहे. तपशील: {#var#} |
| `shipped.mr` | तुमची {#var#} ऑर्डर {#var#} पाठवली आहे. ट्रॅक करा: {#var#} |
| `delivered.mr` | तुमची {#var#} ऑर्डर {#var#} डिलिव्हर झाली आहे. धन्यवाद. |
| `canceled.mr` | तुमची {#var#} ऑर्डर {#var#} रद्द झाली आहे. तपशील: {#var#} |

The texts live in `backend/src/notifications/messages.ts`; the table above must stay the same as that
file. If DLT asks for the brand name written out instead of the first `{#var#}`, change it in both
places. A native speaker should check the Hindi and Marathi before you register them.

You can switch on SMS for some templates first: the shop only texts for templates whose ID is set.

## Settings on the server (never in GitHub, never in chat)

In the backend's `.env` on the server, or AWS Secrets Manager:

```
SHIPROCKET_EMAIL=<API user email>
SHIPROCKET_PASSWORD=<API user password>
SHIPROCKET_WEBHOOK_TOKEN=<token from Shiprocket step 3>

RESEND_API_KEY=<Resend API key>
EMAIL_FROM=Vastra <orders@brand.in>
ORDER_ALERT_EMAIL=<the shop's inbox>
STOREFRONT_URL=https://www.brand.in

# Only when the DLT templates are approved:
SMS_ORDER_UPDATES=true
MESSAGECENTRAL_SENDER_ID=<6-letter sender ID>
MESSAGECENTRAL_ENTITY_ID=<DLT entity / PE ID>
SMS_TEMPLATE_IDS={"placed.mr":"<template id>","placed.hi":"...","placed.en":"...", ...}
```

Update SMS use the same Message Central account as login codes (`SMS_PROVIDER=messagecentral`,
see `docs/SETUP-SMS.md`). Leave `SHIPROCKET_API_BASE` and `RESEND_API_BASE` empty: they are for
automated tests only.

In production the server refuses to start in either of these cases:
- the Shiprocket, Resend or `STOREFRONT_URL` settings are missing
- a test-only address is set
