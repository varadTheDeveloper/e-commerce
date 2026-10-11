// Texts of the order updates customers receive, in Marathi, Hindi and English.
// Have the Marathi and Hindi wording checked by a native speaker before launch.
//
// SMS texts must match the templates registered on DLT word for word. Each
// {#var#} is a value the shop fills in. Register them exactly as written here
// (docs/SETUP-SHIPPING.md), then put the template ids in SMS_TEMPLATE_IDS.

export type Lang = "mr" | "hi" | "en"
export type UpdateKind = "placed" | "shipped" | "delivered" | "canceled"

export type MessageValues = {
  brand: string
  name: string
  order: string
  amount: string
  link: string
  cod: boolean
  courier?: string
  awb?: string
  trackingUrl?: string
  /** Online payment refunded on cancel */
  refund?: boolean
}

type Email = { subject: string; lines: string[]; button: string }

export const EMAILS: Record<Lang, Record<UpdateKind, (v: MessageValues) => Email>> = {
  en: {
    placed: (v) => ({
      subject: `Order #${v.order} placed – ${v.brand}`,
      lines: [
        `Hello ${v.name}, thank you for your order.`,
        `Order #${v.order}, total ${v.amount}.`,
        v.cod ? `Please pay ${v.amount} in cash or by UPI when the order arrives.` : "Your payment has been received.",
        "We will let you know when it ships.",
      ],
      button: "View your order",
    }),
    shipped: (v) => ({
      subject: `Order #${v.order} is on its way – ${v.brand}`,
      lines: [
        `Hello ${v.name}, your order #${v.order} has been shipped.`,
        `Courier: ${v.courier ?? "-"}, tracking number ${v.awb ?? "-"}.`,
        v.cod ? `Please keep ${v.amount} ready (cash or UPI).` : "",
      ],
      button: "Track your order",
    }),
    delivered: (v) => ({
      subject: `Order #${v.order} delivered – ${v.brand}`,
      lines: [`Hello ${v.name}, your order #${v.order} has been delivered.`, `Thank you for shopping with ${v.brand}.`],
      button: "View your order",
    }),
    canceled: (v) => ({
      subject: `Order #${v.order} cancelled – ${v.brand}`,
      lines: [
        `Hello ${v.name}, your order #${v.order} has been cancelled.`,
        v.refund ? `Your refund of ${v.amount} has been started. It usually reaches your account in 5–7 working days.` : "There is nothing to pay.",
      ],
      button: "View your order",
    }),
  },
  hi: {
    placed: (v) => ({
      subject: `ऑर्डर #${v.order} हो गया – ${v.brand}`,
      lines: [
        `नमस्ते ${v.name}, आपके ऑर्डर के लिए धन्यवाद।`,
        `ऑर्डर #${v.order}, कुल ${v.amount}।`,
        v.cod ? `ऑर्डर पहुँचने पर कृपया ${v.amount} नकद या UPI से दें।` : "आपका भुगतान मिल गया है।",
        "ऑर्डर भेजते ही हम आपको बताएँगे।",
      ],
      button: "अपना ऑर्डर देखें",
    }),
    shipped: (v) => ({
      subject: `ऑर्डर #${v.order} रास्ते में है – ${v.brand}`,
      lines: [
        `नमस्ते ${v.name}, आपका ऑर्डर #${v.order} भेज दिया गया है।`,
        `कूरियर: ${v.courier ?? "-"}, ट्रैकिंग नंबर ${v.awb ?? "-"}।`,
        v.cod ? `कृपया ${v.amount} तैयार रखें (नकद या UPI)।` : "",
      ],
      button: "अपना ऑर्डर ट्रैक करें",
    }),
    delivered: (v) => ({
      subject: `ऑर्डर #${v.order} डिलीवर हो गया – ${v.brand}`,
      lines: [`नमस्ते ${v.name}, आपका ऑर्डर #${v.order} डिलीवर हो गया है।`, `${v.brand} से खरीदारी करने के लिए धन्यवाद।`],
      button: "अपना ऑर्डर देखें",
    }),
    canceled: (v) => ({
      subject: `ऑर्डर #${v.order} रद्द हो गया – ${v.brand}`,
      lines: [
        `नमस्ते ${v.name}, आपका ऑर्डर #${v.order} रद्द कर दिया गया है।`,
        v.refund ? `आपके ${v.amount} का रिफ़ंड शुरू हो गया है। यह आम तौर पर 5–7 कामकाजी दिनों में आपके खाते में आ जाता है।` : "आपको कुछ भी भुगतान नहीं करना है।",
      ],
      button: "अपना ऑर्डर देखें",
    }),
  },
  mr: {
    placed: (v) => ({
      subject: `ऑर्डर #${v.order} नोंदवली – ${v.brand}`,
      lines: [
        `नमस्कार ${v.name}, तुमच्या ऑर्डरबद्दल धन्यवाद.`,
        `ऑर्डर #${v.order}, एकूण ${v.amount}.`,
        v.cod ? `ऑर्डर आल्यावर कृपया ${v.amount} रोख किंवा UPI ने द्या.` : "तुमचे पेमेंट मिळाले आहे.",
        "ऑर्डर पाठवताच आम्ही तुम्हाला कळवू.",
      ],
      button: "तुमची ऑर्डर पाहा",
    }),
    shipped: (v) => ({
      subject: `ऑर्डर #${v.order} वाटेवर आहे – ${v.brand}`,
      lines: [
        `नमस्कार ${v.name}, तुमची ऑर्डर #${v.order} पाठवली आहे.`,
        `कुरिअर: ${v.courier ?? "-"}, ट्रॅकिंग नंबर ${v.awb ?? "-"}.`,
        v.cod ? `कृपया ${v.amount} तयार ठेवा (रोख किंवा UPI).` : "",
      ],
      button: "तुमची ऑर्डर ट्रॅक करा",
    }),
    delivered: (v) => ({
      subject: `ऑर्डर #${v.order} डिलिव्हर झाली – ${v.brand}`,
      lines: [`नमस्कार ${v.name}, तुमची ऑर्डर #${v.order} डिलिव्हर झाली आहे.`, `${v.brand} मधून खरेदी केल्याबद्दल धन्यवाद.`],
      button: "तुमची ऑर्डर पाहा",
    }),
    canceled: (v) => ({
      subject: `ऑर्डर #${v.order} रद्द झाली – ${v.brand}`,
      lines: [
        `नमस्कार ${v.name}, तुमची ऑर्डर #${v.order} रद्द केली आहे.`,
        v.refund ? `तुमच्या ${v.amount} चा परतावा सुरू झाला आहे. तो साधारणपणे 5–7 कामकाजाच्या दिवसांत तुमच्या खात्यात येतो.` : "तुम्हाला काहीही पैसे द्यायचे नाहीत.",
      ],
      button: "तुमची ऑर्डर पाहा",
    }),
  },
}

