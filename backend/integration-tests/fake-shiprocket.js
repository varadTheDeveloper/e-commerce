// A fake of the Shiprocket API parts the shop uses, for tests only.
// Pincodes starting with 9 are not served; pincodes starting with 8 are
// served without cash on delivery. Everything else: delivery in 4 days, COD ok.
//
// Used by the backend integration tests (require) and, in development and
// CI, as a server for the browser tests:
//   node integration-tests/fake-shiprocket.js        (port 9912 or FAKE_SHIPROCKET_PORT)
// Start the backend with SHIPROCKET_EMAIL=api@example.com SHIPROCKET_PASSWORD=fake-password
// SHIPROCKET_API_BASE=http://127.0.0.1:9912 to use it.

const { createServer } = require("http")

const EMAIL = "api@example.com"
const PASSWORD = "fake-password"

function startFakeShiprocket({ port = 0, email = EMAIL, password = PASSWORD } = {}) {
  const state = {
    orders: new Map(), // Shiprocket order id → order
    cancelled: [],
    logins: 0,
  }
  // Different numbers on every start, like real (unique) AWBs
  let nextId = 1000 + (Date.now() % 1_000_000) * 10

  const server = createServer((req, res) => {
    let raw = ""
    req.on("data", (c) => (raw += c))
    req.on("end", () => {
      const reply = (status, body) => {
        res.writeHead(status, { "content-type": "application/json" })
        res.end(JSON.stringify(body))
      }
      const url = new URL(req.url || "/", "http://fake")
      const path = url.pathname.replace(/^\/v1\/external/, "")
      let body = {}
      try {
        body = raw ? JSON.parse(raw) : {}
      } catch {
        return reply(400, { message: "bad json" })
      }

      if (req.method === "POST" && path === "/auth/login") {
        if (body.email !== email || body.password !== password) return reply(401, { message: "Invalid credentials" })
        state.logins++
        return reply(200, { token: `token-${state.logins}` })
      }
      if (!/^Bearer token-\d+$/.test(req.headers.authorization || "")) return reply(401, { message: "Unauthenticated" })

      if (req.method === "GET" && path === "/courier/serviceability/") {
        const pin = url.searchParams.get("delivery_postcode") || ""
        const cod = url.searchParams.get("cod") === "1"
        if (pin.startsWith("9") || (cod && pin.startsWith("8"))) {
          return reply(404, { message: "No courier available", status: 404 })
        }
        return reply(200, {
          data: {
            recommended_courier_company_id: 2,
            available_courier_companies: [
              { courier_company_id: 1, courier_name: "Slow Express", estimated_delivery_days: "7", cod: pin.startsWith("8") ? 0 : 1, rate: 60 },
              { courier_company_id: 2, courier_name: "Fast Courier", estimated_delivery_days: "4", cod: pin.startsWith("8") ? 0 : 1, rate: 80 },
            ],
          },
        })
      }
      if (req.method === "POST" && path === "/orders/create/adhoc") {
        const id = nextId++
        const order = { id, shipment_id: id + 5000, input: body, status: "NEW", awb: null, pickup: false }
        state.orders.set(id, order)
        return reply(200, { order_id: id, shipment_id: order.shipment_id, status: "NEW" })
      }
      if (req.method === "POST" && path === "/orders/create/return") {
        const id = nextId++
        const order = { id, shipment_id: id + 5000, input: body, status: "RETURN PENDING", awb: null, pickup: false, is_return: true }
        state.orders.set(id, order)
        return reply(200, { order_id: id, shipment_id: order.shipment_id, status: "RETURN PENDING" })
      }
      const byShipment = (sid) => [...state.orders.values()].find((o) => o.shipment_id === Number(sid))
      if (req.method === "POST" && path === "/courier/assign/awb") {
        const order = byShipment(body.shipment_id)
        if (!order) return reply(404, { message: "Shipment not found" })
        order.awb = `${body.is_return ? "RAWB" : "AWB"}${order.id}`
        return reply(200, {
          awb_assign_status: 1,
          response: { data: { awb_code: order.awb, courier_company_id: body.courier_id || 2, courier_name: "Fast Courier" } },
        })
      }
      if (req.method === "POST" && path === "/courier/generate/pickup") {
        const order = byShipment((body.shipment_id || [])[0])
        if (!order) return reply(404, { message: "Shipment not found" })
        order.pickup = true
        return reply(200, { pickup_status: 1, response: { pickup_scheduled_date: "2026-10-12 10:00:00" } })
      }
      if (req.method === "POST" && path === "/courier/generate/label") {
        const order = byShipment((body.shipment_id || [])[0])
        if (!order) return reply(404, { message: "Shipment not found" })
        return reply(200, { label_created: 1, label_url: `https://labels.example.com/${order.awb}.pdf` })
      }
      if (req.method === "POST" && path === "/orders/cancel") {
        for (const id of body.ids || []) {
          const order = state.orders.get(Number(id))
          if (order) order.status = "CANCELED"
          state.cancelled.push(Number(id))
        }
        return reply(200, { message: "Orders cancelled" })
      }
      reply(404, { message: "Not found" })
    })
  })

  return new Promise((resolve) => {
    server.listen(port, "127.0.0.1", () => {
      resolve({
        state,
        url: `http://127.0.0.1:${server.address().port}`,
        close: () => new Promise((done) => server.close(() => done())),
      })
    })
  })
}

module.exports = { startFakeShiprocket, EMAIL, PASSWORD }

if (require.main === module) {
  const port = Number(process.env.FAKE_SHIPROCKET_PORT || 9912)
  startFakeShiprocket({ port }).then(({ url }) => console.log(`Fake Shiprocket on ${url}`))
}
