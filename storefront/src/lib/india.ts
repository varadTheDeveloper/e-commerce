// Indian states and union territories, in English (as couriers expect).
export const INDIAN_STATES = [
  "Andaman and Nicobar Islands",
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chandigarh",
  "Chhattisgarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jammu and Kashmir",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Ladakh",
  "Lakshadweep",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Puducherry",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
] as const

export const PINCODE = /^[1-9]\d{5}$/
export const MOBILE = /^[6-9]\d{9}$/

/** "+91 98765 43210" → "9876543210" */
export function localMobile(phone?: string | null): string {
  return (phone ?? "").replace(/\D/g, "").replace(/^91(?=\d{10}$)/, "")
}

/** "+919822012345" → "+91 98220 12345" */
export function formatMobile(phone?: string | null): string {
  const m = localMobile(phone)
  return m.length === 10 ? `+91 ${m.slice(0, 5)} ${m.slice(5)}` : phone ?? ""
}
