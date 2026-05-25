import { prisma } from "@/lib/db"
import { nextSequence } from "@/lib/accounting/sequence"
import type { InvoiceLineInput, MoveLineInput } from "@/lib/accounting/types"

function round2(n: number) {
  return Math.round(n * 100) / 100
}

export function validateBalanced(lines: { debit: number; credit: number }[]) {
  const d = round2(lines.reduce((s, l) => s + l.debit, 0))
  const c = round2(lines.reduce((s, l) => s + l.credit, 0))
  if (Math.abs(d - c) > 0.01) throw new Error(`Entry not balanced: debit ${d} ≠ credit ${c}`)
}

export async function getAccountByCode(code: string) {
  const acc = await prisma.acctAccount.findUnique({ where: { code } })
  if (!acc) throw new Error(`Account ${code} not found`)
  return acc
}

export async function createDraftMove(opts: {
  journalId: string
  date: Date
  partnerId?: string
  ref?: string
  moveType?: string
  narration?: string
  lines: MoveLineInput[]
  createdBy?: string
  invoiceId?: string
}) {
  const journal = await prisma.acctJournal.findUnique({ where: { id: opts.journalId } })
  if (!journal) throw new Error("Journal not found")

  const lineData = opts.lines.map(l => ({
    accountId: l.accountId,
    partnerId: l.partnerId ?? opts.partnerId ?? "",
    name: l.name,
    debit: round2(l.debit ?? 0),
    credit: round2(l.credit ?? 0),
    analyticCode: l.analyticCode ?? "",
  }))
  validateBalanced(lineData)

  const prefix = journal.sequencePrefix || journal.code
  const seqId = `move_${journal.code.toLowerCase()}`
  const name = await nextSequence(seqId, prefix)
  const amountTotal = round2(lineData.reduce((s, l) => s + l.debit, 0))

  return prisma.acctMove.create({
    data: {
      name,
      date: opts.date,
      journalId: opts.journalId,
      partnerId: opts.partnerId ?? "",
      ref: opts.ref ?? "",
      moveType: opts.moveType ?? "entry",
      state: "draft",
      amountTotal,
      narration: opts.narration ?? "",
      invoiceId: opts.invoiceId ?? "",
      createdBy: opts.createdBy ?? "",
      lines: { create: lineData },
    },
    include: { lines: true },
  })
}

export async function postMove(moveId: string) {
  const move = await prisma.acctMove.findUnique({
    where: { id: moveId },
    include: { lines: true },
  })
  if (!move) throw new Error("Move not found")
  if (move.state === "posted") throw new Error("Already posted")
  validateBalanced(move.lines)

  const settings = await prisma.acctSettings.findUnique({ where: { id: "default" } })
  if (settings?.lockDate && move.date < settings.lockDate) {
    throw new Error("Cannot post: date is before lock date")
  }

  return prisma.acctMove.update({
    where: { id: moveId },
    data: { state: "posted", postedAt: new Date() },
    include: { lines: true },
  })
}

export async function computeInvoiceLines(lines: InvoiceLineInput[]) {
  const taxes = await prisma.acctTax.findMany()
  let untaxed = 0
  let tax = 0
  const computed = lines.map(line => {
    const qty = line.quantity ?? 1
    const sub = round2(qty * line.unitPrice)
    untaxed += sub
    const t = taxes.find(x => x.id === line.taxId)
    const taxAmt = t ? round2(sub * (t.rate / 100)) : 0
    tax += taxAmt
    return { ...line, quantity: qty, subtotal: sub, taxAmt }
  })
  return { lines: computed, amountUntaxed: round2(untaxed), amountTax: round2(tax), amountTotal: round2(untaxed + tax) }
}

