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
    <section className="border-y border-line bg-white">
      <ul className="content-container grid grid-cols-2 gap-y-4 py-5 small:grid-cols-4">
        {items.map(({ icon: Icon, label }) => (
          <li key={label} className="flex items-center gap-2.5 text-[13px] text-muted small:justify-center">
            <Icon size={20} strokeWidth={1.5} className="shrink-0 text-ink" />
            {label}
          </li>
        ))}
      </ul>
    </section>
  )
}
