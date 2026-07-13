import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

type LedgerItem = {
  id: string
  productName: string
  quantity: number
  unitPrice: number
  lineTotal: number
}

type LedgerPayment = {
  id: string
  amount: number
  date: string
  proofUrl: string
  proofName: string
  notes: string
  createdAt: string
  createdBy: string
  supplierGroupId?: string
  supplierName?: string
}

function parseItems(raw: unknown): LedgerItem[] {
  if (!Array.isArray(raw)) return []
  return raw.map((item, index) => ({
    id: String((item as LedgerItem).id ?? `item-${index}`),
    productName: String((item as LedgerItem).productName ?? ""),
    quantity: Number((item as LedgerItem).quantity) || 0,
    unitPrice: Number((item as LedgerItem).unitPrice) || 0,
    lineTotal: Number((item as LedgerItem).lineTotal) || 0,
  }))
}

function parsePayments(raw: unknown): LedgerPayment[] {
  if (!Array.isArray(raw)) return []
  return raw.map((p, index) => ({
    id: String((p as LedgerPayment).id ?? `pay-${index}`),
    amount: Number((p as LedgerPayment).amount) || 0,
    date: String((p as LedgerPayment).date ?? ""),
    proofUrl: String((p as LedgerPayment).proofUrl ?? ""),
    proofName: String((p as LedgerPayment).proofName ?? ""),
    notes: String((p as LedgerPayment).notes ?? ""),
    createdAt: String((p as LedgerPayment).createdAt ?? new Date().toISOString()),
    createdBy: String((p as LedgerPayment).createdBy ?? ""),
    supplierGroupId: (p as LedgerPayment).supplierGroupId ? String((p as LedgerPayment).supplierGroupId) : undefined,
    supplierName: (p as LedgerPayment).supplierName ? String((p as LedgerPayment).supplierName) : undefined,
  }))
}

function sumPayments(payments: LedgerPayment[]) {
  return payments.reduce((sum, p) => sum + p.amount, 0)
}

type LedgerSupplierGroup = {
  id: string
  supplierId: string | null
  supplierName: string
  accountDetails: string
  items: LedgerItem[]
  amountPaid?: number
  amountDue?: number
  billUrl?: string
  billName?: string
}

function parseSupplierGroups(raw: unknown): LedgerSupplierGroup[] {
  if (!Array.isArray(raw)) return []
  return raw.map((group, index) => {
    const items = parseItems((group as LedgerSupplierGroup).items)
    const subtotal = sumItems(items)
    const amountPaid = Number((group as LedgerSupplierGroup).amountPaid) || 0
    const amountDue = Math.max(0, subtotal - amountPaid)
    return {
      id: String((group as LedgerSupplierGroup).id ?? `group-${index}`),
      supplierId: (group as LedgerSupplierGroup).supplierId || null,
      supplierName: String((group as LedgerSupplierGroup).supplierName ?? ""),
      accountDetails: String((group as LedgerSupplierGroup).accountDetails ?? ""),
      items,
      amountPaid,
      amountDue,
      billUrl: String((group as LedgerSupplierGroup).billUrl ?? ""),
      billName: String((group as LedgerSupplierGroup).billName ?? ""),
    }
  })
}

function sumGroupAmountPaid(groups: LedgerSupplierGroup[]) {
  return groups.reduce((sum, group) => sum + (group.amountPaid || 0), 0)
}

function sumGroupAmountDue(groups: LedgerSupplierGroup[]) {
  return groups.reduce((sum, group) => sum + (group.amountDue || 0), 0)
}

function sumItems(items: LedgerItem[]) {
  return items.reduce((sum, item) => sum + item.lineTotal, 0)
}

function sumSupplierGroups(groups: LedgerSupplierGroup[]) {
  return groups.reduce((sum, group) => sum + sumItems(group.items), 0)
}

function normalizeLinkMode(mode: string) {
  if (mode === "order") return "supplier"
  if (mode === "project" || mode === "supplier" || mode === "general") return mode
  return "general"
}

