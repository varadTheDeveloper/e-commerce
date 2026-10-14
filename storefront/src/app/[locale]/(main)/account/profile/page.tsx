import { retrieveCustomer } from "@lib/data/customer"
import { getDictionary } from "@lib/i18n"
import DeleteAccount from "@modules/account/components/delete-account"
import ProfileForm from "@modules/account/components/profile-form"
import { Metadata } from "next"
import { notFound } from "next/navigation"

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata(props: Props): Promise<Metadata> {
  const t = getDictionary((await props.params).locale)
  return { title: t.account.profile, robots: { index: false } }
}

export default async function Profile() {
  const customer = await retrieveCustomer()
  if (!customer) notFound()
  return (
    <>
      <ProfileForm customer={customer} />
      <DeleteAccount />
    </>
  )
}

export const dynamic = "force-dynamic"
