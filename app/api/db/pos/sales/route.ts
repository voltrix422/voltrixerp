import { NextRequest, NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"
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
  branchId: string | null
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
    branchId: row.branchId,
    createdAt: row.createdAt.toISOString(),
  }
}

async function deductBranchStock(
  tx: Prisma.TransactionClient,
  params: {
    branchId: string
    stockId: string
    qty: number
    receiptNumber: string
    terminalName: string
    cashierName: string
  },
) {
  const branch = await tx.erpBranch.findUnique({ where: { id: params.branchId } })
  if (!branch) throw new Error("Branch not found")

  if (branch.type === "main_warehouse") {
    const stock = await tx.erpInventoryStock.findUnique({ where: { id: params.stockId } })
    if (!stock) throw new Error(`Stock item not found: ${params.stockId}`)
    if (stock.availableQty < params.qty) {
      throw new Error(`Insufficient stock for ${stock.description}`)
    }
    await tx.erpInventoryStock.update({
      where: { id: params.stockId },
      data: {
        availableQty: stock.availableQty - params.qty,
        allocatedQty: stock.allocatedQty + params.qty,
      },
    })
    await tx.erpInventoryHistory.create({
      data: {
        itemDescription: stock.description,
        transactionType: "out",
        quantity: params.qty,
        unit: stock.unit || "pcs",
        referenceType: "pos_sale",
        referenceId: params.receiptNumber,
        referenceNumber: params.receiptNumber,
        notes: `POS sale · ${params.terminalName}`,
        createdBy: params.cashierName,
      },
    })
    return
  }

  const branchRow = await tx.erpBranchInventory.findFirst({
    where: { id: params.stockId, branchId: params.branchId },
  })
  if (!branchRow) throw new Error(`Branch stock not found: ${params.stockId}`)
  if (branchRow.quantity < params.qty) {
    throw new Error(`Insufficient stock for ${branchRow.productDescription}`)
  }
  await tx.erpBranchInventory.update({
    where: { id: branchRow.id },
    data: { quantity: branchRow.quantity - params.qty },
  })
  await tx.erpInventoryHistory.create({
    data: {
      itemDescription: branchRow.productDescription,
      transactionType: "out",
      quantity: params.qty,
      unit: branchRow.unit || "pcs",
      referenceType: "pos_sale",
      referenceId: params.receiptNumber,
      referenceNumber: params.receiptNumber,
      notes: `Branch POS sale · ${branch.name} · ${params.terminalName}`,
      createdBy: params.cashierName,
    },
  })
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const terminalId = searchParams.get("terminalId")
  const branchId = searchParams.get("branchId")

  const rows = await prisma.erpPosSale.findMany({
    where: {
      ...(terminalId ? { terminalId } : {}),
      ...(branchId ? { branchId } : {}),
    },
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

  const branchId = String(body.branchId || terminal.branchId || "").trim() || null
  const code = terminal.code.toUpperCase()
  const receiptNumber = `POS-${code}-${Date.now()}`

  try {
    const sale = await prisma.$transaction(async (tx) => {
      for (const item of items) {
        const stockId = String(item.stockId || "")
        const qty = Number(item.qty) || 0
        if (!stockId || qty <= 0) continue

        if (branchId) {
          await deductBranchStock(tx, {
            branchId,
            stockId,
            qty,
            receiptNumber,
            terminalName: terminal.name,
            cashierName: String(body.cashierName || "POS"),
          })
          continue
        }

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
          branchId,
        },
      })
    })

    return NextResponse.json(mapSale(sale))
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sale failed"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
