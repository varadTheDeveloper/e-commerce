import { defineRouteConfig } from "@medusajs/admin-sdk"
import { ArrowUturnLeft } from "@medusajs/icons"
import { Badge, Container, Heading, Table, Tabs, Text } from "@medusajs/ui"
import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { adminFetch, RequestRow, rupees, STATUS_COLOR, STATUS_LABEL } from "../../lib/returns"

// Return and exchange requests from customers. Staff decide on new ones,
// mark parcels received, and record COD refunds sent.

const TABS: { value: string; label: string; status?: string }[] = [
  { value: "todo", label: "To do", status: "requested,received,refund_due" },
  { value: "open", label: "In progress", status: "approved,picked_up" },
  { value: "all", label: "All" },
]

const ReturnRequestsPage = () => {
  const [tab, setTab] = useState("todo")
  const [rows, setRows] = useState<RequestRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const status = TABS.find((t) => t.value === tab)?.status
    setRows(null)
    adminFetch<{ return_requests: RequestRow[] }>(`/admin/return-requests${status ? `?status=${status}` : ""}`)
      .then((d) => setRows(d.return_requests))
      .catch((e) => setError(e.message))
  }, [tab])

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <Heading level="h1">Returns and exchanges</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            Requests from customers. Open one to approve, reject, mark received or record a refund.
          </Text>
        </div>
      </div>
      <div className="px-6 py-4">
        <Tabs value={tab} onValueChange={setTab}>
          <Tabs.List>
            {TABS.map((t) => (
              <Tabs.Trigger key={t.value} value={t.value}>
                {t.label}
              </Tabs.Trigger>
            ))}
          </Tabs.List>
        </Tabs>
      </div>
      {error && (
        <Text className="px-6 py-4 text-ui-fg-error" size="small">
          {error}
        </Text>
      )}
      <Table>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell>Date</Table.HeaderCell>
            <Table.HeaderCell>Order</Table.HeaderCell>
            <Table.HeaderCell>Customer</Table.HeaderCell>
            <Table.HeaderCell>Type</Table.HeaderCell>
            <Table.HeaderCell>Pieces</Table.HeaderCell>
            <Table.HeaderCell>Refund</Table.HeaderCell>
            <Table.HeaderCell>Status</Table.HeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {rows?.map((r) => (
            <Table.Row key={r.id} className="cursor-pointer">
              <Table.Cell>
                <Link to={`/return-requests/${r.id}`} className="text-ui-fg-interactive">
                  {new Date(r.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" })}
                </Link>
              </Table.Cell>
              <Table.Cell>#{r.order_number}</Table.Cell>
              <Table.Cell>{r.customer}</Table.Cell>
              <Table.Cell>{r.type === "exchange" ? "Size exchange" : "Return"}</Table.Cell>
              <Table.Cell>{r.pieces}</Table.Cell>
              <Table.Cell>{r.type === "return" ? `${rupees(r.refund_amount)}${r.refund_to ? ` → ${r.refund_to}` : ""}` : "–"}</Table.Cell>
              <Table.Cell>
                <Badge color={STATUS_COLOR[r.status] ?? "grey"} size="2xsmall">
                  {STATUS_LABEL[r.status] ?? r.status}
                </Badge>
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
      {rows && !rows.length && (
        <Text className="px-6 py-6 text-ui-fg-subtle" size="small">
          Nothing here.
        </Text>
      )}
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Returns",
  icon: ArrowUturnLeft,
})

export default ReturnRequestsPage
