import { prisma } from "@/lib/db"

type PushPayload = {
  title: string
  message?: string
  link?: string
  tag?: string
}

function vapidKeys() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY || ""
  const privateKey = process.env.VAPID_PRIVATE_KEY || ""
  const subject =
    process.env.VAPID_SUBJECT ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "mailto:hello@voltrixbatteries.com"
  return { publicKey, privateKey, subject }
}

export function getVapidPublicKey() {
  return vapidKeys().publicKey
}

export async function sendPushToUser(userId: string, payload: PushPayload) {
  const { publicKey, privateKey, subject } = vapidKeys()
  if (!publicKey || !privateKey) return

  const rows = await prisma.erpPushSubscription.findMany({ where: { userId } })
  if (!rows.length) return

  const mod = await import("web-push")
  const webpush = (mod.default || mod) as typeof import("web-push")
  const mailto = subject.startsWith("mailto:") || subject.startsWith("http") ? subject : `mailto:${subject}`
  webpush.setVapidDetails(mailto, publicKey, privateKey)

  const body = JSON.stringify({
    title: payload.title,
    message: payload.message || "",
    link: payload.link || "/",
    tag: payload.tag || `erp-${Date.now()}`,
  })

  await Promise.all(
    rows.map(async (row) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: row.endpoint,
            keys: { p256dh: row.p256dh, auth: row.auth },
          },
          body,
        )
      } catch (error) {
        const status = Number((error as { statusCode?: number }).statusCode || 0)
        if (status === 404 || status === 410) {
          await prisma.erpPushSubscription.delete({ where: { id: row.id } }).catch(() => {})
        }
      }
    }),
  )
}