export async function postInvoice(invoiceId: string) {
  const inv = await prisma.acctInvoice.findUnique({
    where: { id: invoiceId },
    include: { lines: true },
  })
  if (!inv) throw new Error("Invoice not found")
  if (inv.state !== "draft") throw new Error("Only draft invoices can be posted")

  const isCustomer = inv.invoiceType === "out_invoice" || inv.invoiceType === "out_refund"
  const ar = await getAccountByCode("1100")
  const ap = await getAccountByCode("2010")
  const taxAcc = await getAccountByCode("2100")
  const sign = inv.invoiceType.includes("refund") ? -1 : 1

  const moveLines: MoveLineInput[] = []
  for (const line of inv.lines) {
    const acc = await getAccountByCode(line.accountCode)
    moveLines.push({
      accountId: acc.id,
      name: line.productName || line.accountCode,
      debit: isCustomer ? 0 : round2(line.subtotal * sign),
      credit: isCustomer ? round2(line.subtotal * sign) : 0,
      partnerId: inv.partnerId,
    })
  }
  if (inv.amountTax > 0) {
    moveLines.push({
      accountId: taxAcc.id,
      name: "Tax",
      debit: isCustomer ? 0 : round2(inv.amountTax * sign),
      credit: isCustomer ? round2(inv.amountTax * sign) : 0,
      partnerId: inv.partnerId,
    })
  }
  const control = isCustomer ? ar : ap
  moveLines.push({
    accountId: control.id,
    name: inv.number || "Invoice",
    debit: isCustomer ? round2(inv.amountTotal * sign) : 0,
    credit: isCustomer ? 0 : round2(inv.amountTotal * sign),
    partnerId: inv.partnerId,
  })

  const seqId = isCustomer ? "invoice_out" : "invoice_in"
  const prefix = isCustomer ? "INV" : "BILL"
  const number = inv.number || (await nextSequence(seqId, prefix))

  const move = await createDraftMove({
    journalId: inv.journalId,
    date: inv.invoiceDate,
    partnerId: inv.partnerId,
    ref: number,
    moveType: inv.invoiceType,
    lines: moveLines,
    invoiceId: inv.id,
    createdBy: inv.createdBy,
  })
  await postMove(move.id)

  return prisma.acctInvoice.update({
    where: { id: invoiceId },
    data: {
      state: "posted",
      number,
      moveId: move.id,
      amountResidual: inv.amountTotal,
    },
    include: { lines: true },
  })
}

export async function postPayment(paymentId: string) {
  const pay = await prisma.acctPayment.findUnique({ where: { id: paymentId } })
  if (!pay) throw new Error("Payment not found")
  if (pay.state !== "draft") throw new Error("Only draft payments can be posted")

  const isInbound = pay.paymentType === "inbound"
  const ar = await getAccountByCode("1100")
  const ap = await getAccountByCode("2010")
  const journal = await prisma.acctJournal.findUnique({ where: { id: pay.journalId } })
  if (!journal) throw new Error("Journal not found")

  let liquidityId = journal.defaultAccountId
  if (!liquidityId) {
    const code = journal.journalType === "cash" ? "1010" : "1020"
    liquidityId = (await getAccountByCode(code)).id
  }

  const control = isInbound ? ar : ap
  const lines: MoveLineInput[] = isInbound
    ? [
        { accountId: liquidityId, name: pay.memo || "Payment", debit: pay.amount, partnerId: pay.partnerId },
        { accountId: control.id, name: pay.memo || "Payment", credit: pay.amount, partnerId: pay.partnerId },
      ]
    : [
        { accountId: control.id, name: pay.memo || "Payment", debit: pay.amount, partnerId: pay.partnerId },
        { accountId: liquidityId, name: pay.memo || "Payment", credit: pay.amount, partnerId: pay.partnerId },
      ]

  const name = pay.name || (await nextSequence("payment", "PAY"))
  const move = await createDraftMove({
    journalId: pay.journalId,
    date: pay.date,
    partnerId: pay.partnerId,
    ref: name,
    moveType: "payment",
    lines,
    createdBy: pay.createdBy,
  })
  await postMove(move.id)

  const invoiceIds = Array.isArray(pay.invoiceIds) ? (pay.invoiceIds as string[]) : []
  for (const invId of invoiceIds) {
    const inv = await prisma.acctInvoice.findUnique({ where: { id: invId } })
    if (!inv) continue
    const residual = round2(Math.max(0, inv.amountResidual - pay.amount))
    await prisma.acctInvoice.update({
      where: { id: invId },
      data: { amountResidual: residual, state: residual <= 0.01 ? "paid" : inv.state },
    })
  }

  if (journal.journalType === "bank") {
    const bank = await prisma.acctBankAccount.findFirst({ where: { journalId: journal.id } })
    if (bank) {
      await prisma.acctBankAccount.update({
        where: { id: bank.id },
        data: { balance: { increment: isInbound ? pay.amount : -pay.amount } },
      })
    }
  }

  return prisma.acctPayment.update({
    where: { id: paymentId },
    data: { state: "posted", name, moveId: move.id },
  })
}
