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
}

function parseSupplierGroups(raw: unknown): LedgerSupplierGroup[] {
  if (!Array.isArray(raw)) return []
  return raw.map((group, index) => ({
    id: String((group as LedgerSupplierGroup).id ?? `group-${index}`),
    supplierId: (group as LedgerSupplierGroup).supplierId || null,
    supplierName: String((group as LedgerSupplierGroup).supplierName ?? ""),
    accountDetails: String((group as LedgerSupplierGroup).accountDetails ?? ""),
    items: parseItems((group as LedgerSupplierGroup).items),
  }))
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

export async function POST(req: NextRequest) {
  const body = await req.json()

  if (body.action === "addPayment") {
    const existing = await prisma.erpPurchaseLedger.findUnique({ where: { id: body.id } })
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const payments = parsePayments(existing.payments)
    const payment = body.payment ?? {}
    payments.push({
      id: payment.id || Date.now().toString(),
      amount: Number(payment.amount) || 0,
      date: payment.date || new Date().toISOString().slice(0, 10),
      proofUrl: payment.proofUrl || "",
      proofName: payment.proofName || "",
      notes: payment.notes || "",
      createdAt: new Date().toISOString(),
      createdBy: payment.createdBy || "",
    })

    const amountPaid = sumPayments(payments)
    const amountDue = Math.max(0, existing.totalAmount - amountPaid)
    const latest = payments[payments.length - 1]

    const row = await prisma.erpPurchaseLedger.update({
      where: { id: body.id },
      data: {
        payments,
        amountPaid,
        amountDue,
        paymentProofUrl: latest?.proofUrl || existing.paymentProofUrl,
        paymentProofName: latest?.proofName || existing.paymentProofName,
      },
    })
    return NextResponse.json(row)
  }

  const supplierGroups = parseSupplierGroups(body.supplierGroups)
  const items = supplierGroups.length > 0
    ? supplierGroups.flatMap(group => group.items)
    : parseItems(body.items)
  const totalAmount = supplierGroups.length > 0
    ? sumSupplierGroups(supplierGroups)
    : items.length > 0 ? sumItems(items) : Number(body.totalAmount) || 0
  const firstItem = items[0]
  const payments = parsePayments(body.payments)
  const amountPaid = payments.length > 0 ? sumPayments(payments) : Number(body.amountPaid) || 0
  const amountDue = Math.max(0, totalAmount - amountPaid)
  const purchaseScopeId = String(body.purchaseScopeId || "P1").trim().toUpperCase()
  const ledgerNumber = body.ledgerNumber || (await nextLedgerNumber(purchaseScopeId))
  const primaryGroup = supplierGroups[0]
  const supplierNames = supplierGroups.map(group => group.supplierName).filter(Boolean)

  const data = {
    purchaseScopeId,
    ledgerNumber,
    transactionDate: body.transactionDate || new Date().toISOString().slice(0, 10),
    linkMode: normalizeLinkMode(body.linkMode || "general"),
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

  const row = body.id
    ? await prisma.erpPurchaseLedger.update({ where: { id: body.id }, data })
    : await prisma.erpPurchaseLedger.create({ data })

  return NextResponse.json(row)
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  await prisma.erpPurchaseLedger.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
