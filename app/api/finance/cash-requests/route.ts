import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { notifyUsersByModule } from "@/lib/notifications-server"
import { isErpAdmin } from "@/lib/auth"
import {
  karachiToday,
  sanitizeCashText,
  type CashRequestLine,
} from "@/lib/finance-cash-requests"

function parseLines(raw: unknown): CashRequestLine[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
    .map((x, i) => ({
      id: String(x.id || `line-${i}`),
      description: String(x.description || "").trim(),
      amount: Number(x.amount) || 0,
    }))
    .filter((x) => x.description || x.amount > 0)
}

function mapRow(r: {
  id: string
  staffId: string | null
  userId: string
  requesterName: string
  requesterEmail: string
  department: string
  amount: number
  currency: string
  neededOn: string
  purpose: string
  category: string
  paymentMethod: string
  bankName: string
  bankAccountNumber: string
  bankAccountTitle: string
  location: string
  itemBreakdown: unknown
  notes: string
  attachmentUrl: string
  attachmentName: string
  status: string
  adminNotes: string
  adminAttachmentUrl?: string
  adminAttachmentName?: string
  reviewedBy: string
  reviewedByUserId: string | null
  reviewedAt: Date | null
  financeRecordId: string | null
  createdAt: Date
  updatedAt: Date
  staff?: { name: string } | null
}) {
  return {
    id: r.id,
    staffId: r.staffId,
    userId: r.userId,
    requesterName: r.requesterName,
    requesterEmail: r.requesterEmail,
    department: r.department,
    amount: r.amount,
    currency: r.currency,
    neededOn: r.neededOn,
    purpose: r.purpose,
    category: r.category,
    paymentMethod: r.paymentMethod,
    bankName: r.bankName,
    bankAccountNumber: r.bankAccountNumber,
    bankAccountTitle: r.bankAccountTitle,
    location: sanitizeCashText(r.location, 80),
    itemBreakdown: parseLines(r.itemBreakdown),
    notes: sanitizeCashText(r.notes, 400),
    attachmentUrl: r.attachmentUrl,
    attachmentName: r.attachmentName,
    status: r.status,
    adminNotes: r.adminNotes,
    adminAttachmentUrl: r.adminAttachmentUrl || "",
    adminAttachmentName: r.adminAttachmentName || "",
    reviewedBy: r.reviewedBy,
    reviewedByUserId: r.reviewedByUserId,
    reviewedAt: r.reviewedAt?.toISOString() ?? null,
    financeRecordId: r.financeRecordId,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    staffName: r.staff?.name || r.requesterName,
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const staffId = searchParams.get("staffId")?.trim()
    const userId = searchParams.get("userId")?.trim()
    const status = searchParams.get("status")?.trim()
    const neededOn = searchParams.get("neededOn")?.trim()
    const today = searchParams.get("today") === "1"
    const mine = searchParams.get("mine") === "1"

    const where: Record<string, unknown> = {}
    if (staffId) where.staffId = staffId
    if (userId) where.userId = userId
    if (status) where.status = status
    if (neededOn) where.neededOn = neededOn
    if (today) {
      const day = karachiToday()
      const start = new Date(`${day}T00:00:00+05:00`)
      where.OR = [{ neededOn: day }, { createdAt: { gte: start } }]
    }
    if (mine && userId) {
      where.OR = [{ userId }, ...(staffId ? [{ staffId }] : [])]
      delete where.userId
      delete where.staffId
    }

    const rows = await prisma.erpCashRequest.findMany({
      where,
      include: { staff: { select: { name: true } } },
      orderBy: [{ createdAt: "desc" }],
    })
    return NextResponse.json(rows.map(mapRow))
  } catch (error) {
    console.error("Error fetching cash requests:", error)
    return NextResponse.json({ error: "Failed to fetch cash requests" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const userId = String(body.userId || "").trim()
    const requesterName = String(body.requesterName || "").trim()
    const purpose = String(body.purpose || body.description || "").trim()
    const amount = Number(body.amount)
    const neededOn = /^\d{4}-\d{2}-\d{2}$/.test(String(body.neededOn || ""))
      ? String(body.neededOn)
      : karachiToday()
    const category = String(body.category || "Other").trim() || "Other"
    const paymentMethod = String(body.paymentMethod || "cash").trim() || "cash"
    let lines = parseLines(body.itemBreakdown).map((l) => ({
      ...l,
      description: l.description || purpose,
    }))
    if (lines.length === 0 && purpose && Number.isFinite(amount) && amount > 0) {
      lines = [{ id: "line-1", description: purpose, amount }]
    }

    if (!userId || !requesterName) {
      return NextResponse.json({ error: "Requester is required" }, { status: 400 })
    }
    if (!purpose) {
      return NextResponse.json({ error: "Description is required" }, { status: 400 })
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "Amount must be greater than zero" }, { status: 400 })
    }

    let staffId = String(body.staffId || "").trim() || null
    const email = String(body.requesterEmail || "").trim()
    if (!staffId && (userId || email)) {
      const staff = await prisma.erpStaff.findFirst({
        where: {
          OR: [
            { erpUserId: userId },
            ...(email ? [{ email: { equals: email, mode: "insensitive" as const } }] : []),
          ],
        },
        select: { id: true, department: true },
      })
      if (staff) staffId = staff.id
    }

    const created = await prisma.erpCashRequest.create({
      data: {
        staffId,
        userId,
        requesterName,
        requesterEmail: email,
        department: String(body.department || "").trim(),
        amount,
        currency: String(body.currency || "PKR"),
        neededOn,
        purpose,
        category,
        paymentMethod,
        bankName: String(body.bankName || "").trim(),
        bankAccountNumber: String(body.bankAccountNumber || "").trim(),
        bankAccountTitle: String(body.bankAccountTitle || "").trim(),
        location: sanitizeCashText(String(body.location || ""), 80),
        itemBreakdown: lines,
        notes: sanitizeCashText(String(body.notes || ""), 400),
        attachmentUrl: String(body.attachmentUrl || "").trim(),
        attachmentName: String(body.attachmentName || "").trim(),
        status: "pending",
      },
      include: { staff: { select: { name: true } } },
    })

    await notifyUsersByModule("finance", {
      title: "Cash request pending approval",
      message: `${requesterName} requested PKR ${amount.toLocaleString()} — ${purpose.slice(0, 80)}`,
      type: "warning",
      link: "/finance/approvals",
    }).catch(() => {})

    return NextResponse.json(mapRow(created), { status: 201 })
  } catch (error) {
    console.error("Error creating cash request:", error)
    return NextResponse.json({ error: "Failed to submit cash request" }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json()
    const id = String(body.id || "").trim()
    const action = String(body.action || "").trim()
    const reviewedBy = String(body.reviewedBy || "").trim()
    const reviewedByUserId = String(body.reviewedByUserId || "").trim() || null
    const adminNotes = String(body.adminNotes || "").trim()
    const actorRole = String(body.actorRole || "").trim()
    const adminAttachmentUrl = String(body.adminAttachmentUrl || "").trim()
    const adminAttachmentName = String(body.adminAttachmentName || "").trim()

    if (!id || (action !== "approve" && action !== "reject")) {
      return NextResponse.json({ error: "Invalid review action" }, { status: 400 })
    }
    if (!isErpAdmin(actorRole)) {
      return NextResponse.json({ error: "Only admin can approve or reject cash requests" }, { status: 403 })
    }
    if (!reviewedBy) {
      return NextResponse.json({ error: "Reviewer name is required" }, { status: 400 })
    }

    const existing = await prisma.erpCashRequest.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: "Request not found" }, { status: 404 })
    if (existing.status !== "pending") {
      return NextResponse.json({ error: "This request has already been reviewed" }, { status: 400 })
    }

    let financeRecordId: string | null = existing.financeRecordId
    if (action === "approve" && !financeRecordId) {
      const lines = parseLines(existing.itemBreakdown)
      const breakdown = lines.map((l) => `${l.description}: ${existing.currency} ${l.amount.toLocaleString()}`).join("\n")
      const record = await prisma.erpFinanceRecord.create({
        data: {
          title: `Cash request — ${existing.requesterName}`,
          amount: existing.amount,
          currency: existing.currency || "PKR",
          purpose: existing.purpose,
          category: "Expense",
          tag: "cash-request",
          supplier_name: "",
          receipt_person_name: existing.requesterName,
          petty_cash_allocation_id: "",
          petty_cash_receipt_id: "",
          petty_cash_label: "",
          proof_url: adminAttachmentUrl || existing.attachmentUrl,
          proof_name: adminAttachmentName || existing.attachmentName,
          notes: [
            `Needed on ${existing.neededOn}`,
            `Method: ${existing.paymentMethod}`,
            existing.location ? `Location: ${existing.location}` : "",
            breakdown,
            existing.notes,
            adminNotes ? `Admin: ${adminNotes}` : "",
          ]
            .filter(Boolean)
            .join("\n"),
          created_by: reviewedBy,
        },
      })
      financeRecordId = record.id
    }

    const updated = await prisma.erpCashRequest.update({
      where: { id },
      data: {
        status: action === "approve" ? "approved" : "rejected",
        adminNotes,
        adminAttachmentUrl,
        adminAttachmentName,
        reviewedBy,
        reviewedByUserId,
        reviewedAt: new Date(),
        financeRecordId,
      },
      include: { staff: { select: { name: true } } },
    })

    if (existing.userId) {
      const { notifyUser } = await import("@/lib/notifications-server")
      await notifyUser(existing.userId, {
        title: action === "approve" ? "Cash request approved" : "Cash request rejected",
        message:
          action === "approve"
            ? `Admin approved PKR ${existing.amount.toLocaleString()} for ${existing.neededOn}.`
            : `Admin rejected your cash request for ${existing.neededOn}.${adminNotes ? ` ${adminNotes}` : ""}`,
        type: action === "approve" ? "success" : "error",
        link: "/finance/cash-requests",
      }).catch(() => {})
    }

    return NextResponse.json(mapRow(updated))
  } catch (error) {
    console.error("Error reviewing cash request:", error)
    return NextResponse.json({ error: "Failed to review cash request" }, { status: 500 })
  }
}
