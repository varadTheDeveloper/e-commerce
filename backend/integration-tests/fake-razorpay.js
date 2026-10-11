// A fake of the Razorpay API parts the shop uses, for tests only.
// Orders, payments, capture and refund, plus a test-only endpoint that
// "pays" an order like a shopper would in Razorpay Checkout:
//   POST /test/pay/<order_id>   (optional JSON { "amount": paise })
//
// Used by the backend integration tests (require) and, in development and
// CI, as a server for the browser tests:
//   node integration-tests/fake-razorpay.js        (port 9911 or FAKE_RAZORPAY_PORT)
// Start the backend with RAZORPAY_KEY_ID=rzp_test_fake RAZORPAY_KEY_SECRET=fake-secret
// RAZORPAY_API_BASE=http://127.0.0.1:9911 to use it.

const { createServer } = require("http")

const KEY_ID = "rzp_test_fake"
const KEY_SECRET = "fake-secret"

function startFakeRazorpay({ port = 0, keyId = KEY_ID, keySecret = KEY_SECRET } = {}) {
  const state = {
    orders: new Map(),
    payments: new Map(),
    refunds: [],
    /** The shopper pays: the payment is authorized */
    pay(orderId, amount) {
      const order = state.orders.get(orderId)
      if (!order) return null
      const payment = {
        id: `pay_${state.payments.size + 1}`,
        order_id: orderId,
        amount: amount ?? order.amount,
        currency: "INR",
        status: "authorized",
      }
      state.payments.set(payment.id, payment)
      return payment
    },
  }
  const expectedAuth = "Basic " + Buffer.from(`${keyId}:${keySecret}`).toString("base64")

  const server = createServer((req, res) => {
    let raw = ""
    req.on("data", (c) => (raw += c))
    req.on("end", () => {
      const reply = (status, body) => {
        res.writeHead(status, {
          "content-type": "application/json",
          "access-control-allow-origin": "*",
          "access-control-allow-headers": "content-type",
        })
        res.end(JSON.stringify(body))
      }
      const path = (req.url || "").split("?")[0]
      let body = {}
      try {
        body = raw ? JSON.parse(raw) : {}
      } catch {
        return reply(400, { error: { description: "bad json" } })
      }
      let m
      if (req.method === "OPTIONS") return reply(204, {})

      // Test-only: pay an order (what the shopper does in Razorpay Checkout)
      if (req.method === "POST" && (m = path.match(/^\/test\/pay\/([^/]+)$/))) {
        const payment = state.pay(m[1], body.amount)
        return payment ? reply(200, payment) : reply(404, {})
      }

      if (req.headers.authorization !== expectedAuth) return reply(401, { error: { description: "bad key" } })
      if (req.method === "POST" && path === "/v1/orders") {
        const order = {
          id: `order_${Date.now().toString(36)}${state.orders.size + 1}`,
          amount: body.amount,
          currency: body.currency,
          status: "created",
          notes: body.notes,
          payment: body.payment,
        }
        state.orders.set(order.id, order)
        return reply(200, order)
      }
      if ((m = path.match(/^\/v1\/orders\/([^/]+)\/payments$/))) {
        return reply(200, { items: [...state.payments.values()].filter((p) => p.order_id === m[1]) })
      }
      if ((m = path.match(/^\/v1\/orders\/([^/]+)$/))) {
        const order = state.orders.get(m[1])
        return order ? reply(200, order) : reply(404, {})
      }
      if ((m = path.match(/^\/v1\/payments\/([^/]+)\/capture$/))) {
        const p = state.payments.get(m[1])
        if (!p || p.status !== "authorized" || body.amount !== p.amount) {
          return reply(400, { error: { description: "cannot capture" } })
        }
        p.status = "captured"
        return reply(200, p)
      }
      if ((m = path.match(/^\/v1\/payments\/([^/]+)\/refund$/))) {
        state.refunds.push({ payment_id: m[1], amount: body.amount })
        return reply(200, { id: `rfnd_${state.refunds.length}`, status: "processed" })
      }
      if ((m = path.match(/^\/v1\/payments\/([^/]+)$/))) {
        const p = state.payments.get(m[1])
        return p ? reply(200, p) : reply(404, {})
      }
      reply(404, {})
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

module.exports = { startFakeRazorpay, KEY_ID, KEY_SECRET }

if (require.main === module) {
  const port = Number(process.env.FAKE_RAZORPAY_PORT || 9911)
  startFakeRazorpay({ port }).then(({ url }) => console.log(`Fake Razorpay on ${url}`))
}
