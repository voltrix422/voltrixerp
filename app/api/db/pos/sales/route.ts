import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

function mapSale(row: {
  id: string
  receiptNumber: string
  terminalId: string
  terminalName: string
  items: unknown
  subtotal: number
  discount: number
  tax: number
  total: number
  paymentMethod: string
  cashierId: string
  cashierName: string
  customerName: string
  notes: string
  createdAt: Date
}) {
  return {
    id: row.id,
    receiptNumber: row.receiptNumber,
    terminalId: row.terminalId,
    terminalName: row.terminalName,
    items: Array.isArray(row.items) ? row.items : [],
    subtotal: row.subtotal,
    discount: row.discount,
    tax: row.tax,
    total: row.total,
    paymentMethod: row.paymentMethod,
    cashierId: row.cashierId,
    cashierName: row.cashierName,
    customerName: row.customerName,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
  }
}

export async function GET(req: NextRequest) {
  const terminalId = new URL(req.url).searchParams.get("terminalId")
  const rows = await prisma.erpPosSale.findMany({
    where: terminalId ? { terminalId } : undefined,
    orderBy: { createdAt: "desc" },
    take: 200,
  })
  return NextResponse.json(rows.map(mapSale))
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const items = Array.isArray(body.items) ? body.items : []
  if (items.length === 0) {
    return NextResponse.json({ error: "Cart is empty" }, { status: 400 })
  }

  const terminal = await prisma.erpPosTerminal.findUnique({
    where: { id: body.terminalId },
  })
  if (!terminal) {
    return NextResponse.json({ error: "Terminal not found" }, { status: 400 })
  }

  const code = terminal.code.toUpperCase()
  const receiptNumber = `POS-${code}-${Date.now()}`

  try {
  const sale = await prisma.$transaction(async (tx) => {
    for (const item of items) {
      const stockId = String(item.stockId || "")
      const qty = Number(item.qty) || 0
      if (!stockId || qty <= 0) continue

      const stock = await tx.erpInventoryStock.findUnique({ where: { id: stockId } })
      if (!stock) throw new Error(`Stock item not found: ${stockId}`)
      if (stock.availableQty < qty) {
        throw new Error(`Insufficient stock for ${stock.description}`)
      }

      await tx.erpInventoryStock.update({
        where: { id: stockId },
        data: {
          availableQty: stock.availableQty - qty,
          allocatedQty: stock.allocatedQty + qty,
        },
      })

      await tx.erpInventoryHistory.create({
        data: {
          itemDescription: stock.description,
          transactionType: "out",
          quantity: qty,
          unit: stock.unit || "pcs",
          referenceType: "pos_sale",
          referenceId: receiptNumber,
          referenceNumber: receiptNumber,
          notes: `POS sale · ${terminal.name}`,
          createdBy: String(body.cashierName || "POS"),
        },
      })
    }

    return tx.erpPosSale.create({
      data: {
        receiptNumber,
        terminalId: terminal.id,
        terminalName: terminal.name,
        items,
        subtotal: Number(body.subtotal) || 0,
        discount: Number(body.discount) || 0,
        tax: Number(body.tax) || 0,
        total: Number(body.total) || 0,
        paymentMethod: String(body.paymentMethod || "cash"),
        cashierId: String(body.cashierId || ""),
        cashierName: String(body.cashierName || ""),
        customerName: String(body.customerName || ""),
        notes: String(body.notes || ""),
      },
    })
  })

  return NextResponse.json(mapSale(sale))
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sale failed"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
