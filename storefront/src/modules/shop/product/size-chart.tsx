"use client"

import { useI18n } from "@lib/i18n/provider"
import { SIZE_CHARTS } from "@lib/size-charts"
import { CloseIcon, RulerIcon } from "@modules/common/icons/ui"
import { useEffect, useState } from "react"

export default function SizeChartButton({ chartKey }: { chartKey?: string }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const chart = chartKey ? SIZE_CHARTS[chartKey] : undefined

  useEffect(() => {
    if (!open) return
    document.body.style.overflow = "hidden"
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
    window.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = ""
      window.removeEventListener("keydown", onKey)
    }
  }, [open])

  if (!chart) return null
  const isKids = chartKey === "kids"

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-sm underline underline-offset-4 hover:opacity-70"
        data-testid="size-chart-button"
      >
        <RulerIcon size={18} strokeWidth={1.5} />
        {t.product.sizeChart}
      </button>
      {open && (
        <div className="fixed inset-0 z-[110] flex items-end justify-center small:items-center" role="dialog" aria-modal="true" aria-labelledby="size-chart-title">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="relative max-h-[85vh] w-full overflow-y-auto bg-white p-6 small:max-w-lg">
            <div className="mb-3 flex items-center justify-between">
              <h2 id="size-chart-title" className="font-heading text-xl">
                {t.sizeChart.title}
              </h2>
              <button type="button" onClick={() => setOpen(false)} className="flex h-10 w-10 items-center justify-center" aria-label={t.common.close}>
                <CloseIcon />
              </button>
            </div>
            <p className="mb-3 text-sm text-muted">{t.sizeChart.measure}</p>
            <table className="w-full text-center text-sm" data-testid="size-chart-table">
              <thead>
                <tr className="bg-surface">
                  <th className="px-2 py-2.5 font-medium">{isKids ? t.sizeChart.age : t.sizeChart.size}</th>
                  {chart.columns.map((c) => (
                    <th key={c} className="px-2 py-2.5 font-semibold">
                      {t.sizeChart[c]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {chart.rows.map((row) => (
                  <tr key={row.size} className="border-b border-line">
                    <td className="px-2 py-2.5 font-medium">{row.size}</td>
                    {row.values.map((v, i) => (
                      <td key={i} className="px-2 py-2.5">
                        {v}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-4 bg-surface p-4 text-sm">
              <p className="mb-1.5 font-medium">{t.sizeChart.howToMeasure}</p>
              <ul className="list-disc space-y-1 pl-5 text-muted">
                <li>{t.sizeChart.tipChest}</li>
                <li>{t.sizeChart.tipWaist}</li>
                <li>{t.sizeChart.tipBetween}</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
