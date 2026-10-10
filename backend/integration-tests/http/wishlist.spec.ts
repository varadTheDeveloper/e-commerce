import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { Modules, ProductStatus } from "@medusajs/framework/utils"
import { publishableHeaders, signUpCustomer } from "./helpers"

jest.setTimeout(90 * 1000)
process.env.SMS_PROVIDER = "console"
process.env.OTP_TEST_CODE = "123456"

medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ api, getContainer }) => {
    it("keeps each customer's saved products", async () => {
      const headers = await publishableHeaders(getContainer)
      const products = getContainer().resolve(Modules.PRODUCT)
      const [kurta, shirt, draft] = await products.createProducts([
        { title: "Kurta", handle: "kurta", status: ProductStatus.PUBLISHED },
        { title: "Shirt", handle: "shirt", status: ProductStatus.PUBLISHED },
        { title: "Draft", handle: "draft", status: ProductStatus.DRAFT },
      ])

      // Not logged in: refused
      const anon = await api.get("/store/customers/me/wishlist", { headers }).catch((e) => e.response)
      expect(anon.status).toBe(401)

      const asha = await signUpCustomer(api, headers, "9000000011", "Asha")
      const ravi = await signUpCustomer(api, headers, "9000000012", "Ravi")

      // Adding twice and adding unpublished products has no effect
      await api.post("/store/customers/me/wishlist", { product_ids: [kurta.id, draft.id, "prod_missing"] }, { headers: asha })
      const res = await api.post("/store/customers/me/wishlist", { product_ids: [kurta.id, shirt.id] }, { headers: asha })
      expect(res.data.items.map((i: any) => i.handle).sort()).toEqual(["kurta", "shirt"])

      // Other customers do not see it
      expect((await api.get("/store/customers/me/wishlist", { headers: ravi })).data.items).toEqual([])

      const after = await api.delete(`/store/customers/me/wishlist/${kurta.id}`, { headers: asha })
      expect(after.data.items).toEqual([{ product_id: shirt.id, handle: "shirt" }])
    })
  },
})
