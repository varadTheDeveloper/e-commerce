import { getAuthHeaders } from "@lib/data/cookies"
import { NextResponse } from "next/server"

const BACKEND_URL = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"

/** GST invoice PDF for the logged-in customer's order (fetched from the backend with their login). */
export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  if (!/^order_[A-Za-z0-9]+$/.test(id)) {
    return new NextResponse("Not found", { status: 404 })
  }
  const auth = (await getAuthHeaders()) as Record<string, string>
  if (!auth.authorization) {
    return new NextResponse("Please log in", { status: 401 })
  }
  const res = await fetch(`${BACKEND_URL}/store/orders/${id}/invoice`, {
    headers: { ...auth, "x-publishable-api-key": process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY ?? "" },
    cache: "no-store",
  })
  if (!res.ok) {
    return new NextResponse(res.status === 404 ? "Not found" : "Could not create the invoice", { status: res.status === 404 ? 404 : 502 })
  }
  return new NextResponse(res.body, {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": res.headers.get("content-disposition") ?? "inline",
      "cache-control": "private, no-store",
    },
  })
}
