/* Voltrix PWA service worker — install + phone notifications */
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
    data = { title: event.data ? event.data.text() : "Voltrix" }
  }

  const title = data.title || "Voltrix"
  const options = {
    body: data.message || data.body || "",
    icon: "/android-chrome-192x192.png",
    badge: "/favicon-32x32.png",
    tag: data.tag || `voltrix-${Date.now()}`,
    data: { url: data.link || data.url || "/" },
    vibrate: [80, 40, 80],
    requireInteraction: false,
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const url = event.notification.data && event.notification.data.url
    ? event.notification.data.url
    : "/"
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.focus()
          if (url && "navigate" in client) {
            return client.navigate(url)
          }
          return client
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url)
    }),
  )
})
