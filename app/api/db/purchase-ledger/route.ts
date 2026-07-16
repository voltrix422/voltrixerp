import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import {
  removePurchaseLedgerFromAdvances,
  syncPurchaseLedgerToAdvances,
} from "@/lib/advance-purchase-sync-server"

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
  paymentProofUrl?: string
  paymentProofName?: string
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
      paymentProofUrl: String((group as LedgerSupplierGroup).paymentProofUrl ?? ""),
      paymentProofName: String((group as LedgerSupplierGroup).paymentProofName ?? ""),
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

  // Heal any entries where payment lines exceed bill total (silent, one-time fix).
  const healed = await Promise.all(rows.map(async (row) => {
    const totalAmount = Number(row.totalAmount) || 0
    const payments = parsePayments(row.payments)
    const paymentsSum = sumPayments(payments)
    if (paymentsSum <= totalAmount + 0.004) return row

    const nextPayments = clampPaymentsToTotal(payments, totalAmount)
    let nextGroups = parseSupplierGroups(row.supplierGroups)
    nextGroups = syncGroupsFromPaymentsLocal(nextGroups, nextPayments)
    const amountPaid = Math.min(totalAmount, sumPayments(nextPayments))
    const amountDue = Math.max(0, totalAmount - amountPaid)

    try {
      return await prisma.erpPurchaseLedger.update({
        where: { id: row.id },
        data: {
          payments: nextPayments,
          supplierGroups: nextGroups,
          amountPaid,
          amountDue,
        },
      })
    } catch {
      return row
    }
  }))

  return NextResponse.json(healed)
}

function clampPaymentsToTotal(payments: LedgerPayment[], totalAmount: number): LedgerPayment[] {
  const limit = Math.max(0, totalAmount)
  let remaining = limit
  const result: LedgerPayment[] = []
  for (const payment of payments) {
    const amount = Math.max(0, payment.amount || 0)
    if (amount <= 0) {
      if (payment.proofUrl) result.push({ ...payment, amount: 0 })
      continue
    }
    if (remaining <= 0) {
      if (payment.proofUrl) result.push({ ...payment, amount: 0 })
      continue
    }
    const take = Math.min(amount, remaining)
    result.push(take === amount ? payment : { ...payment, amount: take })
    remaining -= take
  }
  return result
}

