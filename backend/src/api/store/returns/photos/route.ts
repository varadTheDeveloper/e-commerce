import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { uploadFilesWorkflow } from "@medusajs/medusa/core-flows"
import { randomUUID } from "crypto"
import { RateLimiter } from "../../../../lib/rate-limit"

// A return takes at most 3 photos; this stops one account from filling the storage
const perCustomer = new RateLimiter(20, 60 * 60 * 1000)

/** Image types accepted, recognised by their first bytes (not the file name). */
function imageType(buf: Buffer): { ext: string; mime: string } | null {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { ext: "jpg", mime: "image/jpeg" }
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { ext: "png", mime: "image/png" }
  if (buf.length > 12 && buf.subarray(0, 4).toString() === "RIFF" && buf.subarray(8, 12).toString() === "WEBP") return { ext: "webp", mime: "image/webp" }
  return null
}

/**
 * POST /store/returns/photos (multipart, field "photo", max 5 MB) — a photo for
 * a return request. Returns its id, to send with the request. Photos are kept
 * under the customer's own folder, so nobody can attach another customer's.
 */
export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const wait = perCustomer.hit(req.auth_context.actor_id)
  if (wait) {
    return res.status(429).json({ type: "too_many", message: "Too many photos. Please try again later.", retry_after: Math.ceil(wait / 1000) })
  }
  const file = (req as any).file as { buffer: Buffer } | undefined
  if (!file?.buffer?.length) {
    return res.status(400).json({ type: "invalid_data", message: "No photo uploaded" })
  }
  const type = imageType(file.buffer)
  if (!type) {
    return res.status(400).json({ type: "invalid_photo", message: "Upload a JPG, PNG or WebP photo" })
  }
  const { result } = await uploadFilesWorkflow(req.scope).run({
    input: {
      files: [
        {
          filename: `returns/${req.auth_context.actor_id}/${randomUUID()}.${type.ext}`,
          mimeType: type.mime,
          content: file.buffer.toString("base64"),
          access: "public",
        },
      ],
    },
  })
  res.json({ id: result[0].id, url: result[0].url })
}
