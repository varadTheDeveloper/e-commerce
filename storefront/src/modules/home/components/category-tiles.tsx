import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Image from "next/image"

export type Tile = { handle: string; name: string; group?: string; image?: string }

/** Round picture tiles, swipeable on phones. */
export default function CategoryTiles({ title, tiles }: { title: string; tiles: Tile[] }) {
  return (
    <section className="content-container py-8">
      <h2 className="mb-4 text-xl font-semibold small:text-2xl">{title}</h2>
      <ul className="no-scrollbar -mx-4 flex scroll-px-4 gap-4 overflow-x-auto px-4 small:mx-0 small:grid small:grid-cols-9 small:px-0">
        {tiles.map((tile) => (
          <li key={tile.handle} className="w-20 shrink-0 small:w-auto">
            <LocalizedClientLink href={`/categories/${tile.handle}`} className="group flex flex-col items-center gap-2 text-center">
              <span className="relative aspect-square w-full overflow-hidden rounded-full bg-surface ring-1 ring-line transition group-hover:ring-2 group-hover:ring-brand-500">
                {tile.image && <Image src={tile.image} alt="" fill sizes="100px" className="scale-125 object-cover object-top" />}
              </span>
              <span className="text-[13px] font-medium leading-tight">
                {tile.group && <span className="block text-[11px] font-normal text-muted">{tile.group}</span>}
                {tile.name}
              </span>
            </LocalizedClientLink>
          </li>
        ))}
      </ul>
    </section>
  )
}
