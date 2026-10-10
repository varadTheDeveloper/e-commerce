import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Image from "next/image"

export type Tile = { handle: string; name: string; group?: string; image?: string }

/** Photo tiles, swipeable on phones. */
export default function CategoryTiles({ title, tiles }: { title: string; tiles: Tile[] }) {
  return (
    <section className="content-container py-10 small:py-14">
      <h2 className="heading-lg mb-6">{title}</h2>
      <ul className="no-scrollbar -mx-4 flex scroll-px-4 snap-x gap-2 overflow-x-auto px-4 small:mx-0 small:gap-4 small:px-0">
        {tiles.map((tile) => (
          <li key={tile.handle} className="w-[38%] shrink-0 snap-start small:w-[calc(20%-13px)]">
            <LocalizedClientLink href={`/categories/${tile.handle}`} className="group block">
              <span className="relative block aspect-[3/4] overflow-hidden bg-surface">
                {tile.image && (
                  <Image src={tile.image} alt="" fill sizes="(max-width: 1024px) 40vw, 20vw" className="object-cover transition-transform duration-700 group-hover:scale-105" />
                )}
              </span>
              <span className="mt-2.5 block">
                {tile.group && <span className="eyebrow block text-[10px]">{tile.group}</span>}
                <span className="text-[15px]">{tile.name}</span>
              </span>
            </LocalizedClientLink>
          </li>
        ))}
      </ul>
    </section>
  )
}
