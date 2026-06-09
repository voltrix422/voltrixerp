export type NotificationType = "info" | "warning" | "success" | "error"

export interface AppNotification {
  id: string
  userId: string
  title: string
  message: string
  type: NotificationType
  link: string
  read: boolean
  createdAt: string
}

export async function fetchNotifications(userId: string): Promise<AppNotification[]> {
  const res = await fetch(`/api/notifications?userId=${encodeURIComponent(userId)}`)
  if (!res.ok) return []
  return res.json()
}

export async function fetchUnreadCount(userId: string): Promise<number> {
  const res = await fetch(`/api/notifications/count?userId=${encodeURIComponent(userId)}`)
  if (!res.ok) return 0
  const data = await res.json()
  return data.count ?? 0
}

export async function markNotificationRead(id: string): Promise<void> {
  await fetch("/api/notifications", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  })
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  await fetch("/api/notifications", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, all: true }),
  })
}
