// Draws the demo product pictures (flat garment illustrations, one per colour).
// They stand in for real photos until the brand uploads its own.
// Output: backend/static/demo/<garment>-<colour>.webp (served at /static/demo/...).
// Run from the repo root:  npx -y -p sharp@0.34 node backend/demo-images/generate.mjs
import { mkdirSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { createRequire } from "node:module"

const require = createRequire(import.meta.url)
const sharp = require("sharp")

const here = dirname(fileURLToPath(import.meta.url))
const outDir = join(here, "..", "static", "demo")
mkdirSync(outDir, { recursive: true })

// Colour keys must match storefront/src/lib/i18n/colours.ts
export const COLOURS = {
  black: "#22232a",
  white: "#f7f7f5",
  navy: "#1f2d4f",
  "sky-blue": "#8fb8de",
  olive: "#6b7046",
  beige: "#d9c7a7",
  maroon: "#6e1f2e",
  mustard: "#d0a02a",
  "royal-blue": "#2747a3",
  indigo: "#2c3a63",
  pink: "#e8a3b5",
  teal: "#1f7a7a",
  red: "#b3262e",
  lavender: "#b9a7d9",
  grey: "#8d9096",
  yellow: "#f2c94c",
}

const GARMENTS = {
  tshirt: {
    body: "M300 170 Q400 235 500 170 L610 205 L730 315 L660 395 L600 345 L600 840 L200 840 L200 345 L140 395 L70 315 L190 205 Z",
    extra: (s) => `
      <path d="M300 170 Q400 235 500 170" fill="none" stroke="${s}" stroke-width="14" stroke-linecap="round"/>
      <path d="M210 820 L590 820" stroke="${s}" stroke-width="3" stroke-dasharray="10 8" fill="none"/>
      <path d="M150 380 L95 320 M650 380 L705 320" stroke="${s}" stroke-width="3" stroke-dasharray="8 7" fill="none"/>`,
  },
  shirt: {
    body: "M310 160 L400 215 L490 160 L610 200 L700 330 L705 700 L640 705 L605 400 L600 850 L200 850 L195 400 L160 705 L95 700 L100 330 L190 200 Z",
    extra: (s) => `
      <path d="M310 160 L400 215 L360 265 L300 190 Z M490 160 L400 215 L440 265 L500 190 Z" fill="rgba(255,255,255,0.18)" stroke="${s}" stroke-width="4"/>
      <path d="M400 215 L400 850" stroke="${s}" stroke-width="4"/>
      ${[300, 400, 500, 600, 700, 800].map((y) => `<circle cx="412" cy="${y}" r="7" fill="${s}"/>`).join("")}
      <rect x="230" y="330" width="110" height="105" rx="6" fill="none" stroke="${s}" stroke-width="3" stroke-dasharray="8 6"/>
      <path d="M95 680 L160 685 M640 685 L705 680" stroke="${s}" stroke-width="5"/>`,
  },
  kurta: {
    body: "M325 150 L400 180 L475 150 L600 190 L690 320 L700 640 L640 645 L605 390 L610 930 L190 930 L195 390 L160 645 L100 640 L110 320 L200 190 Z",
    extra: (s) => `
      <path d="M330 150 Q400 200 470 150" fill="none" stroke="${s}" stroke-width="12"/>
      <path d="M400 180 L400 470" stroke="${s}" stroke-width="5"/>
      ${[230, 300, 370, 440].map((y) => `<circle cx="400" cy="${y}" r="8" fill="${s}"/>`).join("")}
      <path d="M195 760 L195 930 M605 760 L605 930" stroke="rgba(255,255,255,0.6)" stroke-width="6"/>
      <path d="M200 905 L600 905" stroke="${s}" stroke-width="3" stroke-dasharray="10 8"/>`,
  },
  jeans: {
    body: "M255 140 L545 140 L575 930 L425 930 L400 380 L375 930 L225 930 Z",
    extra: (s) => `
      <path d="M255 190 L545 190" stroke="${s}" stroke-width="4"/>
      <path d="M400 190 L400 380" stroke="${s}" stroke-width="4"/>
      <path d="M400 200 Q440 290 400 340" fill="none" stroke="${s}" stroke-width="3" stroke-dasharray="8 6"/>
      <path d="M265 200 Q320 270 360 200 M535 200 Q480 270 440 200" fill="none" stroke="${s}" stroke-width="4"/>
      ${[285, 345, 455, 515].map((x) => `<rect x="${x - 6}" y="138" width="12" height="56" rx="3" fill="${s}"/>`).join("")}
      <circle cx="400" cy="166" r="9" fill="#c9a04a"/>
      <path d="M232 900 L372 900 M428 900 L568 900" stroke="${s}" stroke-width="3" stroke-dasharray="9 7"/>`,
  },
  dress: {
    body: "M320 130 L345 130 L360 210 Q400 235 440 210 L455 130 L480 130 L500 250 L490 420 L640 900 L160 900 L310 420 L300 250 Z",
    extra: (s) => `
      <path d="M305 420 Q400 445 495 420" fill="none" stroke="${s}" stroke-width="10"/>
      <path d="M330 470 L250 880 M400 470 L400 890 M470 470 L550 880" stroke="${s}" stroke-width="3" opacity="0.5"/>
      <path d="M170 875 Q400 915 630 875" fill="none" stroke="${s}" stroke-width="3" stroke-dasharray="10 8"/>`,
  },
  hoodie: {
    body: "M290 190 L250 120 Q400 40 550 120 L510 190 L620 215 L720 350 L725 720 L650 725 L610 420 L610 850 L190 850 L190 420 L150 725 L75 720 L80 350 L180 215 Z",
    extra: (s) => `
      <path d="M290 190 Q400 290 510 190 Q400 110 290 190 Z" fill="rgba(0,0,0,0.22)" stroke="${s}" stroke-width="4"/>
      <path d="M370 250 L365 380 M430 250 L435 380" stroke="#e8e8e8" stroke-width="6" stroke-linecap="round"/>
      <path d="M270 600 L530 600 L570 760 L230 760 Z" fill="none" stroke="${s}" stroke-width="5"/>
      <path d="M190 815 L610 815" stroke="${s}" stroke-width="6"/>
      <path d="M75 690 L150 695 M650 695 L725 690" stroke="${s}" stroke-width="6"/>`,
  },
  joggers: {
    body: "M265 140 L535 140 L560 860 L575 920 L440 920 L440 860 L400 370 L360 860 L360 920 L225 920 L240 860 Z",
    extra: (s) => `
      <path d="M265 200 L535 200" stroke="${s}" stroke-width="5"/>
      <path d="M385 200 Q375 260 365 290 M415 200 Q425 260 435 290" fill="none" stroke="#e8e8e8" stroke-width="6" stroke-linecap="round"/>
      <path d="M240 860 L360 860 M440 860 L560 860" stroke="${s}" stroke-width="6"/>
      <path d="M275 215 L300 420 M525 215 L500 420" stroke="${s}" stroke-width="3" stroke-dasharray="8 6"/>`,
  },
}

function shade(hex, amount) {
  const n = parseInt(hex.slice(1), 16)
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) =>
    Math.max(0, Math.min(255, Math.round(v + amount)))
  )
  return `rgb(${c.join(",")})`
}

