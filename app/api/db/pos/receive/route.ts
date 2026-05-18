import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

type ScanInput = {
  serialNumber: string
  model?: string
  productName?: string
  specs?: string
  productId?: string
  rawPayload?: string
  unitPrice?: number
}

type ManualLine = {
  model: string
  qty: number
  unitPrice?: number
  description?: string
}

function stockDescription(scan: ScanInput): string {
  return (scan.model || scan.productName || "Unknown model").trim()
}

async function findOrCreateStock(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  description: string,
  unitPrice: number,
  addQty: number,
) {
  const existing = await tx.erpInventoryStock.findFirst({
    where: { description: { equals: description, mode: "insensitive" } },
  })

  if (existing) {
    const updated = await tx.erpInventoryStock.update({
      where: { id: existing.id },
      data: {
        availableQty: existing.availableQty + addQty,
        receivedQty: existing.receivedQty + addQty,
        costPrice: unitPrice > 0 ? unitPrice : existing.costPrice,
      },
    })
    return updated
  }

  const id = `pos-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  return tx.erpInventoryStock.create({
    data: {
      id,
      poId: null,
      poNumber: "POS",
      itemId: id,
      name: description,
      description,
      unit: "pcs",
      receivedQty: addQty,
      availableQty: addQty,
      allocatedQty: 0,
      costPrice: unitPrice,
      supplierName: "POS",
      poType: "local",
      otherExpenses: "[]",
    },
  })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const scans: ScanInput[] = Array.isArray(body.scans) ? body.scans : []
  const manualLines: ManualLine[] = Array.isArray(body.manualLines) ? body.manualLines : []
  const receiveDate = String(body.receiveDate || new Date().toISOString().slice(0, 10))
  const scannedBy = String(body.scannedBy || "POS")
  const batchLabel = `POS receive ${receiveDate}`

  if (scans.length === 0 && manualLines.length === 0) {
    return NextResponse.json({ error: "No items to receive" }, { status: 400 })
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const stockUpdates: { description: string; addedQty: number; stockId: string }[] = []
      const serialErrors: { serialNumber: string; error: string }[] = []
      let serialsSaved = 0

      const grouped = new Map<string, ScanInput[]>()
      for (const scan of scans) {
        const sn = scan.serialNumber?.trim()
        if (!sn) continue
        const key = stockDescription(scan)
        const list = grouped.get(key) ?? []
        list.push({ ...scan, serialNumber: sn })
        grouped.set(key, list)
      }

      for (const [description, group] of grouped) {
        const unitPrice = group.find((g) => g.unitPrice && g.unitPrice > 0)?.unitPrice ?? 0
        let addedCount = 0
        let stockId = ""

        for (const scan of group) {
          const existing = await tx.erpInventorySerialUnit.findFirst({
            where: { serialNumber: { equals: scan.serialNumber, mode: "insensitive" } },
          })
          if (existing) {
            serialErrors.push({ serialNumber: scan.serialNumber, error: "Already in system" })
            continue
          }

          if (addedCount === 0) {
            const stock = await findOrCreateStock(tx, description, unitPrice, 0)
            stockId = stock.id
          }

          await tx.erpInventorySerialUnit.create({
            data: {
              serialNumber: scan.serialNumber,
              assignedName: batchLabel,
              productName: scan.productName || description,
              model: scan.model || description,
              specs: scan.specs || scan.productId || "",
              rawPayload: scan.rawPayload || "",
              inventoryStockId: stockId,
              status: "in_stock",
              notes: `POS · ${receiveDate}`,
              scannedBy,
            },
          })
          addedCount += 1
          serialsSaved += 1
        }

        if (addedCount > 0 && stockId) {
          const stock = await tx.erpInventoryStock.findUnique({ where: { id: stockId } })
          if (stock) {
            await tx.erpInventoryStock.update({
              where: { id: stockId },
              data: {
                availableQty: stock.availableQty + addedCount,
                receivedQty: stock.receivedQty + addedCount,
              },
            })
          }
          stockUpdates.push({ description, addedQty: addedCount, stockId })
          await tx.erpInventoryHistory.create({
            data: {
              itemDescription: description,
              transactionType: "in",
              quantity: addedCount,
              unit: "pcs",
              referenceType: "pos_receive",
              referenceId: stockId,
              referenceNumber: batchLabel,
              notes: `POS QR receive · ${addedCount} unit(s)`,
              createdBy: scannedBy,
            },
          })
        }
      }

      for (const line of manualLines) {
        const description = (line.description || line.model).trim()
        const qty = Math.max(0, Math.floor(Number(line.qty) || 0))
        if (!description || qty <= 0) continue

        const stock = await findOrCreateStock(
          tx,
          description,
          Number(line.unitPrice) || 0,
          qty,
        )
        stockUpdates.push({ description, addedQty: qty, stockId: stock.id })

        await tx.erpInventoryHistory.create({
          data: {
            itemDescription: description,
            transactionType: "in",
            quantity: qty,
            unit: "pcs",
            referenceType: "pos_receive",
            referenceId: stock.id,
            referenceNumber: batchLabel,
            notes: `POS manual receive · ${qty} unit(s)`,
            createdBy: scannedBy,
          },
        })
      }

      return { stockUpdates, serialErrors, serialsSaved }
    })

    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Receive failed"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
