"use server"

import { sdk } from "@lib/config"
import medusaError from "@lib/util/medusa-error"
import { HttpTypes } from "@medusajs/types"
import { getCacheOptions } from "./cookies"

export const listRegions = async () => {
  const next = {
    ...(await getCacheOptions("regions")),
  }

  return sdk.client
    .fetch<{ regions: HttpTypes.StoreRegion[] }>(`/store/regions`, {
      method: "GET",
      next,
      cache: "force-cache",
    })
    .then(({ regions }) => regions)
    .catch(medusaError)
}

export const retrieveRegion = async (id: string) => {
  const next = {
    ...(await getCacheOptions(["regions", id].join("-"))),
  }

  return sdk.client
    .fetch<{ region: HttpTypes.StoreRegion }>(`/store/regions/${id}`, {
      method: "GET",
      next,
      cache: "force-cache",
    })
    .then(({ region }) => region)
    .catch(medusaError)
}

const DEFAULT_COUNTRY = (process.env.NEXT_PUBLIC_DEFAULT_REGION || "in").toLowerCase()

/**
 * The store sells in one region (India). The argument is the page language
 * and is ignored; it is kept so callers can stay unchanged.
 */
export const getRegion = async (_locale?: string) => {
  try {
    const regions = await listRegions()
    return (
      regions?.find((r) =>
        r.countries?.some((c) => c?.iso_2 === DEFAULT_COUNTRY)
      ) ??
      regions?.[0] ??
      null
    )
  } catch {
    return null
  }
}
