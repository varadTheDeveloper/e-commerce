import { retrieveCustomer } from "@lib/data/customer"
import { Toaster } from "@medusajs/ui"
import LoginTemplate from "@modules/account/templates/login-template"
import AccountLayout from "@modules/account/templates/account-layout"

// Logged-out visitors see the login form on every /account page;
// logged-in customers see the requested page.
// (Plain layout instead of parallel routes, which fail to build in Next 15.3.)
export default async function AccountPageLayout({ children }: { children: React.ReactNode }) {
  const customer = await retrieveCustomer().catch(() => null)

  return (
    <AccountLayout customer={customer}>
      {customer ? children : <LoginTemplate />}
      <Toaster />
    </AccountLayout>
  )
}

// Personal pages: always rendered per request, never pre-built.
export const dynamic = "force-dynamic"
