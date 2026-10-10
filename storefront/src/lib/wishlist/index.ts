"use client"

import { useCallback, useSyncExternalStore } from "react"

// Wishlist kept in this browser (product handles). Moves to the customer
// account when login arrives in Step 3. Storage can fail (private mode,
// blocked site data); the wishlist then simply starts empty.

const KEY = "wishlist:v1"
const EVENT = "wishlist-change"
const MAX = 200

function read(): string[] {
  try {
    const value = JSON.parse(window.localStorage.getItem(KEY) ?? "[]")
    return Array.isArray(value) ? value.filter((v) => typeof v === "string") : []
  } catch {
    return []
  }
}

function write(handles: string[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(handles.slice(0, MAX)))
  } catch {
    // ignore: wishlist works for this page view only
  }
  cache = handles
  window.dispatchEvent(new Event(EVENT))
}

let cache: string[] | null = null
const EMPTY: string[] = []

function subscribe(onChange: () => void) {
  const handler = () => {
    cache = read()
    onChange()
  }
  window.addEventListener(EVENT, onChange)
  window.addEventListener("storage", handler)
  return () => {
    window.removeEventListener(EVENT, onChange)
    window.removeEventListener("storage", handler)
  }
}

function snapshot(): string[] {
  if (cache === null) cache = read()
  return cache
}

export function useWishlist() {
  const handles = useSyncExternalStore(subscribe, snapshot, () => EMPTY)
  const toggle = useCallback((handle: string) => {
    const current = snapshot()
    write(current.includes(handle) ? current.filter((h) => h !== handle) : [handle, ...current])
  }, [])
  return { handles, has: (handle: string) => handles.includes(handle), toggle }
}
