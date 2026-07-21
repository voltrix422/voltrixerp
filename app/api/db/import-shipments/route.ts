import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"
import {
  applyLandedCostToItems,
  calculateLandedCost,
  normalizeImportStep,
  statusForStep,
  type AllocationMethod,
  type CustomsDutyEntry,
  type ImportAttachment,
  type ImportCharge,
  type ImportContainer,
  type ImportItem,
  type ImportPayment,
  type ImportShipmentStatus,
  type ImportSro,
  type FlowHistoryEntry,
} from "@/lib/import-shipment"

function asArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : []
}

function jsonVal(v: unknown): Prisma.InputJsonValue {
  return v as Prisma.InputJsonValue
}

function payload(body: Record<string, unknown>) {
  const currentStep = normalizeImportStep(Number(body.currentStep) || 1)
  let status = String(body.status || statusForStep(currentStep)) as ImportShipmentStatus
  if (body.landedCostLocked && currentStep >= 5 && status !== "received" && status !== "closed") {
    status = "landed"
  }
  if (body.receivedAtWarehouse) status = "received"

  return {
    purchaseScopeId: String(body.purchaseScopeId || "P1").trim().toUpperCase(),
    status,
    currentStep,
    supplierId: body.supplierId ? String(body.supplierId) : null,
    supplierName: String(body.supplierName ?? ""),
    contractRef: String(body.contractRef ?? ""),
    contractDate: String(body.contractDate ?? ""),
    incoterms: String(body.incoterms ?? "FOB"),
    currency: String(body.currency ?? "USD"),
    fxRate: Number(body.fxRate) || 0,
    originCountry: String(body.originCountry ?? ""),
    originPort: String(body.originPort ?? ""),
    destinationPort: String(body.destinationPort ?? "Karachi"),
    clearingAgent: String(body.clearingAgent ?? ""),
    notes: String(body.notes ?? ""),
    blNumber: String(body.blNumber ?? ""),
    vesselName: String(body.vesselName ?? ""),
    voyageNo: String(body.voyageNo ?? ""),
    etd: String(body.etd ?? ""),
    eta: String(body.eta ?? ""),
    ata: String(body.ata ?? ""),
    igmNumber: String(body.igmNumber ?? ""),
    igmDate: String(body.igmDate ?? ""),
    gdNumber: String(body.gdNumber ?? ""),
    gdDate: String(body.gdDate ?? ""),
    psid: String(body.psid ?? ""),
    pssid: String(body.pssid ?? ""),
    collectorate: String(body.collectorate ?? ""),
    assessmentChannel: String(body.assessmentChannel ?? ""),
    allocationMethod: String(body.allocationMethod ?? "by_value") as AllocationMethod,
    landedCostLocked: Boolean(body.landedCostLocked),
    receivedAtWarehouse: Boolean(body.receivedAtWarehouse),
    warehouseLocation: String(body.warehouseLocation ?? ""),
    receivedDate: String(body.receivedDate ?? ""),
    containers: jsonVal(asArray<ImportContainer>(body.containers)),
    items: jsonVal(asArray<ImportItem>(body.items)),
    charges: jsonVal(asArray<ImportCharge>(body.charges)),
    attachments: jsonVal(asArray<ImportAttachment>(body.attachments)),
    payments: jsonVal(asArray<ImportPayment>(body.payments)),
    customsDuties: jsonVal(asArray<CustomsDutyEntry>(body.customsDuties)),
    gdSros: jsonVal(asArray<ImportSro>(body.gdSros)),
    landedCostSummary: jsonVal(
      body.landedCostSummary && typeof body.landedCostSummary === "object"
        ? body.landedCostSummary
        : {},
    ),
    flowHistory: jsonVal(asArray<FlowHistoryEntry>(body.flowHistory)),
    createdBy: String(body.createdBy ?? ""),
  }
}

async function nextShipmentNumber(scope: string): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `IMP-${year}-`
  const latest = await prisma.erpImportShipment.findMany({
    where: {
      purchaseScopeId: scope,
      shipmentNumber: { startsWith: prefix },
    },
    orderBy: { shipmentNumber: "desc" },
    take: 1,
  })
  const last = latest[0]?.shipmentNumber || ""
  const num = last.startsWith(prefix) ? parseInt(last.slice(prefix.length), 10) : 0
  const next = Number.isFinite(num) ? num + 1 : 1
  return `${prefix}${String(next).padStart(4, "0")}`
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get("id")
    const scope = (searchParams.get("scope") || "").trim().toUpperCase()

    if (id) {
      const row = await prisma.erpImportShipment.findUnique({ where: { id } })
      if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 })
      return NextResponse.json(row)
    }

    const rows = await prisma.erpImportShipment.findMany({
      where: scope ? { purchaseScopeId: scope } : undefined,
      orderBy: { createdAt: "desc" },
    })
    return NextResponse.json(rows)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load"
    const needsMigration = /erp_import_shipments|ErpImportShipment|does not exist/i.test(message)
    return NextResponse.json(
      {
        error: needsMigration
          ? "Import shipments table missing. Run: npx prisma migrate deploy"
          : message,
      },
      { status: 500 },
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const data = payload(body)
    const recalculate = Boolean(body.recalculateLandedCost) || Boolean(body.lockLandedCost)

    let items = asArray<ImportItem>(data.items)
    let landedCostSummary: Prisma.InputJsonValue = data.landedCostSummary
    let landedCostLocked = data.landedCostLocked

    if (recalculate || body.lockLandedCost) {
      const summary = calculateLandedCost({
        items,
        charges: asArray<ImportCharge>(data.charges),
        fxRate: data.fxRate,
        currency: data.currency,
        allocationMethod: data.allocationMethod,
      })
      items = applyLandedCostToItems(items, summary)
      landedCostSummary = jsonVal(summary)
      if (body.lockLandedCost) {
        landedCostLocked = true
        data.status = data.receivedAtWarehouse ? "received" : "landed"
        data.currentStep = Math.max(data.currentStep, 5)
      }
    }

    const history = asArray<FlowHistoryEntry>(data.flowHistory)
    if (body.historyNote) {
      history.push({
        at: new Date().toISOString(),
        by: String(body.historyBy || data.createdBy || "user"),
        action: String(body.historyAction || "updated"),
        note: String(body.historyNote),
      })
    }

    if (body.id) {
      const updated = await prisma.erpImportShipment.update({
        where: { id: String(body.id) },
        data: {
          ...data,
          items: jsonVal(items),
          landedCostSummary,
          landedCostLocked,
          flowHistory: jsonVal(history),
        },
      })
      return NextResponse.json(updated)
    }

    const shipmentNumber =
      String(body.shipmentNumber || "").trim() ||
      (await nextShipmentNumber(data.purchaseScopeId))

    const created = await prisma.erpImportShipment.create({
      data: {
        ...data,
        shipmentNumber,
        items: jsonVal(items),
        landedCostSummary,
        landedCostLocked,
        flowHistory: jsonVal([
          {
            at: new Date().toISOString(),
            by: data.createdBy || "user",
            action: "created",
            note: "Import shipment created",
          },
          ...history,
        ]),
      },
    })
    return NextResponse.json(created)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save"
    const needsMigration = /erp_import_shipments|ErpImportShipment|does not exist/i.test(message)
    return NextResponse.json(
      {
        error: needsMigration
          ? "Import shipments table missing. Run: npx prisma migrate deploy"
          : message,
      },
      { status: 500 },
    )
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json()
    await prisma.erpImportShipment.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
