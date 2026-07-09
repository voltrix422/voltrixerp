import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

type AdvanceTransaction = {
  id: string
  type: "deposit" | "expense"
  amount: number
  date: string
  description: string
  receiptUrl: string
  receiptName: string
  createdBy: string
  createdAt: string
}

function parseTransactions(raw: unknown): AdvanceTransaction[] {
  if (!Array.isArray(raw)) return []
  return raw.map((t, index) => ({
    id: String((t as AdvanceTransaction).id ?? `txn-${index}`),
    type: (t as AdvanceTransaction).type === "expense" ? "expense" : "deposit",
    amount: Number((t as AdvanceTransaction).amount) || 0,
    date: String((t as AdvanceTransaction).date ?? ""),
    description: String((t as AdvanceTransaction).description ?? ""),
    receiptUrl: String((t as AdvanceTransaction).receiptUrl ?? ""),
    receiptName: String((t as AdvanceTransaction).receiptName ?? ""),
    createdBy: String((t as AdvanceTransaction).createdBy ?? ""),
    createdAt: String((t as AdvanceTransaction).createdAt ?? new Date().toISOString()),
  }))
}

function computeTotals(transactions: AdvanceTransaction[]) {
  const totalDeposited = transactions
    .filter(t => t.type === "deposit")
    .reduce((sum, t) => sum + t.amount, 0)
  const totalSpent = transactions
    .filter(t => t.type === "expense")
    .reduce((sum, t) => sum + t.amount, 0)
  return { totalDeposited, totalSpent, balance: totalDeposited - totalSpent }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const purchaseScopeId = (searchParams.get("scope") || "").trim().toUpperCase()
  const rows = await prisma.erpAdvanceAccount.findMany({
    where: purchaseScopeId ? { purchaseScopeId } : undefined,
    orderBy: { createdAt: "desc" },
  })
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  try {
    return await handlePost(req)
  } catch (error) {
    console.error("Advance account save failed:", error)
    const message = error instanceof Error ? error.message : "Failed to save advance account"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

async function handlePost(req: NextRequest) {
  const body = await req.json()

  if (body.action === "addTransaction") {
    const existing = await prisma.erpAdvanceAccount.findUnique({ where: { id: body.id } })
    if (!existing) return NextResponse.json({ error: "Account not found" }, { status: 404 })

    const txn = body.transaction ?? {}
    const amount = Number(txn.amount) || 0
    if (amount <= 0) return NextResponse.json({ error: "Amount must be greater than zero" }, { status: 400 })

    const transactions = parseTransactions(existing.transactions)
    transactions.push({
      id: txn.id || Date.now().toString(),
      type: txn.type === "expense" ? "expense" : "deposit",
      amount,
      date: txn.date || new Date().toISOString().slice(0, 10),
      description: txn.description || "",
      receiptUrl: txn.receiptUrl || "",
      receiptName: txn.receiptName || "",
      createdBy: txn.createdBy || "",
      createdAt: new Date().toISOString(),
    })

    const row = await prisma.erpAdvanceAccount.update({
      where: { id: body.id },
      data: { transactions, ...computeTotals(transactions) },
    })
    return NextResponse.json(row)
  }

  if (body.action === "deleteTransaction") {
    const existing = await prisma.erpAdvanceAccount.findUnique({ where: { id: body.id } })
    if (!existing) return NextResponse.json({ error: "Account not found" }, { status: 404 })

    const transactions = parseTransactions(existing.transactions)
      .filter(t => t.id !== String(body.transactionId))

    const row = await prisma.erpAdvanceAccount.update({
      where: { id: body.id },
      data: { transactions, ...computeTotals(transactions) },
    })
    return NextResponse.json(row)
  }

  const personName = String(body.personName || "").trim()
  if (!personName) return NextResponse.json({ error: "Person name is required" }, { status: 400 })

  const data = {
    purchaseScopeId: String(body.purchaseScopeId || "P1").trim().toUpperCase(),
    personName,
    purpose: String(body.purpose || ""),
    notes: String(body.notes || ""),
    status: body.status === "closed" ? "closed" : "open",
  }

  if (body.id) {
    const row = await prisma.erpAdvanceAccount.update({ where: { id: body.id }, data })
    return NextResponse.json(row)
  }

  const transactions: AdvanceTransaction[] = []
  const initialDeposit = Number(body.initialDeposit) || 0
  if (initialDeposit > 0) {
    transactions.push({
      id: Date.now().toString(),
      type: "deposit",
      amount: initialDeposit,
      date: new Date().toISOString().slice(0, 10),
      description: "Initial deposit",
      receiptUrl: "",
      receiptName: "",
      createdBy: String(body.createdBy || ""),
      createdAt: new Date().toISOString(),
    })
  }

  const row = await prisma.erpAdvanceAccount.create({
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
  await prisma.erpAdvanceAccount.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
