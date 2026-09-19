function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"))
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i)
  return output
}

export function isStandaloneApp() {
  if (typeof window === "undefined") return false
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone)
  )
}

export function isIosDevice() {
  if (typeof navigator === "undefined") return false
  return /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
}

export type PushSubscribeResult = {
  ok: boolean
  message: string
}

export async function registerVoltrixServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return null
  try {
    const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" })
    await registration.update().catch(() => {})
    return (await navigator.serviceWorker.ready.catch(() => null)) || registration
  } catch {
    return null
  }
}

export async function requestPushPermission() {
  if (typeof window === "undefined" || typeof Notification === "undefined") return "unsupported"
  if (Notification.permission === "granted") return "granted"
  if (Notification.permission === "denied") return "denied"
  try {
    return await Notification.requestPermission()
  } catch {
    return Notification.permission
  }
}

export async function subscribeUserToPush(userId: string): Promise<PushSubscribeResult> {
  if (!userId || typeof window === "undefined") {
    return { ok: false, message: "Sign in first." }
  }
  if (!("serviceWorker" in navigator) || typeof Notification === "undefined") {
    return { ok: false, message: "This phone browser cannot show app notifications." }
  }
  if (!("PushManager" in window)) {
    if (isIosDevice() && !isStandaloneApp()) {
      return { ok: false, message: "Open the installed Voltrix ERP app, then tap Test alert." }
    }
    return { ok: false, message: "Push notifications are not supported on this phone." }
  }

  const permission = await requestPushPermission()
  if (permission !== "granted") {
    return {
      ok: false,
      message:
        permission === "denied"
          ? "Notifications are blocked. Allow them for Voltrix ERP in phone settings, then try again."
          : "Allow notifications when the phone asks, then tap Test alert again.",
    }
  }

  const registration = await registerVoltrixServiceWorker()
  if (!registration?.pushManager) {
    return { ok: false, message: "Could not start the notification service. Close and reopen the ERP app." }
  }

  const vapidRes = await fetch("/api/push/vapid")
  const vapid = (await vapidRes.json().catch(() => ({}))) as { publicKey?: string }
  if (!vapid.publicKey) {
    return { ok: false, message: "Phone notification keys are missing on the server." }
  }

  const applicationServerKey = urlBase64ToUint8Array(vapid.publicKey)
  let subscription = await registration.pushManager.getSubscription()
  try {
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      })
    }
  } catch {
    try {
      await subscription?.unsubscribe()
    } catch {
      // ignore
    }
    try {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      })
    } catch {
      return { ok: false, message: "This phone refused the notification subscription. Open the installed ERP app and allow alerts." }
    }
  }

  const json = subscription.toJSON()
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    return { ok: false, message: "The phone did not return a valid notification subscription." }
  }

  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId,
      endpoint: json.endpoint,
      keys: json.keys,
      userAgent: navigator.userAgent,
    }),
  })
  if (!res.ok) return { ok: false, message: "Could not save this phone for lock-screen alerts." }
  return { ok: true, message: "This phone will get lock-screen alerts even when the app is closed." }
}
