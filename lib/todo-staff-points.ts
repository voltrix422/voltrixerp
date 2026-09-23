import { prisma } from "@/lib/db"
import { notifyUser } from "@/lib/notifications-server"

type StaffWarning = {
  level: 0 | 1 | 2 | 3
  message: string
  date: string
  pointsAtWarning: number
}

function warningLevel(points: number): 0 | 1 | 2 | 3 {
  if (points <= 20) return 3
  if (points <= 50) return 2
  if (points <= 70) return 1
  return 0
}

function warningMessage(level: 0 | 1 | 2 | 3, points: number): string {
  if (level === 1) {
    return `First Warning: Your performance points have decreased to ${points}. Please improve your work performance to avoid further disciplinary action.`
  }
  if (level === 2) {
    return `Second Warning: Your points are now at ${points}. This is a serious concern. Immediate improvement is required.`
  }
  if (level === 3) {
    return `Final Warning: Your points have reached a critical level (${points}). HR will contact you for a formal review.`
  }
  return ""
}

function parseWarnings(raw: unknown): StaffWarning[] {
  if (!Array.isArray(raw)) return []
  return raw.map((w) => {
    const row = (w && typeof w === "object" ? w : {}) as Record<string, unknown>
    const levelRaw = Number(row.level) || 0
    const level = (levelRaw === 1 || levelRaw === 2 || levelRaw === 3 ? levelRaw : 0) as 0 | 1 | 2 | 3
    return {
      level,
      message: String(row.message || ""),
      date: String(row.date || ""),
      pointsAtWarning: Number(row.pointsAtWarning) || 0,
    }
  })
}

export async function findStaffForErpUser(userId: string) {
  if (!userId) return null
  const byLink = await prisma.erpStaff.findFirst({ where: { erpUserId: userId } })
  if (byLink) return byLink
  const user = await prisma.erpUser.findUnique({
    where: { id: userId },
    select: { email: true },
  })
  const email = user?.email?.trim()
  if (!email) return null
  return prisma.erpStaff.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
  })
}

export type StaffPointsChange = {
  staffId: string
  staffName: string
  oldPoints: number
  newPoints: number
  delta: number
}

async function applyStaffPointDelta(
  userId: string,
  delta: number,
  notify?: { title: string; message: string; type?: "info" | "warning" | "success" | "error" },
): Promise<StaffPointsChange | null> {
  if (!userId || !delta) return null
  const staff = await findStaffForErpUser(userId)
  if (!staff) return null

  const oldPoints = Number(staff.points) || 100
  const newPoints = Math.max(0, Math.min(100, oldPoints + delta))
  if (newPoints === oldPoints) {
    return { staffId: staff.id, staffName: staff.name, oldPoints, newPoints, delta: 0 }
  }

  const warnings = parseWarnings(staff.warnings)
  const oldLevel = warningLevel(oldPoints)
  const newLevel = warningLevel(newPoints)
  if (delta < 0 && newLevel > oldLevel && newLevel > 0) {
    warnings.push({
      level: newLevel,
      message: warningMessage(newLevel, newPoints),
      date: new Date().toISOString(),
      pointsAtWarning: newPoints,
    })
  }

  await prisma.erpStaff.update({
    where: { id: staff.id },
    data: { points: newPoints, warnings },
  })

  if (notify) {
    try {
      await notifyUser(userId, {
        title: notify.title,
        message: notify.message,
        type: notify.type || (delta < 0 ? "warning" : "info"),
        link: "/todos",
      })
    } catch (err) {
      console.error("[todo-staff-points] notify failed", err)
    }
  }

  return {
    staffId: staff.id,
    staffName: staff.name,
    oldPoints,
    newPoints,
    delta: newPoints - oldPoints,
  }
}

export async function deductLateTodoPoints(
  userId: string,
  points: number,
  todoTitle: string,
): Promise<StaffPointsChange | null> {
  const amount = Math.max(0, Math.round(points))
  if (!amount) return null
  return applyStaffPointDelta(userId, -amount, {
    title: "Late to-do — points deducted",
    message: `${todoTitle} · −${amount} performance point${amount === 1 ? "" : "s"}`,
    type: "warning",
  })
}

export async function restoreLateTodoPoints(
  userId: string,
  points: number,
  todoTitle: string,
  reason: string,
): Promise<StaffPointsChange | null> {
  const amount = Math.max(0, Math.round(points))
  if (!amount) return null
  return applyStaffPointDelta(userId, amount, {
    title: "To-do points restored",
    message: `${todoTitle} · +${amount} · ${reason}`,
    type: "success",
  })
}
