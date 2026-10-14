import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { WISHLIST_MODULE } from "../modules/wishlist"
import { RETURNS_MODULE } from "../modules/returns"

// "Delete my account" (DPDP Act: right to erasure). Personal details are
// removed at once; orders and invoices stay, because GST law requires the
// shop to keep tax records. Those keep the delivery name, phone and address
// printed on them, as the privacy policy says.

/** Return requests still being handled */
const OPEN_RETURN_STATUSES = ["requested", "approved", "picked_up", "received", "refund_due"]

/** Orders not yet delivered (and not cancelled), and open returns, of a customer. */
export async function openBusiness(scope: MedusaContainer, customerId: string) {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: orders } = await query.graph({
    entity: "order",
    fields: ["id", "status", "fulfillments.delivered_at", "fulfillments.canceled_at"],
    filters: { customer_id: customerId },
  })
  const undelivered = (orders as any[]).filter(
    (o) => o.status !== "canceled" && !(o.fulfillments ?? []).some((f: any) => f.delivered_at && !f.canceled_at)
  )
  const returns = scope.resolve(RETURNS_MODULE) as any
  const openReturns = await returns.listReturnRequests({ customer_id: customerId, status: OPEN_RETURN_STATUSES })
  return { orders: undelivered.length, returns: openReturns.length }
}

/** Removes the customer's personal details, addresses, wishlist and login. */
export async function deleteAccount(scope: MedusaContainer, customerId: string, authIdentityId: string) {
  const customers = scope.resolve(Modules.CUSTOMER)
  const customer = await customers.retrieveCustomer(customerId, { relations: ["addresses"] })
  if (customer.addresses?.length) {
    await customers.deleteCustomerAddresses(customer.addresses.map((a) => a.id))
  }
  await customers.updateCustomers(customerId, {
    first_name: "Deleted",
    last_name: "account",
    phone: null,
    email: null,
    company_name: null,
    // Only the fact and time of deletion stay
    metadata: { privacy_consent: "", deleted_at: new Date().toISOString() },
  })

  const wishlist = scope.resolve(WISHLIST_MODULE) as any
  const saved = await wishlist.listWishlistItems({ customer_id: customerId }, { select: ["id"] })
  if (saved.length) await wishlist.deleteWishlistItems(saved.map((i: any) => i.id))

  // The phone number can no longer log in to this account (a new sign-up starts fresh)
  const auth = scope.resolve(Modules.AUTH)
  await auth.deleteAuthIdentities([authIdentityId])
}
