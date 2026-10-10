import { retrieveCustomer } from "@lib/data/customer"
import AccountNav from "@modules/account/components/account-nav"
import PhoneLogin from "@modules/account/components/phone-login"

// Logged-out visitors see the phone login on every /account page;
// logged-in customers see the requested page.
export default async function AccountPageLayout({ children }: { children: React.ReactNode }) {
  const customer = await retrieveCustomer().catch(() => null)

  if (!customer) {
    return (
      <div className="content-container">
        <PhoneLogin />
      </div>
    )
  }

  return (
    <div className="content-container py-6 small:grid small:grid-cols-[200px_1fr] small:gap-12 small:py-12" data-testid="account-page">
      <AccountNav />
      <div>{children}</div>
    </div>
  )
}

// Personal pages: always rendered per request, never pre-built.
export const dynamic = "force-dynamic"
