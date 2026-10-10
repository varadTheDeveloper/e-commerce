import { sendOtpSms } from "../sms"

const logger = { info: jest.fn(), error: jest.fn(), warn: jest.fn() } as any

describe("sendOtpSms", () => {
  it("console provider logs a masked number", async () => {
    await sendOtpSms("+919876543210", "123456", { provider: "console" }, logger)
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining("+91987•••10"))
    expect(logger.info.mock.calls[0][0]).not.toContain("9876543210")
  })

  it("msg91 sends the template with the code", async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 200 })
    await sendOtpSms(
      "+919876543210",
      "654321",
      { provider: "msg91", msg91AuthKey: "k", msg91TemplateId: "t", msg91OtpVar: "otp" },
      logger,
      fetchMock as any
    )
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe("https://control.msg91.com/api/v5/flow")
    expect(init.headers.authkey).toBe("k")
    expect(JSON.parse(init.body)).toEqual({
      template_id: "t",
      short_url: "0",
      recipients: [{ mobiles: "919876543210", otp: "654321" }],
    })
  })

  it("msg91 errors are reported without the number", async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: false, status: 401 })
    await expect(
      sendOtpSms("+919876543210", "1", { provider: "msg91", msg91AuthKey: "k", msg91TemplateId: "t" }, logger, fetchMock as any)
    ).rejects.toThrow("HTTP 401")
  })

  it("msg91 needs its keys", async () => {
    await expect(sendOtpSms("+919876543210", "1", { provider: "msg91" }, logger)).rejects.toThrow("MSG91_AUTH_KEY")
  })
})
