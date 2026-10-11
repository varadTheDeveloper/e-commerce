import { existsSync } from "fs"
import path from "path"
import PDFDocument from "pdfkit"
import { GstSummary } from "./gst"

// Draws a GST tax invoice as an A4 PDF. Uses the Mukta font so names and
// addresses typed in Marathi or Hindi print correctly.

export type InvoiceParty = { name: string; lines: string[]; phone?: string | null }

export type InvoiceData = {
  number: string
  date: Date
  orderNumber: string
  seller: { name: string; lines: string[]; gstin: string; state: string; stateCode: string; email: string }
  billTo: InvoiceParty
  shipTo: InvoiceParty
  placeOfSupply: string
  paymentMethod: string
  gst: GstSummary
}

function fontDir(): string {
  const candidates = [
    path.resolve(__dirname, "../assets/fonts"),
    path.resolve(process.cwd(), "src/assets/fonts"),
    path.resolve(process.cwd(), "../../src/assets/fonts"),
  ]
  const found = candidates.find((dir) => existsSync(path.join(dir, "Mukta-Regular.ttf")))
  if (!found) throw new Error("Invoice font not found (src/assets/fonts)")
  return found
}

const rs = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const istDate = (d: Date) =>
  d.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric" })

export function renderInvoicePdf(data: InvoiceData): Promise<Buffer> {
  const dir = fontDir()
  const doc = new PDFDocument({ size: "A4", margin: 40, info: { Title: `Tax invoice ${data.number}` } })
  doc.registerFont("regular", path.join(dir, "Mukta-Regular.ttf"))
  doc.registerFont("bold", path.join(dir, "Mukta-SemiBold.ttf"))

  const chunks: Buffer[] = []
  doc.on("data", (c: Buffer) => chunks.push(c))
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)))
    doc.on("error", reject)
  })

  const left = 40
  const width = doc.page.width - 80

  // Header
  doc.font("bold").fontSize(18).text("Tax Invoice", left, 40)
  doc.font("regular").fontSize(9).fillColor("#555").text("Original for recipient", left, 64)
  doc.fillColor("#000")

  doc.font("bold").fontSize(11).text(data.seller.name, left, 90, { width: width / 2 })
  doc.font("regular").fontSize(9)
  for (const line of data.seller.lines) doc.text(line, { width: width / 2 })
  doc.text(`GSTIN: ${data.seller.gstin}`)
  doc.text(`State: ${data.seller.state} (${data.seller.stateCode})`)
  doc.text(data.seller.email)
  const sellerEnd = doc.y

  const metaX = left + width / 2 + 20
  const meta: [string, string][] = [
    ["Invoice no.", data.number],
    ["Invoice date", istDate(data.date)],
    ["Order no.", data.orderNumber],
    ["Place of supply", data.placeOfSupply],
    ["Payment", data.paymentMethod],
  ]
  meta.forEach(([k, v], i) => {
    doc.font("regular").text(k, metaX, 90 + i * 14, { width: 90 })
    doc.font("bold").text(v, metaX + 90, 90 + i * 14, { width: width / 2 - 110 })
  })

  // Parties
  let y = Math.max(sellerEnd, doc.y) + 18
  const party = (title: string, p: InvoiceParty, x: number) => {
    doc.font("bold").fontSize(9).text(title, x, y, { width: width / 2 - 10 })
    doc.font("regular").text(p.name, { width: width / 2 - 10 })
    for (const line of p.lines.filter(Boolean)) doc.text(line, { width: width / 2 - 10 })
    if (p.phone) doc.text(`Phone: ${p.phone}`, { width: width / 2 - 10 })
    return doc.y
  }
  y = Math.max(party("Bill to", data.billTo, left), party("Ship to", data.shipTo, metaX)) + 16

  // Lines
  const intra = data.gst.intraState
  const cols = intra
    ? [
        { h: "#", w: 18 }, { h: "Item", w: 157 }, { h: "HSN", w: 38 }, { h: "Qty", w: 26, r: true },
        { h: "Taxable", w: 62, r: true }, { h: "GST %", w: 34, r: true }, { h: "CGST", w: 52, r: true },
        { h: "SGST", w: 52, r: true }, { h: "Total", w: 76, r: true },
      ]
    : [
        { h: "#", w: 18 }, { h: "Item", w: 192 }, { h: "HSN", w: 38 }, { h: "Qty", w: 26, r: true },
        { h: "Taxable", w: 70, r: true }, { h: "GST %", w: 34, r: true }, { h: "IGST", w: 61, r: true },
        { h: "Total", w: 76, r: true },
      ]
  const row = (cells: string[], bold = false) => {
    doc.font(bold ? "bold" : "regular").fontSize(8.5)
    let x = left
    const heights = cells.map((c, i) => doc.heightOfString(c, { width: cols[i].w - 4 }))
    const h = Math.max(...heights) + 6
    if (y + h > doc.page.height - 120) {
      doc.addPage()
      y = 40
    }
    cells.forEach((c, i) => {
      doc.text(c, x + 2, y + 3, { width: cols[i].w - 4, align: (cols[i] as any).r ? "right" : "left" })
      x += cols[i].w
    })
    y += h
    doc.moveTo(left, y).lineTo(left + width, y).strokeColor("#ddd").lineWidth(0.5).stroke()
  }
  doc.moveTo(left, y).lineTo(left + width, y).strokeColor("#999").lineWidth(0.8).stroke()
  row(cols.map((c) => c.h), true)
  data.gst.lines.forEach((l, i) => {
    const tax = intra ? [rs(l.cgst), rs(l.sgst)] : [rs(l.igst)]
    row([String(i + 1), l.description, l.hsn, String(l.quantity), rs(l.taxable), `${l.rate}%`, ...tax, rs(l.total)])
  })

  // Totals
  y += 10
  const totals: [string, number][] = intra
    ? [["Taxable value", data.gst.taxable], ["CGST", data.gst.cgst], ["SGST", data.gst.sgst]]
    : [["Taxable value", data.gst.taxable], ["IGST", data.gst.igst]]
  totals.push(["Total (Rs.)", data.gst.total])
  totals.forEach(([k, v], i) => {
    const last = i === totals.length - 1
    doc.font(last ? "bold" : "regular").fontSize(last ? 11 : 9)
    doc.text(k, left + width - 240, y, { width: 140 })
    doc.text(rs(v), left + width - 100, y, { width: 100, align: "right" })
    y += last ? 18 : 14
  })

  y += 16
  doc.font("regular").fontSize(8).fillColor("#555")
  doc.text("Amounts in Indian rupees. Prices include GST. Tax is not payable on reverse charge basis.", left, y, { width })
  doc.text("This is a computer-generated invoice and needs no signature.", { width })
  doc.end()
  return done
}
