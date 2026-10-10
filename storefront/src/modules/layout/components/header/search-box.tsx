import { Dictionary } from "@lib/i18n"
import { SearchIcon } from "@modules/common/icons/ui"

/** Plain form: works before JavaScript loads. Results page: /{locale}/search?q=… */
export default function SearchBox({
  locale,
  t,
  id,
  defaultValue = "",
  className = "",
}: {
  locale: string
  t: Dictionary
  id: string
  defaultValue?: string
  className?: string
}) {
  return (
    <form action={`/${locale}/search`} role="search" className={`relative ${className}`}>
      <label htmlFor={id} className="sr-only">
        {t.common.search}
      </label>
      <SearchIcon size={20} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
      <input
        id={id}
        type="search"
        name="q"
        defaultValue={defaultValue}
        placeholder={t.common.searchPlaceholder}
        enterKeyHint="search"
        autoComplete="off"
        className="h-11 w-full rounded-lg border border-transparent bg-surface pl-10 pr-4 text-[15px] text-ink placeholder:text-muted focus:border-brand-500 focus:bg-white focus:outline-none"
        data-testid="search-input"
      />
    </form>
  )
}
