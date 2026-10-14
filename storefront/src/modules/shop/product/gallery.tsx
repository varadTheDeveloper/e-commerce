"use client"

import { format } from "@lib/i18n"
import { useI18n } from "@lib/i18n/provider"
import { CloseIcon } from "@modules/common/icons/ui"
import Image from "next/image"
import { useEffect, useRef, useState } from "react"

/**
 * Phones: swipe through full-width pictures with dots.
 * Computers: all pictures in a two-column grid, zoom on hover.
 * Tap/click opens a full-screen view.
 */
export default function Gallery({ images, alt }: { images: string[]; alt: string }) {
  const { t } = useI18n()
  const [active, setActive] = useState(0)
  const [zoomOpen, setZoomOpen] = useState(false)
  const [origin, setOrigin] = useState<{ i: number; at: string } | null>(null)
  const track = useRef<HTMLDivElement>(null)

  // New colour = new picture set: start from the first one
  const [lastImages, setLastImages] = useState(images)
  if (images !== lastImages) {
    setLastImages(images)
    setActive(0)
  }
  useEffect(() => {
    track.current?.scrollTo({ left: 0 })
  }, [images])

  useEffect(() => {
    if (!zoomOpen) return
    document.body.style.overflow = "hidden"
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setZoomOpen(false)
    window.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = ""
      window.removeEventListener("keydown", onKey)
    }
  }, [zoomOpen])

  const onScroll = () => {
    const el = track.current
    if (el) setActive(Math.round(el.scrollLeft / el.clientWidth))
  }

  if (!images.length) {
    return <div className="aspect-[4/5] bg-surface" />
  }

  return (
    <div>
      {/* Phones */}
      <div className="relative -mx-4 small:hidden">
        <div
          ref={track}
          onScroll={onScroll}
          className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto"
          data-testid="gallery-track"
        >
          {images.map((src, i) => (
            <button
              key={src}
              type="button"
              onClick={() => {
                setActive(i)
                setZoomOpen(true)
              }}
              className="relative aspect-[4/5] w-full shrink-0 snap-center bg-surface"
              aria-label={t.product.zoom}
            >
              <Image src={src} alt={i === 0 ? alt : ""} fill priority={i === 0} sizes="100vw" className="object-cover" />
            </button>
          ))}
        </div>
        {images.length > 1 && (
          <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5" aria-hidden="true">
            {images.map((src, i) => (
              <span key={src} className={`h-1.5 rounded-full transition-all ${i === active ? "w-5 bg-white" : "w-1.5 bg-white/60"}`} />
            ))}
          </div>
        )}
      </div>

      {/* Computers: every picture, two per row; hover to zoom, click for full screen */}
      <div className={`hidden gap-1 small:grid ${images.length > 1 ? "small:grid-cols-2" : "max-w-[620px]"}`}>
        {images.map((src, i) => (
          <button
            key={src}
            type="button"
            onClick={() => {
              setActive(i)
              setZoomOpen(true)
            }}
            onMouseMove={(e) => {
              const r = e.currentTarget.getBoundingClientRect()
              setOrigin({ i, at: `${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%` })
            }}
            onMouseLeave={() => setOrigin(null)}
            className="relative aspect-[4/5] w-full cursor-zoom-in overflow-hidden bg-surface"
            aria-label={`${t.product.zoom} – ${format(t.product.image, { n: i + 1, total: images.length })}`}
          >
            <Image
              src={src}
              alt={i === 0 ? alt : ""}
              fill
              // No priority here: it would make phones download these hidden pictures too
              sizes="(max-width: 1280px) 30vw, 420px"
              className="object-cover transition-transform duration-200"
              style={origin?.i === i ? { transform: "scale(1.7)", transformOrigin: origin.at } : undefined}
            />
          </button>
        ))}
      </div>

      {zoomOpen && (
        <div className="fixed inset-0 z-[120] flex flex-col bg-white" role="dialog" aria-modal="true" aria-label={t.product.zoom}>
          <div className="flex h-14 items-center justify-between px-4">
            <span className="text-sm text-muted">{format(t.product.image, { n: active + 1, total: images.length })}</span>
            <button type="button" onClick={() => setZoomOpen(false)} className="flex h-10 w-10 items-center justify-center" aria-label={t.common.close}>
              <CloseIcon />
            </button>
          </div>
          <div className="relative flex-1 overflow-auto">
            <div className="relative mx-auto aspect-[4/5] w-full max-w-3xl">
              <Image src={images[active]} alt={alt} fill sizes="100vw" className="object-contain" quality={90} />
            </div>
          </div>
          <div className="flex justify-center gap-2 p-3">
            {images.map((src, i) => (
              <button
                key={src}
                type="button"
                onClick={() => setActive(i)}
                className={`relative h-16 w-12 overflow-hidden ring-1 ${i === active ? "ring-ink" : "ring-transparent"}`}
                aria-label={format(t.product.image, { n: i + 1, total: images.length })}
              >
                <Image src={src} alt="" fill sizes="48px" className="object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
