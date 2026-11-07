"use client"

/**
 * Lightweight same-browser live sync (BroadcastChannel + same-tab CustomEvent).
 * Does not replace polling; only pushes UI patches after successful saves.
 */

export type ErpLiveEvent =
  | {
      type: "client-updated"
      clientId: string
      name: string
      company?: string
      phone?: string
      email?: string
      address?: string
      city?: string
    }
  | { type: "orders-changed"; reason?: string }

const CHANNEL = "voltrix-erp-live"
const DOM_EVENT = "voltrix-erp-live"

let channel: BroadcastChannel | null = null

function getChannel() {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") return null
  if (!channel) channel = new BroadcastChannel(CHANNEL)
  return channel
}

export function publishErpLive(event: ErpLiveEvent) {
  if (typeof window === "undefined") return
  try {
    getChannel()?.postMessage(event)
  } catch {
    // ignore
  }
  try {
    window.dispatchEvent(new CustomEvent(DOM_EVENT, { detail: event }))
  } catch {
    // ignore
  }
}

export function subscribeErpLive(handler: (event: ErpLiveEvent) => void): () => void {
  if (typeof window === "undefined") return () => {}

  const onMessage = (e: MessageEvent) => {
    if (e?.data && typeof e.data === "object" && "type" in e.data) {
      handler(e.data as ErpLiveEvent)
    }
  }
  const onDom = (e: Event) => {
    const detail = (e as CustomEvent).detail
    if (detail && typeof detail === "object" && "type" in detail) {
      handler(detail as ErpLiveEvent)
    }
  }

  const ch = getChannel()
  ch?.addEventListener("message", onMessage)
  window.addEventListener(DOM_EVENT, onDom)

  return () => {
    ch?.removeEventListener("message", onMessage)
    window.removeEventListener(DOM_EVENT, onDom)
  }
}
