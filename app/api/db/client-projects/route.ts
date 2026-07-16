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

  if (body.action === "syncFromLedger") {
    const purchaseScopeId = String(body.purchaseScopeId || "P1").trim().toUpperCase()
    const createdBy = String(body.createdBy || "")
    const ledgerRows = await prisma.erpPurchaseLedger.findMany({
      where: { purchaseScopeId, linkMode: "project" },
      select: { projectName: true },
    })
    const existing = await prisma.erpClientProject.findMany({
      where: { purchaseScopeId },
      select: { id: true, projectName: true },
    })
    const existingKeys = new Set(
      existing.map((p) => p.projectName.trim().toLowerCase().replace(/\s+/g, " ")).filter(Boolean),
    )
    const created: typeof existing = []
    const seen = new Set<string>()
    for (const row of ledgerRows) {
      const name = String(row.projectName || "").trim()
      if (!name) continue
      const key = name.toLowerCase().replace(/\s+/g, " ")
      if (existingKeys.has(key) || seen.has(key)) continue
      seen.add(key)
      const rowCreated = await prisma.erpClientProject.create({
        data: {
          purchaseScopeId,
          projectName: name,
          clientName: "",
          clientPhone: "",
          budget: 0,
          notes: "Imported from purchase ledger",
          status: "open",
          transactions: [],
          totalReceived: 0,
          totalExpenses: 0,
          profit: 0,
          createdBy,
        },
      })
      created.push({ id: rowCreated.id, projectName: rowCreated.projectName })
      existingKeys.add(key)
    }
    const rows = await prisma.erpClientProject.findMany({
      where: { purchaseScopeId },
      orderBy: { createdAt: "desc" },
    })
    return NextResponse.json({ createdCount: created.length, projects: rows })
  }

  if (body.action === "merge") {
    const targetId = String(body.targetId || "")
    const sourceIds = Array.isArray(body.sourceIds)
      ? body.sourceIds.map((id: unknown) => String(id)).filter((id: string) => id && id !== targetId)
      : []
    const canonicalName = String(body.canonicalName || "").trim()
    if (!targetId || sourceIds.length === 0) {
      return NextResponse.json(
        { error: "Select a target project and at least one project to merge in." },
        { status: 400 },
      )
    }

    const target = await prisma.erpClientProject.findUnique({ where: { id: targetId } })
    if (!target) return NextResponse.json({ error: "Target project not found" }, { status: 404 })

    const sources = await prisma.erpClientProject.findMany({ where: { id: { in: sourceIds } } })
    if (sources.length === 0) {
      return NextResponse.json({ error: "No source projects found" }, { status: 404 })
    }
    const wrongScope = sources.find((s) => s.purchaseScopeId !== target.purchaseScopeId)
    if (wrongScope) {
      return NextResponse.json({ error: "Projects must be in the same purchase scope" }, { status: 400 })
    }

    const finalName = canonicalName || target.projectName
    const oldNames = Array.from(
      new Set(
        [target.projectName, ...sources.map((s) => s.projectName)]
          .map((n) => n.trim())
          .filter(Boolean),
      ),
    )

    const transactions = [
      ...parseTransactions(target.transactions),
      ...sources.flatMap((s) => parseTransactions(s.transactions)),
    ]
    const clientName =
      String(target.clientName || "").trim() ||
      sources.map((s) => String(s.clientName || "").trim()).find(Boolean) ||
      ""
    const clientPhone =
      String(target.clientPhone || "").trim() ||
      sources.map((s) => String(s.clientPhone || "").trim()).find(Boolean) ||
      ""
    const notesParts = [target.notes, ...sources.map((s) => s.notes)]
      .map((n) => String(n || "").trim())
      .filter(Boolean)
    const notes = Array.from(new Set(notesParts)).join("\n")
    const budget = Math.max(
      Number(target.budget) || 0,
      ...sources.map((s) => Number(s.budget) || 0),
    )
    const status =
      target.status === "open" || sources.some((s) => s.status === "open")
        ? "open"
        : normalizeStatus(target.status)

    const updated = await prisma.erpClientProject.update({
      where: { id: targetId },
      data: {
        projectName: finalName,
        clientName,
        clientPhone,
        budget,
        notes,
        status,
        transactions,
        ...computeTotals(transactions),
      },
    })

    // Rewrite all matching ledger project names (case-insensitive) to the canonical name.
    const ledgerRows = await prisma.erpPurchaseLedger.findMany({
      where: {
        purchaseScopeId: target.purchaseScopeId,
        linkMode: "project",
      },
      select: { id: true, projectName: true },
    })
    const oldKeys = new Set(oldNames.map((n) => n.toLowerCase().replace(/\s+/g, " ")))
    const toRewrite = ledgerRows.filter((row) =>
      oldKeys.has(String(row.projectName || "").trim().toLowerCase().replace(/\s+/g, " ")),
    )
    for (const row of toRewrite) {
      if (row.projectName === finalName) continue
      await prisma.erpPurchaseLedger.update({
        where: { id: row.id },
        data: { projectName: finalName },
      })
    }

    await prisma.erpClientProject.deleteMany({ where: { id: { in: sources.map((s) => s.id) } } })

    return NextResponse.json({
      project: updated,
      mergedCount: sources.length,
      ledgerUpdated: toRewrite.length,
    })
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
    const existing = await prisma.erpClientProject.findUnique({ where: { id: body.id } })
    if (!existing) return NextResponse.json({ error: "Project not found" }, { status: 404 })
    const row = await prisma.erpClientProject.update({ where: { id: body.id }, data })
    const oldName = String(existing.projectName || "").trim()
    if (oldName && oldName.toLowerCase() !== projectName.toLowerCase()) {
      const ledgerRows = await prisma.erpPurchaseLedger.findMany({
        where: {
          purchaseScopeId: existing.purchaseScopeId,
          linkMode: "project",
        },
        select: { id: true, projectName: true },
      })
      const oldKey = oldName.toLowerCase().replace(/\s+/g, " ")
      for (const ledger of ledgerRows) {
        const key = String(ledger.projectName || "").trim().toLowerCase().replace(/\s+/g, " ")
        if (key === oldKey) {
          await prisma.erpPurchaseLedger.update({
            where: { id: ledger.id },
            data: { projectName },
          })
        }
      }
    }
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
