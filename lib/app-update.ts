const VERSION_KEY = "voltrix-app-version"

export async function fetchAppVersion() {
  const res = await fetch("/api/app-version", { cache: "no-store" })
  const data = (await res.json().catch(() => ({}))) as { version?: string }
  return String(data.version || "").trim()
}

export function storedAppVersion() {
  if (typeof window === "undefined") return ""
  try {
    return localStorage.getItem(VERSION_KEY) || ""
  } catch {
    return ""
  }
}

export function rememberAppVersion(version: string) {
  if (typeof window === "undefined" || !version) return
  try {
    localStorage.setItem(VERSION_KEY, version)
  } catch {
    // ignore
  }
}

export async function registerAndWatchUpdates(onUpdate: () => void) {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return null

  const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" })
  await registration.update().catch(() => {})

  function noteWaiting(worker: ServiceWorker | null | undefined) {
    if (worker && navigator.serviceWorker.controller) onUpdate()
  }

  noteWaiting(registration.waiting)
  registration.addEventListener("updatefound", () => {
    const worker = registration.installing
    if (!worker) return
    worker.addEventListener("statechange", () => {
      if (worker.state === "installed") noteWaiting(registration.waiting || worker)
    })
  })

  return registration
}

export async function applyAppUpdate(registration?: ServiceWorkerRegistration | null) {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    window.location.reload()
    return
  }
  const waiting = registration?.waiting || (await navigator.serviceWorker.getRegistration())?.waiting
  if (waiting) {
    waiting.postMessage({ type: "SKIP_WAITING" })
    return
  }
  window.location.reload()
}
