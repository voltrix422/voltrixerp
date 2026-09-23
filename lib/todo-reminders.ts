import { prisma } from "@/lib/db"
import { notifyUser } from "@/lib/notifications-server"

const TZ = "Asia/Karachi"
const RECURRING = new Set(["daily", "weekly", "monthly"])

type PkParts = {
  dateKey: string
  minutes: number
  year: number
  month: number
  day: number
}

function pkParts(date = new Date()): PkParts {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
  const map: Record<string, string> = {}
  for (const part of fmt.formatToParts(date)) {
    if (part.type !== "literal") map[part.type] = part.value
  }
  return {
    dateKey: `${map.year}-${map.month}-${map.day}`,
    minutes: Number(map.hour) * 60 + Number(map.minute),
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
  }
}

function isoWeekKey(year: number, month: number, day: number) {
  const utc = new Date(Date.UTC(year, month - 1, day))
  const dayNum = utc.getUTCDay() || 7
  utc.setUTCDate(utc.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((utc.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${utc.getUTCFullYear()}-W${String(week).padStart(2, "0")}`
}

function periodKey(cadence: string, parts: PkParts) {
  if (cadence === "weekly") return isoWeekKey(parts.year, parts.month, parts.day)
  if (cadence === "monthly") return `${parts.year}-${String(parts.month).padStart(2, "0")}`
  return parts.dateKey
}

export function parseReminderHm(value: unknown): string {
  const raw = String(value ?? "").trim()
  const match = /^(\d{1,2}):(\d{2})$/.exec(raw)
  if (!match) return ""
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || hour > 23 || minute > 59) return ""
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
}

function reminderMinutes(hhmm: string) {
  const parsed = parseReminderHm(hhmm)
  if (!parsed) return null
  const [h, m] = parsed.split(":").map(Number)
  return h * 60 + m
}

export function reminderAlreadyDueToday(hhmm: string) {
  const due = reminderMinutes(hhmm)
  if (due === null) return false
  return pkParts().minutes >= due
}

let lastRunMs = 0
const THROTTLE_MS = 20_000

export async function processTodoRecurrenceAndReminders() {
  const now = Date.now()
  if (now - lastRunMs < THROTTLE_MS) return { skipped: true, reopened: 0, reminded: 0 }
  lastRunMs = now

  const nowPk = pkParts()
  const rows = await prisma.erpTodo.findMany({
    where: { cadence: { in: ["daily", "weekly", "monthly"] } },
    select: {
      id: true,
      title: true,
      cadence: true,
      status: true,
      assigneeUserId: true,
      completedAt: true,
      reminderTime: true,
      lastRemindedAt: true,
    },
  })

  let reopened = 0
  let reminded = 0

  for (const row of rows) {
    if (!RECURRING.has(row.cadence)) continue
    const currentPeriod = periodKey(row.cadence, nowPk)

    if (row.status === "done" && row.completedAt) {
      const donePeriod = periodKey(row.cadence, pkParts(row.completedAt))
      if (donePeriod !== currentPeriod) {
        await prisma.erpTodo.update({
          where: { id: row.id },
          data: {
            status: "open",
            completedAt: null,
            completedBy: "",
            submittedAt: null,
            approvedAt: null,
            approvedBy: "",
            approvedById: null,
            latePenaltyPoints: 0,
            latePenaltyAt: null,
            extendedAt: null,
            extendedBy: "",
          },
        })
        reopened += 1
        row.status = "open"
      }
    }

    if (row.status === "done") continue

    const dueMins = reminderMinutes(row.reminderTime)
    if (dueMins === null || nowPk.minutes < dueMins) continue

    const lastPeriod = row.lastRemindedAt
      ? periodKey(row.cadence, pkParts(row.lastRemindedAt))
      : ""
    if (lastPeriod === currentPeriod) continue

    await prisma.erpTodo.update({
      where: { id: row.id },
      data: { lastRemindedAt: new Date() },
    })

    try {
      const when = parseReminderHm(row.reminderTime)
      await notifyUser(row.assigneeUserId, {
        title: "Recurring task reminder",
        message: `${row.title} · ${row.cadence}${when ? ` · ${when}` : ""}`,
        type: "info",
        link: "/todos",
      })
      reminded += 1
    } catch (err) {
      console.error("[todo-remind] notify failed", row.id, err)
    }
  }

  return { skipped: false, reopened, reminded }
}
