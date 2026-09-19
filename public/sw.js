/* Voltrix PWA service worker — install + lock-screen notifications */
self.addEventListener("install", (event) => {
  self.skipWaiting()
  event.waitUntil(Promise.resolve())
})

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener("push", (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { title: event.data ? event.data.text() : "Voltrix ERP" }
  }

  const origin = self.location.origin
  const title = data.title || "Voltrix ERP"
  const options = {
    body: data.message || data.body || "New ERP notification",
    icon: origin + "/android-chrome-192x192.png",
    badge: origin + "/favicon-32x32.png",
    tag: data.tag || ("voltrix-" + Date.now()),
    data: { url: data.link || data.url || "/dashboard" },
    vibrate: [160, 80, 160],
    renotify: true,
    requireInteraction: true,
    timestamp: Date.now(),
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const target = event.notification.data && event.notification.data.url
    ? event.notification.data.url
    : "/dashboard"
  const url = target.startsWith("http") ? target : self.location.origin + target
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.focus()
          if ("navigate" in client) return client.navigate(url)
          return client
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url)
    }),
  )
})
