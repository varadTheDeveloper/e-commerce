// Body measurements in inches for each size chart named in product metadata
// (metadata.size_chart). Demo values: replace with the brand's real charts.

export type MeasureKey = "chest" | "waist" | "hip" | "length" | "shoulder" | "inseam"

export type SizeChart = {
  columns: MeasureKey[]
  rows: { size: string; values: number[] }[]
}

export const SIZE_CHARTS: Record<string, SizeChart> = {
  "men-top": {
    columns: ["chest", "length", "shoulder"],
    rows: [
      { size: "S", values: [38, 27, 17] },
      { size: "M", values: [40, 28, 17.5] },
      { size: "L", values: [42, 29, 18] },
      { size: "XL", values: [44, 30, 18.5] },
      { size: "XXL", values: [46, 31, 19] },
    ],
  },
  "men-bottom": {
    columns: ["waist", "hip", "inseam"],
    rows: [
      { size: "28", values: [28, 36, 30] },
      { size: "30", values: [30, 38, 31] },
      { size: "32", values: [32, 40, 31] },
      { size: "34", values: [34, 42, 32] },
      { size: "36", values: [36, 44, 32] },
    ],
  },
  "women-top": {
    columns: ["chest", "waist", "hip"],
    rows: [
      { size: "XS", values: [32, 26, 35] },
      { size: "S", values: [34, 28, 37] },
      { size: "M", values: [36, 30, 39] },
      { size: "L", values: [38, 32, 41] },
      { size: "XL", values: [40, 34, 43] },
      { size: "XXL", values: [42, 36, 45] },
    ],
  },
  "women-bottom": {
    columns: ["waist", "hip", "inseam"],
    rows: [
      { size: "XS", values: [26, 35, 27] },
      { size: "S", values: [28, 37, 27] },
      { size: "M", values: [30, 39, 27.5] },
      { size: "L", values: [32, 41, 27.5] },
      { size: "XL", values: [34, 43, 28] },
    ],
  },
  kids: {
    columns: ["chest", "length"],
    rows: [
      { size: "2-3Y", values: [21, 15] },
      { size: "4-5Y", values: [23, 17] },
      { size: "6-7Y", values: [25, 19] },
      { size: "8-9Y", values: [27, 21] },
    ],
  },
}
