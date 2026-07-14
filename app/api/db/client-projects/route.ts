import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

type ProjectTxn = {
  id: string
  type: "receipt" | "expense"
  amount: number
  date: string
  description: string
  receiptUrl: string
  receiptName: string
  createdBy: string
  createdAt: string
}

function parseTransactions(raw: unknown): ProjectTxn[] {
  if (!Array.isArray(raw)) return []
  return raw.map((t, index) => ({
    id: String((t as ProjectTxn).id ?? `txn-${index}`),
    type: (t as ProjectTxn).type === "expense" ? "expense" : "receipt",
    amount: Number((t as ProjectTxn).amount) || 0,
    date: String((t as ProjectTxn).date ?? ""),
    description: String((t as ProjectTxn).description ?? ""),
    receiptUrl: String((t as ProjectTxn).receiptUrl ?? ""),
    receiptName: String((t as ProjectTxn).receiptName ?? ""),
    createdBy: String((t as ProjectTxn).createdBy ?? ""),
    createdAt: String((t as ProjectTxn).createdAt ?? new Date().toISOString()),
  }))
}

function computeTotals(transactions: ProjectTxn[]) {
  const totalReceived = transactions
    .filter((t) => t.type === "receipt")
    .reduce((sum, t) => sum + t.amount, 0)
  const totalExpenses = transactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + t.amount, 0)
  return {
    totalReceived,
    totalExpenses,
    profit: totalReceived - totalExpenses,
  }
}

function normalizeStatus(raw: unknown): string {
  if (raw === "completed" || raw === "cancelled") return raw
  return "open"
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const purchaseScopeId = (searchParams.get("scope") || "").trim().toUpperCase()
  const rows = await prisma.erpClientProject.findMany({
    where: purchaseScopeId ? { purchaseScopeId } : undefined,
    orderBy: { createdAt: "desc" },
  })
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  try {
    return await handlePost(req)
  } catch (error) {
    console.error("Client project save failed:", error)
    const message = error instanceof Error ? error.message : "Failed to save client project"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

async function handlePost(req: NextRequest) {
  const body = await req.json()

  if (body.action === "addTransaction") {
    const existing = await prisma.erpClientProject.findUnique({ where: { id: body.id } })
    if (!existing) return NextResponse.json({ error: "Project not found" }, { status: 404 })

    const txn = body.transaction ?? {}
    const amount = Number(txn.amount) || 0
    if (amount <= 0) {
      return NextResponse.json({ error: "Amount must be greater than zero" }, { status: 400 })
    }

    const transactions = parseTransactions(existing.transactions)
    transactions.push({
      id: txn.id || Date.now().toString(),
      type: txn.type === "expense" ? "expense" : "receipt",
      amount,
      date: txn.date || new Date().toISOString().slice(0, 10),
      description: txn.description || "",
      receiptUrl: txn.receiptUrl || "",
      receiptName: txn.receiptName || "",
      createdBy: txn.createdBy || "",
      createdAt: new Date().toISOString(),
    })

    const row = await prisma.erpClientProject.update({
      where: { id: body.id },
      data: { transactions, ...computeTotals(transactions) },
    })
    return NextResponse.json(row)
  }

  if (body.action === "deleteTransaction") {
    const existing = await prisma.erpClientProject.findUnique({ where: { id: body.id } })
    if (!existing) return NextResponse.json({ error: "Project not found" }, { status: 404 })

    const transactions = parseTransactions(existing.transactions).filter(
      (t) => t.id !== String(body.transactionId),
    )

    const row = await prisma.erpClientProject.update({
      where: { id: body.id },
      data: { transactions, ...computeTotals(transactions) },
    })
    return NextResponse.json(row)
  }

  const projectName = String(body.projectName || "").trim()
  if (!projectName) {
    return NextResponse.json({ error: "Project name is required" }, { status: 400 })
  }

  const data = {
    purchaseScopeId: String(body.purchaseScopeId || "P1").trim().toUpperCase(),
    projectName,
    clientName: String(body.clientName || "").trim(),
    clientPhone: String(body.clientPhone || "").trim(),
    budget: Math.max(0, Number(body.budget) || 0),
    notes: String(body.notes || ""),
    status: normalizeStatus(body.status),
  }

  if (body.id) {
    const row = await prisma.erpClientProject.update({ where: { id: body.id }, data })
    return NextResponse.json(row)
  }

  const transactions: ProjectTxn[] = []
  const initialReceived = Number(body.initialReceived) || 0
  if (initialReceived > 0) {
    transactions.push({
      id: Date.now().toString(),
      type: "receipt",
      amount: initialReceived,
      date: String(body.initialReceivedDate || "").trim() || new Date().toISOString().slice(0, 10),
      description: "Initial payment from client",
      receiptUrl: String(body.initialReceivedReceiptUrl || ""),
      receiptName: String(body.initialReceivedReceiptName || ""),
      createdBy: String(body.createdBy || ""),
      createdAt: new Date().toISOString(),
    })
  }

  const row = await prisma.erpClientProject.create({
    data: {
      ...data,
      transactions,
      ...computeTotals(transactions),
      createdBy: String(body.createdBy || ""),
    },
  })
  return NextResponse.json(row)
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  await prisma.erpClientProject.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
