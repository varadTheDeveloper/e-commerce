import { HttpTypes } from "@medusajs/types"

type V = { size: string; colour: string; price: number; mrp: number; stock: number }

/** Builds a product shaped like the Medusa store API response. */
export function makeProduct(opts: {
  id: string
  title: string
  colours: string[]
  sizes: string[]
  variants: V[]
  fabric?: string
  created?: string
  categories?: string[]
  collections?: string[]
}): HttpTypes.StoreProduct {
  const sizeOpt = { id: `${opts.id}-size`, title: "Size", values: opts.sizes.map((value) => ({ value })) }
  const colourOpt = { id: `${opts.id}-colour`, title: "Colour", values: opts.colours.map((value) => ({ value })) }
  return {
    id: opts.id,
    title: opts.title,
    handle: opts.id,
    created_at: opts.created ?? "2026-01-01T00:00:00Z",
    metadata: { fabric: opts.fabric, collections: opts.collections ?? [] },
    categories: (opts.categories ?? []).map((name, i) => ({ id: `cat-${i}`, name })),
    images: opts.colours.flatMap((c) => [
      { url: `http://img/tshirt-${c}.webp` },
      { url: `http://img/tshirt-${c}-detail.webp` },
    ]),
    options: [sizeOpt, colourOpt],
    variants: opts.variants.map((v, i) => ({
      id: `${opts.id}-v${i}`,
      manage_inventory: true,
      allow_backorder: false,
      inventory_quantity: v.stock,
      options: [
        { option_id: sizeOpt.id, value: v.size },
        { option_id: colourOpt.id, value: v.colour },
      ],
      calculated_price: { calculated_amount: v.price, original_amount: v.mrp },
    })),
  } as unknown as HttpTypes.StoreProduct
}

export const TEE = makeProduct({
  id: "tee",
  title: "Classic Cotton T-Shirt",
  colours: ["black", "white", "sky-blue"],
  sizes: ["XL", "S", "M"],
  fabric: "cotton",
  created: "2026-03-01T00:00:00Z",
  categories: ["T-Shirts"],
  collections: ["new-arrivals"],
  variants: [
    { size: "S", colour: "black", price: 499, mrp: 799, stock: 5 },
    { size: "M", colour: "black", price: 499, mrp: 799, stock: 0 },
    { size: "XL", colour: "white", price: 499, mrp: 799, stock: 2 },
    { size: "M", colour: "sky-blue", price: 499, mrp: 799, stock: 0 },
  ],
})

export const JEANS = makeProduct({
  id: "jeans",
  title: "Slim Fit Jeans",
  colours: ["indigo"],
  sizes: ["32", "28", "30"],
  fabric: "denim",
  created: "2026-02-01T00:00:00Z",
  variants: [
    { size: "28", colour: "indigo", price: 1199, mrp: 1999, stock: 3 },
    { size: "30", colour: "indigo", price: 1199, mrp: 1999, stock: 3 },
    { size: "32", colour: "indigo", price: 1199, mrp: 1999, stock: 0 },
  ],
})

export const KURTA = makeProduct({
  id: "kurta",
  title: "कॉटन स्ट्रेट कुर्ता",
  colours: ["maroon"],
  sizes: ["M"],
  fabric: "cotton",
  created: "2026-04-01T00:00:00Z",
  variants: [{ size: "M", colour: "maroon", price: 2100, mrp: 2100, stock: 10 }],
})
