import { Dictionary } from "@lib/i18n"
import { BadgeIcon, CashIcon, ReturnIcon, ShieldIcon } from "@modules/common/icons/ui"

export default function TrustStrip({ t }: { t: Dictionary }) {
  const items = [
    { icon: BadgeIcon, label: t.home.trustOriginal },
    { icon: ReturnIcon, label: t.home.trustReturns },
    { icon: CashIcon, label: t.home.trustCod },
    { icon: ShieldIcon, label: t.home.trustSecure },
  ]
  return (
    <section className="content-container pt-6">
      <ul className="grid grid-cols-2 gap-3 rounded-xl bg-surface p-4 small:grid-cols-4">
        {items.map(({ icon: Icon, label }) => (
          <li key={label} className="flex items-center gap-2.5 text-[13px] font-medium small:justify-center small:text-sm">
            <Icon size={22} className="shrink-0 text-brand-600" />
            {label}
          </li>
        ))}
      </ul>
    </section>
  )
}
