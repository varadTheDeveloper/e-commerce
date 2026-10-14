import { getPolicy, PolicySlug } from "@lib/legal"
import { Locale } from "@lib/i18n/config"

/** A legal or help page: title, sections, lists ("- " lines). */
export default function PolicyPage({ locale, slug }: { locale: Locale; slug: PolicySlug }) {
  const page = getPolicy(locale, slug)
  return (
    <article className="content-container max-w-3xl py-8 small:py-12" data-testid={`policy-${slug}`}>
      {page.draft && (
        <p className="mb-6 border border-line bg-surface px-4 py-3 text-sm" role="note" data-testid="policy-draft">
          {page.draft}
        </p>
      )}
      <h1 className="heading-lg">{page.title}</h1>
      <p className="mt-2 text-sm text-muted">{page.updated}</p>
      {page.intro && <p className="mt-6 leading-relaxed">{page.intro}</p>}
      {page.sections.map((s) => (
        <section key={s.heading} className="mt-8">
          <h2 className="font-heading text-xl">{s.heading}</h2>
          <Body lines={s.body} />
        </section>
      ))}
    </article>
  )
}

/** Paragraphs, with runs of "- " lines grouped into a list. */
function Body({ lines }: { lines: string[] }) {
  const blocks: (string | string[])[] = []
  for (const line of lines) {
    if (line.startsWith("- ")) {
      const last = blocks[blocks.length - 1]
      if (Array.isArray(last)) last.push(line.slice(2))
      else blocks.push([line.slice(2)])
    } else blocks.push(line)
  }
  return (
    <div className="mt-3 flex flex-col gap-3 text-[15px] leading-relaxed text-ink/85">
      {blocks.map((b, i) =>
        Array.isArray(b) ? (
          <ul key={i} className="list-disc space-y-1.5 pl-5">
            {b.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : (
          <p key={i}>{b}</p>
        )
      )}
    </div>
  )
}
