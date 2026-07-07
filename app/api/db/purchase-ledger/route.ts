import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

async function nextLedgerNumber(): Promise<string> {
  const rows = await prisma.erpPurchaseLedger.findMany({
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
  if (searchParams.get("nextNumber") === "1") {
    return NextResponse.json({ ledgerNumber: await nextLedgerNumber() })
  }

  const rows = await prisma.erpPurchaseLedger.findMany({ orderBy: { createdAt: "desc" } })
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const ledgerNumber = body.ledgerNumber || (await nextLedgerNumber())
  const quantity = Number(body.quantity) || 0
  const unitPrice = Number(body.unitPrice) || 0
  const totalAmount = Number(body.totalAmount) || quantity * unitPrice

  const data = {
    ledgerNumber,
    transactionDate: body.transactionDate || new Date().toISOString().slice(0, 10),
    linkMode: body.linkMode || "general",
    projectName: body.projectName || "",
    orderId: body.orderId || null,
    orderNumber: body.orderNumber || "",
    supplierId: body.supplierId || null,
    supplierName: body.supplierName || "",
    productName: body.productName || "",
    transactionType: body.transactionType || "purchase",
    category: body.category || "expense",
    quantity,
    unitPrice,
    totalAmount,
    notes: body.notes || "",
    dueDate: body.dueDate || "",
    accountDetails: body.accountDetails || "",
    paymentProofUrl: body.paymentProofUrl || "",
    paymentProofName: body.paymentProofName || "",
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
