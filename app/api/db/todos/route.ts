import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import type { Prisma } from "@prisma/client"
import { notifyUser } from "@/lib/notifications-server"

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
const VALID_STATUS = new Set(["open", "in_progress", "done"])

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

      const dueRaw = body.dueAt
      const dueAt =
        dueRaw === null || dueRaw === undefined || dueRaw === ""
          ? null
          : new Date(String(dueRaw))

      const row = await prisma.erpTodo.create({
        data: {
          title,
          description: String(body.description ?? "").trim(),
          cadence,
          dueAt: dueAt && !Number.isNaN(dueAt.getTime()) ? dueAt : null,
          assigneeUserId,
          assigneeName,
          assignedBy: String(body.assignedBy ?? "").trim(),
          assignedById: body.assignedById ? String(body.assignedById).trim() : null,
          status: "open",
        },
        include: todoInclude,
      })

      try {
        await notifyUser(assigneeUserId, {
          title: "New to-do assigned",
          message: `${row.title} (${cadence})`,
          type: "info",
          link: "/todos",
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

      await prisma.erpTodoUpdate.create({
        data: {
          todoId: id,
          message,
          status,
          attachmentUrls: asJsonUrls(attachmentUrls),
          createdBy,
          createdByUserId,
        },
      })

      const row = await prisma.erpTodo.update({
        where: { id },
        data: {
          status,
          completedAt: status === "done" ? new Date() : null,
          completedBy: status === "done" ? createdBy : "",
        },
        include: todoInclude,
      })

      // Notify admin / assigner when assignee updates
      if (
        existing.assignedById &&
        createdByUserId &&
        existing.assignedById !== createdByUserId
      ) {
        try {
          await notifyUser(existing.assignedById, {
            title: status === "done" ? "To-do completed" : "To-do updated",
            message: `${existing.title} · ${existing.assigneeName}`,
            type: "info",
            link: "/todos",
          })
        } catch (notifyErr) {
          console.error("[todos] notify assigner failed", notifyErr)
        }
      }

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
