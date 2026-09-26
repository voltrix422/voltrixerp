import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import type { Prisma } from "@prisma/client"
import { isErpAdmin } from "@/lib/auth"
import { notifyUser } from "@/lib/notifications-server"
import { parseReminderHm, reminderAlreadyDueToday } from "@/lib/todo-reminders"
import { latePenaltyAmount, parseTodoDueAt } from "@/lib/todo-due"
import { deductLateTodoPoints, restoreLateTodoPoints } from "@/lib/todo-staff-points"

function parseUrls(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((u) => String(u ?? "").trim()).filter(Boolean)
}

function asJsonUrls(value: unknown): Prisma.InputJsonValue {
  return parseUrls(value) as unknown as Prisma.InputJsonValue
}

const todoInclude = {
  updates: { orderBy: { createdAt: "desc" as const } },
} as const

const VALID_CADENCE = new Set(["daily", "weekly", "monthly", "once"])
const VALID_STATUS = new Set(["open", "in_progress", "pending_approval", "done"])

type Actor = { id: string; name: string; role: string }

async function loadActor(userId: unknown): Promise<Actor | null> {
  const id = String(userId ?? "").trim()
  if (!id) return null
  const user = await prisma.erpUser.findUnique({
    where: { id },
    select: { id: true, name: true, role: true },
  })
  return user
}

function actorIsAdmin(actor: Actor | null) {
  return !!actor && isErpAdmin(actor.role)
}

async function addActivity(
  todoId: string,
  status: string,
  message: string,
  createdBy: string,
  createdByUserId: string | null,
) {
  await prisma.erpTodoUpdate.create({
    data: {
      todoId,
      message,
      status,
      attachmentUrls: [] as unknown as Prisma.InputJsonValue,
      createdBy,
      createdByUserId,
    },
  })
}

type LateMeta = {
  applied: boolean
  points: number
  oldPoints?: number
  newPoints?: number
  waived?: boolean
}

async function applyLateIfNeeded(
  existing: { id: string; title: string; dueAt: Date | null; assigneeUserId: string; latePenaltyPoints: number },
  at: Date,
): Promise<{ points: number; at: Date | null; meta: LateMeta }> {
  if (existing.latePenaltyPoints > 0) {
    return {
      points: existing.latePenaltyPoints,
      at: null,
      meta: { applied: false, points: existing.latePenaltyPoints },
    }
  }
  const amount = latePenaltyAmount(existing.dueAt, at)
  if (amount <= 0) {
    return { points: 0, at: null, meta: { applied: false, points: 0 } }
  }
  const change = await deductLateTodoPoints(existing.assigneeUserId, amount, existing.title)
  if (!change) {
    return {
      points: 0,
      at: null,
      meta: { applied: false, points: amount },
    }
  }
  return {
    points: Math.abs(change.delta) || amount,
    at,
    meta: {
      applied: change.delta < 0,
      points: Math.abs(change.delta) || amount,
      oldPoints: change.oldPoints,
      newPoints: change.newPoints,
    },
  }
}

async function waiveLateIfApplied(
  existing: { id: string; title: string; assigneeUserId: string; latePenaltyPoints: number },
  reason: string,
): Promise<{ waived: boolean; meta: LateMeta }> {
  if (existing.latePenaltyPoints <= 0) {
    return { waived: false, meta: { applied: false, points: 0, waived: false } }
  }
  const change = await restoreLateTodoPoints(
    existing.assigneeUserId,
    existing.latePenaltyPoints,
    existing.title,
    reason,
  )
  return {
    waived: !!change && change.delta > 0,
    meta: {
      applied: false,
      points: existing.latePenaltyPoints,
      waived: !!change && change.delta > 0,
      oldPoints: change?.oldPoints,
      newPoints: change?.newPoints,
    },
  }
}

