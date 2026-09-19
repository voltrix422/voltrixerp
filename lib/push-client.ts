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
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

export async function registerVoltrixServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return null
  try {
    return await navigator.serviceWorker.register("/sw.js", { scope: "/" })
  } catch {
    return null
  }
}

export async function subscribeUserToPush(userId: string) {
  if (!userId || typeof window === "undefined") return false
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || typeof Notification === "undefined") {
    return false
  }

  const permission =
    Notification.permission === "granted"
      ? "granted"
      : await Notification.requestPermission()
  if (permission !== "granted") return false

  const registration = (await navigator.serviceWorker.ready.catch(() => null)) || (await registerVoltrixServiceWorker())
  if (!registration) return false

  const vapidRes = await fetch("/api/push/vapid")
  const vapid = (await vapidRes.json().catch(() => ({}))) as { publicKey?: string }
  if (!vapid.publicKey) return false

  let subscription = await registration.pushManager.getSubscription()
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapid.publicKey),
    })
  }

  const json = subscription.toJSON()
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
  return res.ok
}
