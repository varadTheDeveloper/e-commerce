"use client"

import { addToAccountWishlist, removeFromAccountWishlist } from "@lib/data/wishlist"
import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore } from "react"

// Wishlist of product handles.
// Guests: kept in this browser (localStorage). Storage can fail (private
// mode, blocked site data); the wishlist then lasts for this page view only.
// Logged-in customers: kept in their account; anything saved as a guest is
// added to the account on the first visit after login.

const KEY = "wishlist:v1"
const EVENT = "wishlist-change"
const MAX = 200

function readLocal(): string[] {
  try {
    const value = JSON.parse(window.localStorage.getItem(KEY) ?? "[]")
    return Array.isArray(value) ? value.filter((v) => typeof v === "string") : []
  } catch {
    return []
  }
}

let cache: string[] | null = null
const EMPTY: string[] = []

function writeLocal(handles: string[]) {
  try {
    if (handles.length) window.localStorage.setItem(KEY, JSON.stringify(handles.slice(0, MAX)))
    else window.localStorage.removeItem(KEY)
  } catch {
    // ignore: wishlist works for this page view only
  }
  cache = handles
  window.dispatchEvent(new Event(EVENT))
}

function subscribe(onChange: () => void) {
  const fromOtherTab = () => {
    cache = readLocal()
    onChange()
  }
  window.addEventListener(EVENT, onChange)
  window.addEventListener("storage", fromOtherTab)
  return () => {
    window.removeEventListener(EVENT, onChange)
    window.removeEventListener("storage", fromOtherTab)
  }
}

function snapshot(): string[] {
  if (cache === null) cache = readLocal()
  return cache
}

type Wishlist = {
  handles: string[]
  has: (handle: string) => boolean
  toggle: (handle: string) => void
  /** True when saved in the customer account (synced across devices) */
  inAccount: boolean
}

const WishlistContext = createContext<Wishlist | null>(null)

export function WishlistProvider({
  loggedIn,
  initial,
  children,
}: {
  loggedIn: boolean
  /** Account wishlist from the server (null for guests) */
  initial: string[] | null
  children: React.ReactNode
}) {
  const local = useSyncExternalStore(subscribe, snapshot, () => EMPTY)
  const [account, setAccount] = useState<string[]>(initial ?? [])
  // New list from the server (after login or a refresh): take it, while rendering
  const [lastInitial, setLastInitial] = useState(initial)
  if (initial !== lastInitial) {
    setLastInitial(initial)
    setAccount(initial ?? [])
  }

  // First visit after login: move the browser wishlist into the account
  useEffect(() => {
    if (!loggedIn) return
    const guest = readLocal()
    if (!guest.length) return
    addToAccountWishlist(guest)
      .then((handles) => {
        if (handles) setAccount(handles)
        writeLocal([])
      })
      .catch(() => {})
  }, [loggedIn])

  const toggle = useCallback(
    (handle: string) => {
      if (!loggedIn) {
        const current = snapshot()
        writeLocal(current.includes(handle) ? current.filter((h) => h !== handle) : [handle, ...current])
        return
      }
      const removing = account.includes(handle)
      setAccount((prev) => (removing ? prev.filter((h) => h !== handle) : [handle, ...prev]))
      const action = removing ? removeFromAccountWishlist(handle) : addToAccountWishlist([handle])
      action.then((handles) => handles && setAccount(handles)).catch(() => setAccount((prev) => prev))
    },
    [loggedIn, account]
  )

  const handles = loggedIn ? account : local
  const value = useMemo(
    () => ({ handles, has: (h: string) => handles.includes(h), toggle, inAccount: loggedIn }),
    [handles, toggle, loggedIn]
  )
  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>
}

export function useWishlist(): Wishlist {
  const value = useContext(WishlistContext)
  if (!value) {
    throw new Error("useWishlist must be used inside <WishlistProvider>")
  }
  return value
}