async function nextLedgerNumber(purchaseScopeId?: string): Promise<string> {
  const rows = await prisma.erpPurchaseLedger.findMany({
    where: purchaseScopeId ? { purchaseScopeId } : undefined,
    select: { ledgerNumber: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  })
  let max = 0
  for (const row of rows) {
    const match = row.ledgerNumber.match(/PL-(\d+)/i)
    if (match) max = Math.max(max, parseInt(match[1], 10))
  }
  return `PL-${String(max + 1).padStart(4, "0")}`
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const purchaseScopeId = (searchParams.get("scope") || "").trim().toUpperCase()
  if (searchParams.get("nextNumber") === "1") {
    return NextResponse.json({ ledgerNumber: await nextLedgerNumber(purchaseScopeId || undefined) })
  }

  const rows = await prisma.erpPurchaseLedger.findMany({
    where: purchaseScopeId ? { purchaseScopeId } : undefined,
    orderBy: { createdAt: "desc" },
  })
  return NextResponse.json(rows)
}

function isUniqueConstraintError(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && (error as { code?: string }).code === "P2002")
}

export async function POST(req: NextRequest) {
  try {
    return await handlePost(req)
  } catch (error) {
    console.error("Purchase ledger save failed:", error)
    const message = error instanceof Error ? error.message : "Failed to save purchase ledger entry"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

async function handlePost(req: NextRequest) {
  const body = await req.json()

  if (body.action === "addPayment") {
    const existing = await prisma.erpPurchaseLedger.findUnique({ where: { id: body.id } })
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const payments = parsePayments(existing.payments)
    const payment = body.payment ?? {}
    const paymentAmount = Number(payment.amount) || 0
    const supplierGroupId = payment.supplierGroupId ? String(payment.supplierGroupId) : ""
    const supplierGroups = parseSupplierGroups(existing.supplierGroups)

    payments.push({
      id: payment.id || Date.now().toString(),
      amount: paymentAmount,
      date: payment.date || new Date().toISOString().slice(0, 10),
      proofUrl: payment.proofUrl || "",
      proofName: payment.proofName || "",
      notes: payment.notes || "",
      createdAt: new Date().toISOString(),
      createdBy: payment.createdBy || "",
      supplierGroupId: supplierGroupId || undefined,
      supplierName: payment.supplierName || undefined,
    })

    // Payments are attributed to individual supplier groups only in project
    // mode. For supplier/general entries the payments list is the source of
    // truth — using group totals there would ignore every payment.
    const isProject = normalizeLinkMode(existing.linkMode || "general") === "project"

    let nextSupplierGroups = supplierGroups
    if (supplierGroupId && supplierGroups.length > 0) {
      nextSupplierGroups = supplierGroups.map(group => {
        if (group.id !== supplierGroupId) return group
        const subtotal = sumItems(group.items)
        const amountPaid = Math.min(subtotal, (group.amountPaid || 0) + paymentAmount)
        return {
          ...group,
          amountPaid,
          amountDue: Math.max(0, subtotal - amountPaid),
        }
      })
    }

    const amountPaid = Math.max(
      isProject && nextSupplierGroups.length > 0 ? sumGroupAmountPaid(nextSupplierGroups) : 0,
      sumPayments(payments),
    )
    const amountDue = Math.max(0, Number(existing.totalAmount) - amountPaid)

    if (!isProject && nextSupplierGroups.length === 1) {
      const group = nextSupplierGroups[0]
      const subtotal = sumItems(group.items)
      const groupPaid = Math.min(subtotal, amountPaid)
      nextSupplierGroups = [{ ...group, amountPaid: groupPaid, amountDue: Math.max(0, subtotal - groupPaid) }]
    }
    // Keep project group dues in sync with their paid amounts after any payment.
    if (isProject && nextSupplierGroups.length > 0) {
      nextSupplierGroups = nextSupplierGroups.map((group) => {
        const subtotal = sumItems(group.items)
        const groupPaid = Math.min(subtotal, group.amountPaid || 0)
        return { ...group, amountPaid: groupPaid, amountDue: Math.max(0, subtotal - groupPaid) }
      })
    }
    const latest = payments[payments.length - 1]

    const row = await prisma.erpPurchaseLedger.update({
      where: { id: body.id },
      data: {
        payments,
        supplierGroups: nextSupplierGroups,
        amountPaid,
        amountDue,
        paymentProofUrl: latest?.proofUrl || existing.paymentProofUrl,
        paymentProofName: latest?.proofName || existing.paymentProofName,
      },
    })
    return NextResponse.json(row)
  }

  const linkMode = normalizeLinkMode(body.linkMode || "general")
  const isProject = linkMode === "project"
  let supplierGroups = parseSupplierGroups(body.supplierGroups)
  const items = supplierGroups.length > 0
    ? supplierGroups.flatMap(group => group.items)
    : parseItems(body.items)
  const totalAmount = supplierGroups.length > 0
    ? sumSupplierGroups(supplierGroups)
    : items.length > 0 ? sumItems(items) : Number(body.totalAmount) || 0
  const firstItem = items[0]
  const payments = parsePayments(body.payments)
  // Group-level paid is used in project mode; payments list is always a floor.
  const amountPaid = Math.max(
    isProject && supplierGroups.length > 0 ? sumGroupAmountPaid(supplierGroups) : 0,
    payments.length > 0 ? sumPayments(payments) : Number(body.amountPaid) || 0,
  )
  const amountDue = Math.max(0, totalAmount - amountPaid)

  if (!isProject && supplierGroups.length === 1) {
    const group = supplierGroups[0]
    const subtotal = sumItems(group.items)
    const groupPaid = Math.min(subtotal, amountPaid)
    supplierGroups = [{ ...group, amountPaid: groupPaid, amountDue: Math.max(0, subtotal - groupPaid) }]
  }
  const purchaseScopeId = String(body.purchaseScopeId || "P1").trim().toUpperCase()
  const ledgerNumber = body.ledgerNumber || (await nextLedgerNumber(purchaseScopeId))
  const primaryGroup = supplierGroups[0]
  const supplierNames = supplierGroups.map(group => group.supplierName).filter(Boolean)

  const data = {
    purchaseScopeId,
    ledgerNumber,
    transactionDate: body.transactionDate || new Date().toISOString().slice(0, 10),
    linkMode,
    projectName: body.projectName || "",
    orderId: null,
    orderNumber: "",
    supplierId: primaryGroup?.supplierId || body.supplierId || null,
    supplierName: supplierNames.join(", ") || body.supplierName || "",
    productName: firstItem?.productName || body.productName || "",
    transactionType: body.transactionType || "purchase",
    category: body.category || "expense",
    quantity: items.reduce((s, i) => s + i.quantity, 0) || Number(body.quantity) || 0,
    unitPrice: firstItem?.unitPrice || Number(body.unitPrice) || 0,
    totalAmount,
    amountPaid,
    amountDue,
    items,
    supplierGroups,
    payments,
    notes: body.notes || "",
    dueDate: body.dueDate || "",
    accountDetails: primaryGroup?.accountDetails || body.accountDetails || "",
    paymentProofUrl: payments[0]?.proofUrl || body.paymentProofUrl || "",
    paymentProofName: payments[0]?.proofName || body.paymentProofName || "",
    createdBy: body.createdBy || "",
  }

  if (body.id) {
    const row = await prisma.erpPurchaseLedger.update({ where: { id: body.id }, data })
    return NextResponse.json(row)
  }

  try {
    const row = await prisma.erpPurchaseLedger.create({ data })
    return NextResponse.json(row)
  } catch (error) {
    // The client-supplied ledger number can be stale (fetched when the form
    // was opened). Recompute and retry once instead of failing the save.
    if (!isUniqueConstraintError(error)) throw error
    const row = await prisma.erpPurchaseLedger.create({
      data: { ...data, ledgerNumber: await nextLedgerNumber(purchaseScopeId) },
    })
    return NextResponse.json(row)
  }
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  await prisma.erpPurchaseLedger.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
