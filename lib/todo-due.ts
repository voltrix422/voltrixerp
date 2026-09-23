const TZ = "Asia/Karachi"

/** datetime-local / date-only values are Pakistan time, not the VPS clock. */
export function parseTodoDueAt(raw: unknown): Date | null {
  if (raw === null || raw === undefined || raw === "") return null
  const s = String(raw).trim()
  if (!s) return null
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s)) {
    return new Date(`${s}:00+05:00`)
  }
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(s)) {
    return new Date(`${s}+05:00`)
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return new Date(`${s}T23:59:00+05:00`)
  }
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d
}

export function isoToDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
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
  for (const part of fmt.formatToParts(d)) {
    if (part.type !== "literal") map[part.type] = part.value
  }
  return `${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}`
}

export function lateCalendarDays(dueAt: Date, submittedAt: Date): number {
  if (submittedAt.getTime() <= dueAt.getTime()) return 0
  const ms = submittedAt.getTime() - dueAt.getTime()
  return Math.max(1, Math.ceil(ms / 86_400_000))
}

export function latePenaltyAmount(dueAt: Date | null | undefined, submittedAt: Date): number {
  if (!dueAt) return 0
  const days = lateCalendarDays(dueAt, submittedAt)
  if (days <= 0) return 0
  return Math.min(20, Math.max(5, days * 5))
}
