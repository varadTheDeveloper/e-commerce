import { isEmpty } from "./isEmpty"

type ConvertToLocaleParams = {
  amount: number
  currency_code: string
  minimumFractionDigits?: number
  maximumFractionDigits?: number
  locale?: string
}

export const convertToLocale = ({
  amount,
  currency_code,
  minimumFractionDigits,
  maximumFractionDigits,
  // en-IN gives Indian grouping (₹1,29,999) with Latin digits in every language.
  locale = "en-IN",
}: ConvertToLocaleParams) => {
  const whole = Number.isInteger(amount)
  return currency_code && !isEmpty(currency_code)
    ? new Intl.NumberFormat(locale, {
        style: "currency",
        currency: currency_code,
        minimumFractionDigits: minimumFractionDigits ?? (whole ? 0 : 2),
        maximumFractionDigits: maximumFractionDigits ?? (whole ? 0 : 2),
      }).format(amount)
    : amount.toString()
}

/** ₹1,299 */
export const formatINR = (amount: number) =>
  convertToLocale({ amount, currency_code: "inr" })