function syncGroupsFromPaymentsLocal(
  groups: LedgerSupplierGroup[],
  payments: LedgerPayment[],
): LedgerSupplierGroup[] {
  if (groups.length === 0) return groups
  const paidByGroup = new Map<string, number>()
  let unassigned = 0
  for (const payment of payments) {
    const amount = Math.max(0, payment.amount || 0)
    if (amount <= 0) continue
    if (payment.supplierGroupId) {
      paidByGroup.set(payment.supplierGroupId, (paidByGroup.get(payment.supplierGroupId) || 0) + amount)
    } else {
      unassigned += amount
    }
  }
  let next = groups.map((group) => {
    const subtotal = sumItems(group.items)
    const paid = Math.min(subtotal, paidByGroup.get(group.id) || 0)
    return { ...group, amountPaid: paid, amountDue: Math.max(0, subtotal - paid) }
  })
  if (unassigned > 0) {
    next = next.map((group) => {
      if (unassigned <= 0) return group
      const subtotal = sumItems(group.items)
      const room = Math.max(0, subtotal - (group.amountPaid || 0))
      if (room <= 0) return group
      const take = Math.min(room, unassigned)
      unassigned -= take
      const amountPaid = (group.amountPaid || 0) + take
      return { ...group, amountPaid, amountDue: Math.max(0, subtotal - amountPaid) }
    })
  }
  return next
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
    const requestedAmount = Number(payment.amount) || 0
    if (requestedAmount <= 0) {
      return NextResponse.json({ error: "Payment amount must be greater than 0" }, { status: 400 })
    }
    const supplierGroupId = payment.supplierGroupId ? String(payment.supplierGroupId) : ""
    const supplierGroups = parseSupplierGroups(existing.supplierGroups)
    const isProject = normalizeLinkMode(existing.linkMode || "general") === "project"

    const alreadyPaid = Math.min(
      Number(existing.totalAmount) || 0,
      Math.max(
        isProject && supplierGroups.length > 0 ? sumGroupAmountPaid(supplierGroups) : 0,
        sumPayments(payments),
      ),
    )
    const remainingDue = Math.max(0, Number(existing.totalAmount) - alreadyPaid)
    if (remainingDue <= 0) {
      return NextResponse.json({ error: "This entry is already fully paid" }, { status: 400 })
    }

    let paymentAmount = Math.min(requestedAmount, remainingDue)
    if (supplierGroupId && supplierGroups.length > 0) {
      const group = supplierGroups.find((g) => g.id === supplierGroupId)
      if (group) {
        const groupRemaining = Math.max(0, sumItems(group.items) - (group.amountPaid || 0))
        paymentAmount = Math.min(paymentAmount, groupRemaining)
      }
    }
    if (paymentAmount <= 0) {
      return NextResponse.json({ error: "No remaining due for this supplier" }, { status: 400 })
    }

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

    const amountPaid = Math.min(
      Number(existing.totalAmount) || 0,
      Math.max(
        isProject && nextSupplierGroups.length > 0 ? sumGroupAmountPaid(nextSupplierGroups) : 0,
        sumPayments(payments),
      ),
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
  let payments = clampPaymentsToTotal(parsePayments(body.payments), totalAmount)
  // Group-level paid is used in project mode; payments list is always a floor.
  // Cap paid at total so ledger never shows Paid > Total.
  if (isProject && supplierGroups.length > 0) {
    supplierGroups = syncGroupsFromPaymentsLocal(supplierGroups, payments)
  }
  const amountPaid = Math.min(
    totalAmount,
    Math.max(
      isProject && supplierGroups.length > 0 ? sumGroupAmountPaid(supplierGroups) : 0,
      payments.length > 0 ? sumPayments(payments) : Number(body.amountPaid) || 0,
    ),
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
    paymentProofUrl: payments.find((p) => p.proofUrl)?.proofUrl || body.paymentProofUrl || "",
    paymentProofName: payments.find((p) => p.proofUrl)?.proofName || body.paymentProofName || "",
    createdBy: body.createdBy || "",
  }

  if (body.id) {
    const row = await prisma.erpPurchaseLedger.update({ where: { id: body.id }, data })
    try {
      await syncPurchaseLedgerToAdvances({
        id: row.id,
        purchaseScopeId: row.purchaseScopeId,
        ledgerNumber: row.ledgerNumber,
        projectName: row.projectName || "",
        transactionDate: row.transactionDate,
        linkMode: row.linkMode,
        supplierName: row.supplierName || "",
        createdBy: row.createdBy || "",
        supplierGroups: Array.isArray(row.supplierGroups) ? (row.supplierGroups as SyncGroupLike[]) : supplierGroups,
      })
    } catch (err) {
      console.error("[purchase-ledger] advance sync failed:", err)
    }
    return NextResponse.json(row)
  }

  try {
    const row = await prisma.erpPurchaseLedger.create({ data })
    try {
      await syncPurchaseLedgerToAdvances({
        id: row.id,
        purchaseScopeId: row.purchaseScopeId,
        ledgerNumber: row.ledgerNumber,
        projectName: row.projectName || "",
        transactionDate: row.transactionDate,
        linkMode: row.linkMode,
        supplierName: row.supplierName || "",
        createdBy: row.createdBy || "",
        supplierGroups: Array.isArray(row.supplierGroups) ? (row.supplierGroups as SyncGroupLike[]) : supplierGroups,
      })
    } catch (err) {
      console.error("[purchase-ledger] advance sync failed:", err)
    }
    return NextResponse.json(row)
  } catch (error) {
    // The client-supplied ledger number can be stale (fetched when the form
    // was opened). Recompute and retry once instead of failing the save.
    if (!isUniqueConstraintError(error)) throw error
    const row = await prisma.erpPurchaseLedger.create({
      data: { ...data, ledgerNumber: await nextLedgerNumber(purchaseScopeId) },
    })
    try {
      await syncPurchaseLedgerToAdvances({
        id: row.id,
        purchaseScopeId: row.purchaseScopeId,
        ledgerNumber: row.ledgerNumber,
        projectName: row.projectName || "",
        transactionDate: row.transactionDate,
        linkMode: row.linkMode,
        supplierName: row.supplierName || "",
        createdBy: row.createdBy || "",
        supplierGroups: Array.isArray(row.supplierGroups) ? (row.supplierGroups as SyncGroupLike[]) : supplierGroups,
      })
    } catch (err) {
      console.error("[purchase-ledger] advance sync failed:", err)
    }
    return NextResponse.json(row)
  }
}

type SyncGroupLike = {
  id: string
  supplierName: string
  items: { productName?: string; lineTotal?: number }[]
  billUrl?: string
  billName?: string
  paymentProofUrl?: string
  paymentProofName?: string
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  const existing = await prisma.erpPurchaseLedger.findUnique({ where: { id } })
  if (existing) {
    try {
      await removePurchaseLedgerFromAdvances(existing.id, existing.purchaseScopeId)
    } catch (err) {
      console.error("[purchase-ledger] advance cleanup failed:", err)
    }
  }
  await prisma.erpPurchaseLedger.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
