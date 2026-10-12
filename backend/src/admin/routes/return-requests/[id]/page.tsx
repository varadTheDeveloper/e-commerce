import { Badge, Button, Container, Heading, Input, Text, Textarea, toast } from "@medusajs/ui"
import { useCallback, useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { adminFetch, REASON_LABEL, rupees, STATUS_COLOR, STATUS_LABEL } from "../../../lib/returns"

type Item = {
  line_item_id: string
  quantity: number
  reason: string
  note?: string
  title?: string
  variant_title?: string
  thumbnail?: string
  exchange_variant_title?: string
}

type Detail = {
  id: string
  type: "return" | "exchange"
  status: string
  order_id: string
  order_number: number
  customer: string
  customer_phone: string | null
  items: Item[]
  photos: string[] | null
  refund_amount: number | null
  refund_details: { method: "upi"; upi_id: string } | { method: "bank"; account_name: string; account_number: string; ifsc: string } | null
  refund_reference: string | null
  reject_reason: string | null
  pickup: { awb?: string; courier?: string; tracking_url?: string; error?: string } | null
  created_at: string
}

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="grid grid-cols-[160px_1fr] gap-4 px-6 py-3">
    <Text size="small" className="text-ui-fg-subtle">
      {label}
    </Text>
    <div className="text-ui-fg-base text-sm">{children}</div>
  </div>
)

