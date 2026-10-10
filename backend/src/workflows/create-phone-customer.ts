import { CreateCustomerDTO } from "@medusajs/framework/types"
import { createWorkflow, transform, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { createCustomersWorkflow, setAuthAppMetadataStep } from "@medusajs/medusa/core-flows"

/**
 * Like Medusa's createCustomerAccountWorkflow, but email is optional:
 * customers sign up with a verified phone number only.
 */
export const createPhoneCustomerWorkflow = createWorkflow(
  "create-phone-customer",
  (input: { authIdentityId: string; customerData: CreateCustomerDTO }) => {
    const customerData = transform({ input }, ({ input }) => ({ ...input.customerData, has_account: true }))
    const customers = createCustomersWorkflow.runAsStep({ input: { customersData: [customerData] } })
    const customer = transform(customers, (list) => list[0])
    setAuthAppMetadataStep({ authIdentityId: input.authIdentityId, actorType: "customer", value: customer.id })
    return new WorkflowResponse(customer)
  }
)
