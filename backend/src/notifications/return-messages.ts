import { Lang } from "./messages"

// Emails about return and exchange requests, in Marathi, Hindi and English.
// (Email only: SMS would need more DLT templates.)

export type ReturnKind = "requested" | "approved" | "rejected" | "received" | "refunded"

export type ReturnValues = {
  brand: string
  name: string
  order: string
  exchange: boolean
  amount: string
  /** COD refunds: where the money goes, masked */
  refundTo?: string
  /** Online payment refunded through Razorpay */
  online: boolean
  rejectReason?: string
  pickupAwb?: string
}

type Email = { subject: string; lines: string[]; button: string }

export const RETURN_EMAILS: Record<Lang, Record<ReturnKind, (v: ReturnValues) => Email>> = {
  en: {
    requested: (v) => ({
      subject: `${v.exchange ? "Exchange" : "Return"} request for order #${v.order} – ${v.brand}`,
      lines: [`Hello ${v.name}, we have received your ${v.exchange ? "exchange" : "return"} request for order #${v.order}.`, "We will check it and let you know soon."],
      button: "View your order",
    }),
    approved: (v) => ({
      subject: `${v.exchange ? "Exchange" : "Return"} approved for order #${v.order} – ${v.brand}`,
      lines: [
        `Hello ${v.name}, your ${v.exchange ? "exchange" : "return"} for order #${v.order} is approved.`,
        "A courier will pick up the item from your address. Please keep it packed, with its tags.",
        v.pickupAwb ? `Pickup tracking number: ${v.pickupAwb}.` : "",
      ],
      button: "View your order",
    }),
    rejected: (v) => ({
      subject: `About your request for order #${v.order} – ${v.brand}`,
      lines: [`Hello ${v.name}, we could not accept your request for order #${v.order}.`, v.rejectReason ? `Reason: ${v.rejectReason}` : ""],
      button: "View your order",
    }),
    received: (v) => ({
      subject: `We received your item – order #${v.order} – ${v.brand}`,
      lines: [
        `Hello ${v.name}, we have received the item you sent back from order #${v.order}.`,
        v.exchange
          ? "Your new size will be shipped soon."
          : v.online
            ? `Your refund of ${v.amount} has been started. It usually reaches your account in 5–7 working days.`
            : `We will send ${v.amount} to ${v.refundTo ?? "your account"} within 3 working days.`,
      ],
      button: "View your order",
    }),
    refunded: (v) => ({
      subject: `Refund sent – order #${v.order} – ${v.brand}`,
      lines: [`Hello ${v.name}, we have sent your refund of ${v.amount} to ${v.refundTo ?? "your account"}.`],
      button: "View your order",
    }),
  },
  hi: {
    requested: (v) => ({
      subject: `ऑर्डर #${v.order} के लिए ${v.exchange ? "एक्सचेंज" : "रिटर्न"} अनुरोध – ${v.brand}`,
      lines: [`नमस्ते ${v.name}, हमें ऑर्डर #${v.order} के लिए आपका ${v.exchange ? "एक्सचेंज" : "रिटर्न"} अनुरोध मिल गया है।`, "हम इसे जाँचकर जल्द ही आपको बताएँगे।"],
      button: "अपना ऑर्डर देखें",
    }),
    approved: (v) => ({
      subject: `ऑर्डर #${v.order} का ${v.exchange ? "एक्सचेंज" : "रिटर्न"} मंज़ूर – ${v.brand}`,
      lines: [
        `नमस्ते ${v.name}, ऑर्डर #${v.order} के लिए आपका ${v.exchange ? "एक्सचेंज" : "रिटर्न"} मंज़ूर हो गया है।`,
        "कूरियर आपके पते से सामान ले जाएगा। कृपया उसे टैग के साथ पैक करके रखें।",
        v.pickupAwb ? `पिकअप ट्रैकिंग नंबर: ${v.pickupAwb}।` : "",
      ],
      button: "अपना ऑर्डर देखें",
    }),
    rejected: (v) => ({
      subject: `ऑर्डर #${v.order} के अनुरोध के बारे में – ${v.brand}`,
      lines: [`नमस्ते ${v.name}, हम ऑर्डर #${v.order} के लिए आपका अनुरोध स्वीकार नहीं कर सके।`, v.rejectReason ? `कारण: ${v.rejectReason}` : ""],
      button: "अपना ऑर्डर देखें",
    }),
    received: (v) => ({
      subject: `हमें आपका सामान मिल गया – ऑर्डर #${v.order} – ${v.brand}`,
      lines: [
        `नमस्ते ${v.name}, ऑर्डर #${v.order} से आपका लौटाया हुआ सामान हमें मिल गया है।`,
        v.exchange
          ? "आपका नया साइज़ जल्द ही भेजा जाएगा।"
          : v.online
            ? `आपके ${v.amount} का रिफ़ंड शुरू हो गया है। यह आम तौर पर 5–7 कामकाजी दिनों में आपके खाते में आ जाता है।`
            : `हम 3 कामकाजी दिनों में ${v.amount} ${v.refundTo ?? "आपके खाते"} में भेज देंगे।`,
      ],
      button: "अपना ऑर्डर देखें",
    }),
    refunded: (v) => ({
      subject: `रिफ़ंड भेज दिया गया – ऑर्डर #${v.order} – ${v.brand}`,
      lines: [`नमस्ते ${v.name}, हमने आपका ${v.amount} का रिफ़ंड ${v.refundTo ?? "आपके खाते"} में भेज दिया है।`],
      button: "अपना ऑर्डर देखें",
    }),
  },
  mr: {
    requested: (v) => ({
      subject: `ऑर्डर #${v.order} साठी ${v.exchange ? "एक्सचेंज" : "रिटर्न"} विनंती – ${v.brand}`,
      lines: [`नमस्कार ${v.name}, ऑर्डर #${v.order} साठी तुमची ${v.exchange ? "एक्सचेंज" : "रिटर्न"} विनंती आम्हाला मिळाली आहे.`, "आम्ही ती तपासून लवकरच तुम्हाला कळवू."],
      button: "तुमची ऑर्डर पाहा",
    }),
    approved: (v) => ({
      subject: `ऑर्डर #${v.order} चे ${v.exchange ? "एक्सचेंज" : "रिटर्न"} मंजूर – ${v.brand}`,
      lines: [
        `नमस्कार ${v.name}, ऑर्डर #${v.order} साठी तुमचे ${v.exchange ? "एक्सचेंज" : "रिटर्न"} मंजूर झाले आहे.`,
        "कुरिअर तुमच्या पत्त्यावरून वस्तू घेऊन जाईल. कृपया ती टॅगसह पॅक करून ठेवा.",
        v.pickupAwb ? `पिकअप ट्रॅकिंग नंबर: ${v.pickupAwb}.` : "",
      ],
      button: "तुमची ऑर्डर पाहा",
    }),
    rejected: (v) => ({
      subject: `ऑर्डर #${v.order} च्या विनंतीबद्दल – ${v.brand}`,
      lines: [`नमस्कार ${v.name}, ऑर्डर #${v.order} साठीची तुमची विनंती आम्ही स्वीकारू शकलो नाही.`, v.rejectReason ? `कारण: ${v.rejectReason}` : ""],
      button: "तुमची ऑर्डर पाहा",
    }),
    received: (v) => ({
      subject: `तुमची वस्तू आम्हाला मिळाली – ऑर्डर #${v.order} – ${v.brand}`,
      lines: [
        `नमस्कार ${v.name}, ऑर्डर #${v.order} मधून परत पाठवलेली वस्तू आम्हाला मिळाली आहे.`,
        v.exchange
          ? "तुमचा नवीन साइज लवकरच पाठवला जाईल."
          : v.online
            ? `तुमच्या ${v.amount} चा परतावा सुरू झाला आहे. तो साधारणपणे 5–7 कामकाजाच्या दिवसांत तुमच्या खात्यात येतो.`
            : `आम्ही 3 कामकाजाच्या दिवसांत ${v.amount} ${v.refundTo ?? "तुमच्या खात्यात"} पाठवू.`,
      ],
      button: "तुमची ऑर्डर पाहा",
    }),
    refunded: (v) => ({
      subject: `परतावा पाठवला – ऑर्डर #${v.order} – ${v.brand}`,
      lines: [`नमस्कार ${v.name}, आम्ही तुमचा ${v.amount} चा परतावा ${v.refundTo ?? "तुमच्या खात्यात"} पाठवला आहे.`],
      button: "तुमची ऑर्डर पाहा",
    }),
  },
}