/**
 * SMS templates (DLT): {#var#} values are filled in order from `smsValues`.
 * Keep them short: one SMS is 160 English or 70 Devanagari characters.
 */
export const SMS: Record<Lang, Record<UpdateKind, string>> = {
  en: {
    placed: "Your {#var#} order {#var#} of Rs.{#var#} is placed. Details: {#var#}",
    shipped: "Your {#var#} order {#var#} is shipped. Track: {#var#}",
    delivered: "Your {#var#} order {#var#} is delivered. Thank you for shopping with us.",
    canceled: "Your {#var#} order {#var#} is cancelled. Details: {#var#}",
  },
  hi: {
    placed: "आपका {#var#} ऑर्डर {#var#} (Rs.{#var#}) हो गया है। विवरण: {#var#}",
    shipped: "आपका {#var#} ऑर्डर {#var#} भेज दिया गया है। ट्रैक करें: {#var#}",
    delivered: "आपका {#var#} ऑर्डर {#var#} डिलीवर हो गया है। धन्यवाद।",
    canceled: "आपका {#var#} ऑर्डर {#var#} रद्द हो गया है। विवरण: {#var#}",
  },
  mr: {
    placed: "तुमची {#var#} ऑर्डर {#var#} (Rs.{#var#}) नोंदवली आहे. तपशील: {#var#}",
    shipped: "तुमची {#var#} ऑर्डर {#var#} पाठवली आहे. ट्रॅक करा: {#var#}",
    delivered: "तुमची {#var#} ऑर्डर {#var#} डिलिव्हर झाली आहे. धन्यवाद.",
    canceled: "तुमची {#var#} ऑर्डर {#var#} रद्द झाली आहे. तपशील: {#var#}",
  },
}

/** Values for each SMS template, in the order of its {#var#} placeholders. */
export function smsValues(kind: UpdateKind, v: MessageValues): string[] {
  switch (kind) {
    case "placed":
      return [v.brand, `#${v.order}`, v.amount.replace(/[^\d.,]/g, ""), v.link]
    case "shipped":
      return [v.brand, `#${v.order}`, v.trackingUrl ?? v.link]
    case "delivered":
      return [v.brand, `#${v.order}`]
    case "canceled":
      return [v.brand, `#${v.order}`, v.link]
  }
}

/** Fills a template's {#var#} placeholders in order. */
export function fillTemplate(template: string, values: string[]): string {
  let i = 0
  return template.replace(/\{#var#\}/g, () => values[i++] ?? "")
}

/** Order language from its locale ("mr-IN" → "mr"); Marathi by default. */
export function langOf(locale: unknown): Lang {
  const l = String(locale ?? "").slice(0, 2).toLowerCase()
  return l === "hi" || l === "en" ? l : "mr"
}
