import { describe, expect, it } from "vitest"
import { JEANS, KURTA, makeProduct, TEE } from "./__fixtures__/products"
import { normalize, searchProducts } from "./search"

const ids = (list: { id: string }[]) => list.map((p) => p.id)

describe("search", () => {
  const all = [TEE, JEANS, KURTA]

  it("normalises case and punctuation but keeps Devanagari", () => {
    expect(normalize("  T-Shirt, Black! ")).toBe("t shirt black")
    expect(normalize("कुर्ता")).toBe("कुर्ता")
  })

  it("finds by title words, plurals and colour names in any language", () => {
    expect(ids(searchProducts(all, "jeans"))).toEqual(["jeans"])
    expect(ids(searchProducts(all, "t-shirts"))).toEqual(["tee"])
    expect(ids(searchProducts(all, "काला"))).toEqual(["tee"]) // Hindi for black
    expect(ids(searchProducts(all, "कुर्ता"))).toEqual(["kurta"])
  })

  it("forgives one typo in longer words", () => {
    expect(ids(searchProducts(all, "jeens"))).toEqual(["jeans"])
    expect(ids(searchProducts(all, "slimm"))).toEqual(["jeans"])
  })

  it("needs every word to match", () => {
    expect(ids(searchProducts(all, "black jeans"))).toEqual([])
    expect(searchProducts(all, "   ")).toEqual([])
  })

  it("matches the English version of a translated catalogue", () => {
    const englishKurta = makeProduct({ id: "kurta", title: "Cotton Straight Kurta", colours: ["maroon"], sizes: ["M"], variants: [] })
    expect(ids(searchProducts([KURTA], "kurta", [englishKurta]))).toEqual(["kurta"])
  })
})
