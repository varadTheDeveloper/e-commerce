# Staff guide: orders, cancellations, returns and exchanges

For the shop's staff. Everything is in the admin panel (`https://<backend>/app`).
Setting up Shiprocket, Razorpay and emails is in the `SETUP-*.md` guides.

## 1. Ship an order

1. **Orders** → open the order → check the items, the address and the payment method
   (cash on delivery or paid online).
2. Pack the parcel.
3. **Create fulfillment** → all items → **Create**. This books Shiprocket: a courier, a pickup and a label.
   If it fails (for example, no courier for that pincode), you see the error and nothing is booked.
4. Print the label in the Shiprocket panel (Orders → the order → Download label) and stick it on the parcel.
5. The rest happens by itself. "Shipped", "Out for delivery" and "Delivered" come from the courier, and the
   customer gets an email (and an SMS once they are switched on) for each one.

## 2. Cancel an order

- **Customers** can cancel themselves from their order page until the parcel is shipped. The courier
  booking is cancelled, online payments are refunded in full, and the stock is put back.
- **Staff**: Orders → the order → cancel the fulfillment first (this cancels the Shiprocket booking), then
  **Cancel order**. Online payments are refunded through Razorpay. *(The staff path uses Medusa's own
  buttons and has not been tested end to end; the customer's button has.)*
- After the parcel is shipped, an order cannot be cancelled. The customer returns it after delivery instead.

## 3. Returns and size exchanges

### The rules

- Customers can ask within **7 days of delivery**, from their order page (My orders → the order →
  **Return or exchange**). The number of days is `returnWindowDays` in `backend/src/config/shop.ts`.
- **Return**: the money comes back. **Exchange**: the same item in another size (same colour), only if that
  size is in stock. Each item can be exchanged once.
- Return pickup is **free** for the customer.
- For "Damaged" or "Wrong item", the customer must add a photo (up to 3).
- Cash-on-delivery customers give a UPI ID or bank account for the refund. Online payments are refunded to
  the card/UPI they paid with.

### What staff do

Open **Returns** in the admin menu. The **To do** tab lists everything waiting for you.

| Status | What it means | What you do |
|---|---|---|
| Needs decision | The customer asked | Read the reason, look at the photos. **Approve** or **Reject** (the customer sees your reason). |
| Waiting for pickup | Approved; Shiprocket pickup booked | Nothing. The courier collects the parcel. If the page shows a pickup error, book the pickup in the Shiprocket panel yourself. |
| On its way back | The courier picked it up | Wait for the parcel. |
| On its way back → parcel arrives | | Check it: unused, tags on, the right item. Then press **Item received and checked**. The item goes back into stock. |
| Send refund | Cash-on-delivery return received | Send the amount shown to the customer's UPI ID or bank account (from the shop's bank app). Then type the payment reference and press **Refund sent**. The customer's account details are then deleted. |
| Refunded | Done | Online payments are refunded automatically through Razorpay when you press "Item received". |
| Received – ship new size | Old size is back | Open the order and use **Create fulfillment** for the new item (already paid for: the customer pays nothing extra). The request completes when the courier picks up the new parcel. |

When you approve an exchange, the new size is set aside for the customer, so it cannot sell out meanwhile.

If the parcel arrives used or damaged by the customer, do **not** press "Item received". Call the customer
first; there is no "refuse after pickup" button yet.

Customers get an email when a request is sent, approved, rejected, received and refunded.

### Items that cannot be returned

To exclude a product (for example, innerwear): **Products** → the product → **Metadata** → add the key
`returnable` with the value `false`. Customers then see "This item cannot be returned." Remove the key to allow
returns again.

## 4. Things to know

- Times in the admin are Indian time.
- Customer photos are kept with the request. Bank and UPI details are deleted once the refund is recorded or
  the request is rejected.
