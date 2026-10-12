// Fakes of Resend (email) and Message Central (codes and SMS), for tests only.
// Message Central here makes the code 123456 for every number.
//   Resend:          POST /emails
//   Message Central: GET /auth/v1/authentication/token, POST /verification/v3/send,
//                    GET /verification/v3/validateOtp
// Usage: point RESEND_API_BASE and MESSAGECENTRAL_BASE_URL at its url.

const { createServer } = require("http")

function startFakeMessaging({ port = 0 } = {}) {
  const state = { emails: [], sms: [], codes: new Map() }
  let next = 1
  const server = createServer((req, res) => {
    let raw = ""
    req.on("data", (c) => (raw += c))
    req.on("end", () => {
      const reply = (status, body) => {
        res.writeHead(status, { "content-type": "application/json" })
        res.end(JSON.stringify(body))
      }
      const url = new URL(req.url || "/", "http://fake")
      if (req.method === "POST" && url.pathname === "/emails") {
        if (!/^Bearer .+/.test(req.headers.authorization || "")) return reply(401, {})
        const body = JSON.parse(raw || "{}")
        state.emails.push(body)
        return reply(200, { id: `email_${state.emails.length}` })
      }
      if (url.pathname === "/auth/v1/authentication/token") return reply(200, { status: 200, token: "tok" })
      if (req.headers.authtoken !== "tok") return reply(401, {})
      if (req.method === "POST" && url.pathname === "/verification/v3/send") {
        const p = Object.fromEntries(url.searchParams)
        if (p.type === "SMS") {
          state.sms.push(p)
          return reply(200, { responseCode: 200, message: "SUCCESS", data: { verificationId: `s${next++}` } })
        }
        const id = `v${next++}`
        state.codes.set(id, "123456")
        return reply(200, { responseCode: 200, message: "SUCCESS", data: { verificationId: id } })
      }
      if (url.pathname === "/verification/v3/validateOtp") {
        const id = url.searchParams.get("verificationId")
        if (!state.codes.has(id)) return reply(400, { responseCode: 703 })
        if (url.searchParams.get("code") !== state.codes.get(id)) return reply(400, { responseCode: 702 })
        state.codes.delete(id)
        return reply(200, { responseCode: 200, data: { verificationStatus: "VERIFICATION_COMPLETED" } })
      }
      reply(404, {})
    })
  })
  return new Promise((resolve) => {
    server.listen(port, "127.0.0.1", () =>
      resolve({
        state,
        url: `http://127.0.0.1:${server.address().port}`,
        close: () => new Promise((done) => server.close(() => done())),
      })
    )
  })
}

module.exports = { startFakeMessaging }
