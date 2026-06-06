import { prisma } from "@/lib/db"
import { findStockByModel } from "@/lib/ensure-model-stock-link"

async function deleteSerialUnitAndWarranties(unit: {
  id: string
  warrantyId: string | null
  serialNumber: string | null
}) {
  await prisma.erpWarrantyClaim.deleteMany({ where: { unitId: unit.id } })
  if (unit.warrantyId) {
    await prisma.erpWarranty.deleteMany({ where: { warrantyId: unit.warrantyId } })
  }
  if (unit.serialNumber) {
    await prisma.erpWarranty.deleteMany({ where: { serialNumber: unit.serialNumber } })
  }
  await prisma.erpInventorySerialUnit.delete({ where: { id: unit.id } })
}

/** Remove linked manual item, stock rows, and display label for a model code. */
export async function deleteModelStockAndManualRecords(model: string): Promise<void> {
  const trimmed = model.trim()
  if (!trimmed) return

  const stockIds = new Set<string>()

  const manual = await prisma.erpManualInventoryItem.findFirst({
    where: { model: trimmed },
  })
  if (manual) {
    if (manual.inventoryStockId) stockIds.add(manual.inventoryStockId)
    await prisma.erpManualInventoryItem.delete({ where: { id: manual.id } })
  }

  const stock = await findStockByModel(trimmed)
  if (stock?.id) stockIds.add(stock.id)

  for (const stockId of stockIds) {
    await prisma.erpInventoryStock.delete({ where: { id: stockId } }).catch(() => {})
  }

  await prisma.erpInventoryModelLabel.deleteMany({ where: { model: trimmed } }).catch(() => {})
}

/** Delete all SN units plus stock/manual rows for a warehouse model. */
export async function deleteModelInventoryCompletely(model: string): Promise<number> {
  const trimmed = model.trim()
  if (!trimmed) return 0

  const units = await prisma.erpInventorySerialUnit.findMany({
    where: { model: trimmed },
  })

  for (const unit of units) {
    await deleteSerialUnitAndWarranties(unit)
  }

  await deleteModelStockAndManualRecords(trimmed)
  return units.length
}
