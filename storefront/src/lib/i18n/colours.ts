import { Locale } from "./config"

// Colour option values stored in Medusa are these keys (see backend catalogue).
// Unknown keys fall back to showing the key itself with a grey swatch.
export const COLOURS: Record<
  string,
  { hex: string; name: Record<Locale, string> }
> = {
  black: { hex: "#22232a", name: { en: "Black", hi: "काला", mr: "काळा" } },
  white: { hex: "#f7f7f5", name: { en: "White", hi: "सफ़ेद", mr: "पांढरा" } },
  navy: { hex: "#1f2d4f", name: { en: "Navy", hi: "नेवी", mr: "नेव्ही" } },
  "sky-blue": { hex: "#8fb8de", name: { en: "Sky blue", hi: "आसमानी", mr: "आकाशी" } },
  olive: { hex: "#6b7046", name: { en: "Olive", hi: "ऑलिव", mr: "ऑलिव्ह" } },
  beige: { hex: "#d9c7a7", name: { en: "Beige", hi: "बेज", mr: "बेज" } },
  maroon: { hex: "#6e1f2e", name: { en: "Maroon", hi: "मैरून", mr: "मरून" } },
  mustard: { hex: "#d0a02a", name: { en: "Mustard", hi: "सरसों पीला", mr: "मोहरी" } },
  "royal-blue": { hex: "#2747a3", name: { en: "Royal blue", hi: "रॉयल ब्लू", mr: "रॉयल ब्लू" } },
  indigo: { hex: "#2c3a63", name: { en: "Indigo", hi: "इंडिगो", mr: "इंडिगो" } },
  pink: { hex: "#e8a3b5", name: { en: "Pink", hi: "गुलाबी", mr: "गुलाबी" } },
  teal: { hex: "#1f7a7a", name: { en: "Teal", hi: "टील", mr: "टील" } },
  red: { hex: "#b3262e", name: { en: "Red", hi: "लाल", mr: "लाल" } },
  lavender: { hex: "#b9a7d9", name: { en: "Lavender", hi: "लैवेंडर", mr: "लव्हेंडर" } },
  grey: { hex: "#8d9096", name: { en: "Grey", hi: "स्लेटी", mr: "राखाडी" } },
  yellow: { hex: "#f2c94c", name: { en: "Yellow", hi: "पीला", mr: "पिवळा" } },
}

export function colourName(key: string, locale: Locale): string {
  return COLOURS[key]?.name[locale] ?? key
}

export function colourHex(key: string): string {
  return COLOURS[key]?.hex ?? "#c4c4c4"
}