function withLate(row: unknown, latePenalty?: LateMeta) {
  return latePenalty ? { ...(row as object), latePenalty } : row
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get("userId")?.trim() || ""
  const status = searchParams.get("status")?.trim() || ""

  try {
    const rows = await prisma.erpTodo.findMany({
      where: {
        ...(userId ? { assigneeUserId: userId } : {}),
        ...(status ? { status } : {}),
      },
      include: todoInclude,
      orderBy: [{ status: "asc" }, { dueAt: "asc" }, { assignedAt: "desc" }],
    })
    return NextResponse.json(rows)
  } catch (err) {
    console.error("[todos GET]", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load todos" },
      { status: 500 },
    )
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const action = String(body.action ?? "").trim().toLowerCase()

  try {
    if (action === "create") {
      const title = String(body.title ?? "").trim()
      const assigneeUserId = String(body.assigneeUserId ?? "").trim()
      const assigneeName = String(body.assigneeName ?? "").trim()
      const cadence = String(body.cadence ?? "once").trim().toLowerCase()
      if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 })
      if (!assigneeUserId || !assigneeName) {
        return NextResponse.json({ error: "Assignee is required" }, { status: 400 })
      }
      if (!VALID_CADENCE.has(cadence)) {
        return NextResponse.json({ error: "Invalid cadence" }, { status: 400 })
      }

      const dueAt = parseTodoDueAt(body.dueAt)
      const reminderTime = cadence === "once" ? "" : parseReminderHm(body.reminderTime)

      const row = await prisma.erpTodo.create({
        data: {
          title,
          description: String(body.description ?? "").trim(),
          cadence,
          dueAt,
          assigneeUserId,
          assigneeName,
          assignedBy: String(body.assignedBy ?? "").trim(),
          assignedById: body.assignedById ? String(body.assignedById).trim() : null,
          reminderTime,
          lastRemindedAt: reminderTime && reminderAlreadyDueToday(reminderTime) ? new Date() : null,
          status: "open",
        },
        include: todoInclude,
      })

      try {
        await notifyUser(assigneeUserId, {
          title: cadence === "once" ? "New to-do assigned" : "Recurring to-do assigned",
          message: reminderTime
            ? `${row.title} (${cadence}) · reminder ${reminderTime}`
            : `${row.title} (${cadence})`,
          type: "info",
          link: `/todos?todo=${row.id}`,
        })
      } catch (notifyErr) {
        console.error("[todos] notify failed", notifyErr)
      }

      return NextResponse.json(row, { status: 201 })
    }

    if (action === "update") {
      const id = String(body.id ?? "").trim()
      if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 })
      const status = String(body.status ?? "in_progress").trim().toLowerCase()
      if (!VALID_STATUS.has(status)) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 })
      }

      const existing = await prisma.erpTodo.findUnique({ where: { id } })
      if (!existing) return NextResponse.json({ error: "Todo not found" }, { status: 404 })

      const message = String(body.message ?? "").trim()
      const attachmentUrls = parseUrls(body.attachmentUrls)
      const createdBy = String(body.createdBy ?? "").trim()
      const createdByUserId = body.createdByUserId
        ? String(body.createdByUserId).trim()
        : null
      const actor = await loadActor(createdByUserId)
      const admin = actorIsAdmin(actor)

      let nextStatus = status
      if (status === "done" && !admin) {
        nextStatus = "pending_approval"
      }

      const now = new Date()
      const becomingSubmit =
        nextStatus === "pending_approval" && existing.status !== "pending_approval"
      const becomingDone = nextStatus === "done" && existing.status !== "done"
      const leavingSubmit =
        existing.status === "pending_approval" &&
        nextStatus !== "pending_approval" &&
        nextStatus !== "done"

      let lateMeta: LateMeta | undefined
      let latePenaltyPoints = existing.latePenaltyPoints
      let latePenaltyAt = existing.latePenaltyAt

      if (leavingSubmit && existing.latePenaltyPoints > 0) {
        const waived = await waiveLateIfApplied(existing, "Submission withdrawn")
        lateMeta = waived.meta
        latePenaltyPoints = 0
        latePenaltyAt = null
      }

      if ((becomingSubmit || becomingDone) && existing.latePenaltyPoints === 0 && latePenaltyPoints === 0) {
        const late = await applyLateIfNeeded(existing, now)
        latePenaltyPoints = late.points
        latePenaltyAt = late.at
        lateMeta = late.meta
      }

      await prisma.erpTodoUpdate.create({
        data: {
          todoId: id,
          message:
            message ||
            (becomingSubmit
              ? latePenaltyPoints > 0
                ? `Submitted for approval (late · −${latePenaltyPoints} points)`
                : "Submitted for approval"
              : ""),
          status: nextStatus,
          attachmentUrls: asJsonUrls(attachmentUrls),
          createdBy,
          createdByUserId,
        },
      })

      const row = await prisma.erpTodo.update({
        where: { id },
        data: {
          status: nextStatus,
          completedAt: nextStatus === "done" ? now : null,
          completedBy: nextStatus === "done" ? createdBy : "",
          submittedAt: becomingSubmit
            ? now
            : nextStatus === "open" || nextStatus === "in_progress"
              ? null
              : existing.submittedAt,
          approvedAt: nextStatus === "done" && admin ? now : nextStatus === "done" ? existing.approvedAt : null,
          approvedBy: nextStatus === "done" && admin ? (actor?.name || createdBy) : nextStatus === "done" ? existing.approvedBy : "",
          approvedById: nextStatus === "done" && admin ? actor?.id ?? null : nextStatus === "done" ? existing.approvedById : null,
          latePenaltyPoints,
          latePenaltyAt,
        },
        include: todoInclude,
      })

      if (becomingSubmit && existing.assignedById && createdByUserId !== existing.assignedById) {
        try {
          await notifyUser(existing.assignedById, {
            title: latePenaltyPoints > 0 ? "Late to-do submitted" : "To-do submitted for approval",
            message: `${existing.title} · ${existing.assigneeName}${
              latePenaltyPoints > 0 ? ` · −${latePenaltyPoints} pts` : ""
            }`,
            type: latePenaltyPoints > 0 ? "warning" : "info",
            link: `/todos?todo=${existing.id}`,
          })
        } catch (notifyErr) {
          console.error("[todos] notify assigner failed", notifyErr)
        }
      } else if (
        existing.assignedById &&
        createdByUserId &&
        existing.assignedById !== createdByUserId &&
        !becomingSubmit
      ) {
        try {
          await notifyUser(existing.assignedById, {
            title: nextStatus === "done" ? "To-do completed" : "To-do updated",
            message: `${existing.title} · ${existing.assigneeName}`,
            type: "info",
            link: `/todos?todo=${existing.id}`,
          })
        } catch (notifyErr) {
          console.error("[todos] notify assigner failed", notifyErr)
        }
      }

      return NextResponse.json(withLate(row, lateMeta))
    }

    if (action === "approve" || action === "reject" || action === "extend") {
      const id = String(body.id ?? "").trim()
      if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 })
      const actor = await loadActor(body.createdByUserId)
      if (!actorIsAdmin(actor)) {
        return NextResponse.json({ error: "Admin rights required" }, { status: 403 })
      }
      const existing = await prisma.erpTodo.findUnique({ where: { id } })
      if (!existing) return NextResponse.json({ error: "Todo not found" }, { status: 404 })

      const createdBy = String(body.createdBy ?? actor?.name ?? "").trim()
      const now = new Date()

      if (action === "extend") {
        const dueAt = parseTodoDueAt(body.dueAt)
        if (!dueAt) {
          return NextResponse.json({ error: "A new due date is required" }, { status: 400 })
        }
        const submittedAt = existing.submittedAt
        const stillLate = submittedAt ? submittedAt.getTime() > dueAt.getTime() : now.getTime() > dueAt.getTime()
        let lateMeta: LateMeta | undefined
        let latePenaltyPoints = existing.latePenaltyPoints
        let latePenaltyAt = existing.latePenaltyAt
        if (!stillLate && existing.latePenaltyPoints > 0) {
          const waived = await waiveLateIfApplied(existing, "Due date extended by admin")
          lateMeta = waived.meta
          latePenaltyPoints = 0
          latePenaltyAt = null
        }

        await addActivity(
          id,
          existing.status,
          `Due date extended to ${dueAt.toLocaleString("en-GB", { timeZone: "Asia/Karachi" })} PKT${
            latePenaltyPoints === 0 && existing.latePenaltyPoints > 0
              ? ` · late penalty waived (+${existing.latePenaltyPoints} pts)`
              : ""
          }`,
          createdBy,
          actor?.id ?? null,
        )

        const row = await prisma.erpTodo.update({
          where: { id },
          data: {
            dueAt,
            extendedAt: now,
            extendedBy: createdBy,
            latePenaltyPoints,
            latePenaltyAt,
          },
          include: todoInclude,
        })

        try {
          await notifyUser(existing.assigneeUserId, {
            title: "To-do due date extended",
            message: `${existing.title} · new due ${dueAt.toLocaleString("en-GB", { timeZone: "Asia/Karachi" })}`,
            type: "info",
            link: `/todos?todo=${existing.id}`,
          })
        } catch (notifyErr) {
          console.error("[todos] notify extend failed", notifyErr)
        }

        return NextResponse.json(withLate(row, lateMeta))
      }

      if (action === "reject") {
        const note = String(body.message ?? "").trim()
        const waived = await waiveLateIfApplied(existing, "Submission rejected")
        await addActivity(
          id,
          "in_progress",
          note || "Submission sent back by admin",
          createdBy,
          actor?.id ?? null,
        )
        const row = await prisma.erpTodo.update({
          where: { id },
          data: {
            status: "in_progress",
            submittedAt: null,
            completedAt: null,
            completedBy: "",
            approvedAt: null,
            approvedBy: "",
            approvedById: null,
            latePenaltyPoints: 0,
            latePenaltyAt: null,
          },
          include: todoInclude,
        })
        try {
          await notifyUser(existing.assigneeUserId, {
            title: "To-do sent back",
            message: note ? `${existing.title} · ${note}` : existing.title,
            type: "warning",
            link: `/todos?todo=${existing.id}`,
          })
        } catch (notifyErr) {
          console.error("[todos] notify reject failed", notifyErr)
        }
        return NextResponse.json(withLate(row, waived.meta))
      }

      const late = await applyLateIfNeeded(
        existing,
        existing.submittedAt || now,
      )
      await addActivity(
        id,
        "done",
        String(body.message ?? "").trim() || "Approved by admin",
        createdBy,
        actor?.id ?? null,
      )
      const row = await prisma.erpTodo.update({
        where: { id },
        data: {
          status: "done",
          completedAt: now,
          completedBy: createdBy,
          submittedAt: existing.submittedAt || now,
          approvedAt: now,
          approvedBy: createdBy,
          approvedById: actor?.id ?? null,
          latePenaltyPoints: late.points || existing.latePenaltyPoints,
          latePenaltyAt: late.at || existing.latePenaltyAt,
        },
        include: todoInclude,
      })
      try {
        await notifyUser(existing.assigneeUserId, {
          title: "To-do approved",
          message:
            late.points > 0 && late.meta.applied
              ? `${existing.title} · approved · −${late.points} late points`
              : existing.title,
          type: "success",
          link: `/todos?todo=${existing.id}`,
        })
      } catch (notifyErr) {
        console.error("[todos] notify approve failed", notifyErr)
      }
      return NextResponse.json(withLate(row, late.meta))
    }

    if (action === "set_reminder") {
      const id = String(body.id ?? "").trim()
      if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 })
      const existing = await prisma.erpTodo.findUnique({ where: { id } })
      if (!existing) return NextResponse.json({ error: "Todo not found" }, { status: 404 })
      if (existing.cadence === "once") {
        return NextResponse.json({ error: "Reminders are for recurring tasks" }, { status: 400 })
      }
      const reminderTime = parseReminderHm(body.reminderTime)
      const row = await prisma.erpTodo.update({
        where: { id },
        data: { reminderTime },
        include: todoInclude,
      })
      return NextResponse.json(row)
    }

    if (action === "delete") {
      const id = String(body.id ?? "").trim()
      if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 })
      await prisma.erpTodo.delete({ where: { id } })
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 })
  } catch (err) {
    console.error("[todos POST]", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Todo action failed" },
      { status: 500 },
    )
  }
}
