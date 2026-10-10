import { describe, expect, it } from "vitest"
import { JEANS, KURTA, TEE } from "./__fixtures__/products"
import {
  availableSizes,
  buildFacets,
  compareSizes,
  EMPTY_FILTERS,
  filtersToQuery,
  imagesForColour,
  inCollection,
  matchesFilters,
  parseFilters,
  parseSort,
  productPrice,
  productSizes,
  sortProducts,
} from "./catalog"

describe("sizes", () => {
  it("orders letter, waist and kids sizes naturally", () => {
    expect(["XL", "S", "XXL", "M", "XS"].sort(compareSizes)).toEqual(["XS", "S", "M", "XL", "XXL"])
    expect(["32", "28", "36", "30"].sort(compareSizes)).toEqual(["28", "30", "32", "36"])
    expect(["8-9Y", "2-3Y", "4-5Y"].sort(compareSizes)).toEqual(["2-3Y", "4-5Y", "8-9Y"])
  })

  it("lists all sizes, and only in-stock ones for availability", () => {
    expect(productSizes(TEE)).toEqual(["S", "M", "XL"])
    expect(availableSizes(TEE)).toEqual(["S", "XL"]) // M is sold out in every colour
    expect(availableSizes(JEANS)).toEqual(["28", "30"])
  })
})

describe("prices", () => {
  it("returns selling price, MRP and rounded % off", () => {
    expect(productPrice(TEE)).toEqual({ price: 499, mrp: 799, discountPercent: 38 })
  })

  it("shows no discount when price equals MRP", () => {
    expect(productPrice(KURTA)).toEqual({ price: 2100, mrp: 2100, discountPercent: 0 })
  })
})

describe("images", () => {
  it("picks pictures of the chosen colour, without mixing sky-blue into blue", () => {
    expect(imagesForColour(TEE, "white")).toEqual([
      "http://img/tshirt-white.webp",
      "http://img/tshirt-white-detail.webp",
    ])
    expect(imagesForColour(TEE, "sky-blue")).toHaveLength(2)
  })

  it("falls back to all pictures for an unknown colour", () => {
    expect(imagesForColour(TEE, "purple")).toHaveLength(6)
  })
})

describe("filters", () => {
  const all = [TEE, JEANS, KURTA]

  it("reads filters from the address and ignores unknown price ranges", () => {
    expect(parseFilters({ size: "S,M", colour: ["black"], price: "500-999,bogus" })).toEqual({
      size: ["S", "M"],
      colour: ["black"],
      price: ["500-999"],
      fabric: [],
    })
    expect(parseSort({ sort: "price-asc" })).toBe("price-asc")
    expect(parseSort({ sort: "hack" })).toBe("newest")
  })

  it("writes filters back to the address, keeping extra values", () => {
    expect(filtersToQuery({ ...EMPTY_FILTERS, size: ["S", "M"] }, "discount", { q: "kurta" })).toBe(
      "?q=kurta&size=S%2CM&sort=discount"
    )
    expect(filtersToQuery(EMPTY_FILTERS, "newest")).toBe("")
  })

  it("matches only sizes that are in stock", () => {
    const f = { ...EMPTY_FILTERS, size: ["M"] }
    expect(all.filter((p) => matchesFilters(p, f)).map((p) => p.id)).toEqual(["kurta"])
  })

  it("combines groups with AND and values with OR", () => {
    const f = { ...EMPTY_FILTERS, fabric: ["cotton"], price: ["0-499", "1000-1499"] }
    expect(all.filter((p) => matchesFilters(p, f)).map((p) => p.id)).toEqual(["tee"])
  })

  it("counts facets from the full list", () => {
    const facets = buildFacets(all)
    expect(facets.size.map((s) => s.value)).toEqual(["S", "M", "XL", "28", "30"])
    expect(facets.fabric).toEqual(
      expect.arrayContaining([
        { value: "cotton", count: 2 },
        { value: "denim", count: 1 },
      ])
    )
    expect(facets.price.map((p) => p.value)).toEqual(["0-499", "1000-1499", "2000-"])
  })
})

describe("sorting", () => {
  const all = [TEE, JEANS, KURTA]
  const ids = (list: typeof all) => list.map((p) => p.id)

  it("sorts by newest, price and discount", () => {
    expect(ids(sortProducts(all, "newest"))).toEqual(["kurta", "tee", "jeans"])
    expect(ids(sortProducts(all, "price-asc"))).toEqual(["tee", "jeans", "kurta"])
    expect(ids(sortProducts(all, "price-desc"))).toEqual(["kurta", "jeans", "tee"])
    expect(ids(sortProducts(all, "discount"))).toEqual(["jeans", "tee", "kurta"])
  })
})

describe("collections", () => {
  it("uses the extra collection handles in metadata", () => {
    expect(inCollection(TEE, "new-arrivals")).toBe(true)
    expect(inCollection(JEANS, "new-arrivals")).toBe(false)
  })
})
