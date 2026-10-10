import { retrieveCustomer } from "@lib/data/customer"
import { getDictionary } from "@lib/i18n"
import AddressBook from "@modules/account/components/address-book"
import { Metadata } from "next"
import { notFound } from "next/navigation"

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata(props: Props): Promise<Metadata> {
  const t = getDictionary((await props.params).locale)
  return { title: t.account.addresses, robots: { index: false } }
}

export default async function Addresses() {
  const customer = await retrieveCustomer()
  if (!customer) notFound()
  return <AddressBook customer={customer} />
}

export const dynamic = "force-dynamic"
