import { getAuthHeaders } from "@lib/data/cookies"
import { NextResponse } from "next/server"

const BACKEND_URL = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"

/** Uploads a return photo for the logged-in customer (passes the file to the backend with their login). */
export async function POST(req: Request) {
  const auth = (await getAuthHeaders()) as Record<string, string>
  if (!auth.authorization) {
    return NextResponse.json({ type: "unauthorized" }, { status: 401 })
  }
  const form = await req.formData()
  const photo = form.get("photo")
  if (!(photo instanceof Blob) || photo.size > 5 * 1024 * 1024) {
    return NextResponse.json({ type: "invalid_photo" }, { status: 400 })
  }
  const upload = new FormData()
  upload.append("photo", photo, "photo")
  const res = await fetch(`${BACKEND_URL}/store/returns/photos`, {
    method: "POST",
    headers: { ...auth, "x-publishable-api-key": process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY ?? "" },
    body: upload,
    cache: "no-store",
  })
  const body = await res.json().catch(() => ({}))
  return NextResponse.json(body, { status: res.ok ? 200 : res.status === 401 ? 401 : 400 })
}