/** One return or exchange request, with the next step for staff. */
const ReturnRequestPage = () => {
  const { id } = useParams()
  const [request, setRequest] = useState<Detail | null>(null)
  const [busy, setBusy] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState("")
  const [reference, setReference] = useState("")

  const load = useCallback(() => {
    adminFetch<{ return_request: Detail }>(`/admin/return-requests/${id}`)
      .then((d) => setRequest(d.return_request))
      .catch((e) => toast.error(e.message))
  }, [id])
  useEffect(load, [load])

  const act = async (action: string, body: Record<string, string> = {}, done = "Saved") => {
    setBusy(true)
    try {
      await adminFetch(`/admin/return-requests/${id}/${action}`, { method: "POST", body: JSON.stringify(body) })
      toast.success(done)
      setRejecting(false)
      load()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  if (!request) return <Container>Loading…</Container>
  const r = request
  const exchange = r.type === "exchange"

  return (
    <div className="flex flex-col gap-4">
      <Container className="divide-y p-0">
        <div className="flex items-center justify-between px-6 py-4">
          <div>
            <Heading level="h1">
              {exchange ? "Size exchange" : "Return"} · order #{r.order_number}
            </Heading>
            <Text size="small" className="text-ui-fg-subtle">
              Asked on {new Date(r.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} by {r.customer}
              {r.customer_phone ? ` (${r.customer_phone})` : ""}
            </Text>
          </div>
          <Badge color={STATUS_COLOR[r.status] ?? "grey"}>{STATUS_LABEL[r.status] ?? r.status}</Badge>
        </div>

        {r.items.map((item) => (
          <div key={item.line_item_id} className="flex gap-4 px-6 py-4">
            {item.thumbnail && <img src={item.thumbnail} alt="" className="h-20 w-16 rounded object-cover" />}
            <div className="text-sm">
              <p className="font-medium">
                {item.title} – {item.variant_title} × {item.quantity}
              </p>
              <p className="text-ui-fg-subtle">Reason: {REASON_LABEL[item.reason] ?? item.reason}</p>
              {item.note && <p className="text-ui-fg-subtle">“{item.note}”</p>}
              {exchange && <p>New size wanted: {item.exchange_variant_title}</p>}
            </div>
          </div>
        ))}

        {!!r.photos?.length && (
          <Row label="Photos">
            <div className="flex gap-2">
              {r.photos.map((p) => (
                <a key={p} href={p} target="_blank" rel="noreferrer">
                  <img src={p} alt="Customer photo" className="h-24 w-24 rounded object-cover" />
                </a>
              ))}
            </div>
          </Row>
        )}
        {!exchange && <Row label="Refund">{rupees(r.refund_amount)}</Row>}
        {r.refund_details && (
          <Row label="Send refund to">
            {r.refund_details.method === "upi" ? (
              <span>UPI: {r.refund_details.upi_id}</span>
            ) : (
              <span>
                {r.refund_details.account_name}, account {r.refund_details.account_number}, IFSC {r.refund_details.ifsc}
              </span>
            )}
          </Row>
        )}
        {r.refund_reference && <Row label="Refund sent">{r.refund_reference}</Row>}
        {r.pickup && (
          <Row label="Courier pickup">
            {r.pickup.error ? (
              <span className="text-ui-fg-error">{r.pickup.error}</span>
            ) : (
              <span>
                {r.pickup.courier}, tracking {r.pickup.awb}{" "}
                {r.pickup.tracking_url && (
                  <a href={r.pickup.tracking_url} target="_blank" rel="noreferrer" className="text-ui-fg-interactive">
                    track
                  </a>
                )}
              </span>
            )}
          </Row>
        )}
        {r.reject_reason && <Row label="Rejected because">{r.reject_reason}</Row>}
        <Row label="Order">
          <Link to={`/orders/${r.order_id}`} className="text-ui-fg-interactive">
            Open order #{r.order_number}
          </Link>
        </Row>
      </Container>

      {/* The next step */}
      <Container className="flex flex-col gap-3 px-6 py-4">
        {r.status === "requested" && !rejecting && (
          <>
            <Text size="small">
              Check the reason{r.photos?.length ? " and photos" : ""}. Approving books a courier to collect the item
              {exchange ? " and holds the new size" : ""}.
            </Text>
            <div className="flex gap-2">
              <Button isLoading={busy} onClick={() => act("approve", {}, "Approved, pickup booked")}>
                Approve
              </Button>
              <Button variant="secondary" disabled={busy} onClick={() => setRejecting(true)}>
                Reject
              </Button>
            </div>
          </>
        )}
        {r.status === "requested" && rejecting && (
          <>
            <Text size="small">The customer sees this reason.</Text>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. The tags were removed" />
            <div className="flex gap-2">
              <Button variant="danger" isLoading={busy} disabled={reason.trim().length < 3} onClick={() => act("reject", { reason }, "Rejected")}>
                Reject request
              </Button>
              <Button variant="secondary" onClick={() => setRejecting(false)}>
                Back
              </Button>
            </div>
          </>
        )}
        {(r.status === "approved" || r.status === "picked_up") && (
          <>
            <Text size="small">
              When the parcel arrives, check the item (unused, tags on). Then mark it received: it goes back into stock
              {exchange ? "" : r.refund_details ? " and the refund is due" : " and the money is refunded online"}.
            </Text>
            <div>
              <Button isLoading={busy} onClick={() => act("receive", {}, "Marked received")}>
                Item received and checked
              </Button>
            </div>
          </>
        )}
        {r.status === "received" && exchange && (
          <Text size="small">
            Now ship the new size: open the order and use <b>Create fulfillment</b> for the new item. This request completes when the
            courier picks it up.
          </Text>
        )}
        {r.status === "refund_due" && (
          <>
            <Text size="small">
              Send {rupees(r.refund_amount)} to the account above by UPI or bank transfer, then enter the payment reference. The
              customer's account details are deleted afterwards.
            </Text>
            <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="UPI / bank reference number" />
            <div>
              <Button isLoading={busy} disabled={reference.trim().length < 3} onClick={() => act("refunded", { reference }, "Refund recorded")}>
                Refund sent
              </Button>
            </div>
          </>
        )}
        {["refunded", "completed", "rejected", "cancelled"].includes(r.status) && (
          <Text size="small" className="text-ui-fg-subtle">
            Nothing left to do.
          </Text>
        )}
      </Container>
    </div>
  )
}

export default ReturnRequestPage
