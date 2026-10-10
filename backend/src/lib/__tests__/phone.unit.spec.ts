import { maskPhone, normalizeIndianMobile } from "../phone"

describe("normalizeIndianMobile", () => {
  it.each([
    ["9876543210", "+919876543210"],
    ["+91 98765 43210", "+919876543210"],
    ["919876543210", "+919876543210"],
    ["09876543210", "+919876543210"],
    ["98765-43210", "+919876543210"],
    ["6000000000", "+916000000000"],
  ])("accepts %s", (input, expected) => {
    expect(normalizeIndianMobile(input)).toBe(expected)
  })

  it.each(["5876543210", "987654321", "98765432101", "+1 9876543210", "abcdefghij", "", undefined, 9876543210])(
    "rejects %s",
    (input) => {
      expect(normalizeIndianMobile(input as unknown)).toBeNull()
    }
  )

  it("masks numbers for logs", () => {
    expect(maskPhone("+919876543210")).toBe("+91987•••10")
  })
})
