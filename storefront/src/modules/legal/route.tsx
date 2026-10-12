import { toLocale } from "@lib/i18n/config"
import { getPolicy, PolicySlug } from "@lib/legal"
import { Metadata } from "next"
import PolicyPage from "./policy-page"

// Shared by the legal/help page routes (one small file per URL).

export type PolicyProps = { params: Promise<{ locale: string }> }

export async function policyMetadata(props: PolicyProps, slug: PolicySlug): Promise<Metadata> {
  const page = getPolicy(toLocale((await props.params).locale), slug)
  return { title: page.title, description: page.description }
}

export async function renderPolicy(props: PolicyProps, slug: PolicySlug) {
  return <PolicyPage locale={toLocale((await props.params).locale)} slug={slug} />
}
