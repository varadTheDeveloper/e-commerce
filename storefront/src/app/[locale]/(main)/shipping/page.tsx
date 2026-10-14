import { policyMetadata, PolicyProps, renderPolicy } from "@modules/legal/route"

export const generateMetadata = (props: PolicyProps) => policyMetadata(props, "shipping")
export default function Page(props: PolicyProps) {
  return renderPolicy(props, "shipping")
}