function svg(garment, colour, scale = 1) {
  const g = GARMENTS[garment]
  const fill = COLOURS[colour]
  const light = parseInt(fill.slice(1), 16) > 0xd0d0d0
  const stroke = light ? shade(fill, -45) : shade(fill, -35)
  const t = `translate(${400 - 400 * scale} ${500 - 500 * scale}) scale(${scale})`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000" viewBox="0 0 800 1000">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#f6f3ee"/><stop offset="1" stop-color="#ebe6de"/>
    </linearGradient>
    <linearGradient id="sheen" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#000" stop-opacity="0.16"/>
      <stop offset="0.35" stop-color="#fff" stop-opacity="0.10"/>
      <stop offset="0.65" stop-color="#fff" stop-opacity="0.04"/>
      <stop offset="1" stop-color="#000" stop-opacity="0.18"/>
    </linearGradient>
  </defs>
  <rect width="800" height="1000" fill="url(#bg)"/>
  <ellipse cx="400" cy="955" rx="260" ry="18" fill="#000" opacity="0.07"/>
  <g transform="${t}">
    <path d="${g.body}" fill="${fill}" stroke="${stroke}" stroke-width="4" stroke-linejoin="round"/>
    <path d="${g.body}" fill="url(#sheen)"/>
    ${g.extra(stroke)}
  </g>
</svg>`
}

// Every garment/colour pair used by the demo catalogue (backend/src/scripts/data/catalogue.ts)
const PAIRS = {
  tshirt: ["black", "white", "navy", "lavender", "yellow", "sky-blue"],
  shirt: ["white", "sky-blue", "olive", "beige"],
  kurta: ["white", "maroon", "mustard", "royal-blue", "pink", "teal"],
  jeans: ["indigo", "black"],
  dress: ["red", "navy"],
  hoodie: ["grey", "black"],
  joggers: ["black", "grey"],
}

for (const [garment, colours] of Object.entries(PAIRS)) {
  for (const colour of colours) {
    // Main picture, plus a close-up as the second picture
    await sharp(Buffer.from(svg(garment, colour))).webp({ quality: 82 }).toFile(join(outDir, `${garment}-${colour}.webp`))
    await sharp(Buffer.from(svg(garment, colour, 1.45))).webp({ quality: 82 }).toFile(join(outDir, `${garment}-${colour}-detail.webp`))
  }
}
console.log("Demo images written to", outDir)
