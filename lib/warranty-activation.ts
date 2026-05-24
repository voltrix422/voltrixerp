import { prisma } from "@/lib/db"
import { parseProductQrPayload } from "@/lib/parse-product-qr"
import {
  buildPendingDispatchNote,
  parseOrderNumberFromUnitNotes,
  parseOrderNumberFromWarrantyNotes,
  resolveInvoiceNumberForWarranty,
} from "@/lib/warranty-order-resolver"

const WARRANTY_YEARS = 5

export function addYears(date: Date, years: number) {
  const next = new Date(date)
  next.setFullYear(next.getFullYear() + years)
  return next
}

export function isWarrantyPendingActivation(notes: string | null | undefined): boolean {
  const n = (notes || "").toLowerCase()
  if (n.includes("warranty activated")) return false
  if (n.includes("pending") && n.includes("scan")) return true
  if (n.includes("dispatched on order")) return true
  return false
}

export function isWarrantyActivated(row: {
  activatedAt?: Date | string | null
  notes?: string | null
}): boolean {
  if (isWarrantyPendingActivation(row.notes)) return false
  const n = (row.notes || "").toLowerCase()
  if (n.includes("warranty activated")) return true
  if (row.activatedAt) return true
  return false
}

/** Parse QR text or warranty URL into a serial number. */
export function resolveSerialFromWarrantyScan(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ""

  try {
    if (/^https?:\/\//i.test(trimmed)) {
      const url = new URL(trimmed)
      const fromQuery =
        url.searchParams.get("sn") ||
        url.searchParams.get("serial") ||
        url.searchParams.get("serialNumber") ||
        url.searchParams.get("id")
      if (fromQuery?.trim()) return fromQuery.trim()
    }
  } catch {
    // not a URL
  }

  const parsed = parseProductQrPayload(trimmed)
  return (parsed.serialNumber || trimmed).trim()
}

export function buildWarrantyCheckUrl(serialNumber: string, baseUrl?: string): string {
  const origin =
    baseUrl?.replace(/\/$/, "") ||
    (typeof process !== "undefined" ? process.env.NEXT_PUBLIC_SITE_URL : "") ||
    "https://voltrixbatteries.com"
  return `${origin}/warranty?sn=${encodeURIComponent(serialNumber.trim())}&action=check`
}

export function buildWarrantyStartUrl(serialNumber: string, baseUrl?: string): string {
  const origin =
    baseUrl?.replace(/\/$/, "") ||
    (typeof process !== "undefined" ? process.env.NEXT_PUBLIC_SITE_URL : "") ||
    "https://voltrixbatteries.com"
  return `${origin}/warranty?sn=${encodeURIComponent(serialNumber.trim())}&action=start`
}

export type ActivateWarrantyResult =
  | { ok: true; warranty: Record<string, unknown>; alreadyActive: boolean }
  | { ok: false; error: string; code?: string }

export type ActivateWarrantyOptions = {
  activatedBy?: string
  customerName?: string
  customerPhone?: string
  customerAddress?: string
  installLocation?: string
  invoiceDocumentUrl?: string
}

export async function activateWarrantyBySerial(
  rawScan: string,
  options?: ActivateWarrantyOptions,
): Promise<ActivateWarrantyResult> {
  const serialNumber = resolveSerialFromWarrantyScan(rawScan)
  if (!serialNumber) {
    return { ok: false, error: "Could not read serial number from scan.", code: "INVALID_SCAN" }
  }

  const unit = await prisma.erpInventorySerialUnit.findFirst({
    where: { serialNumber: { equals: serialNumber, mode: "insensitive" } },
  })

  if (!unit) {
    return {
      ok: false,
      error: `Serial ${serialNumber} is not registered. Contact Voltrix support.`,
      code: "NOT_FOUND",
    }
  }

  if (unit.status === "in_stock") {
    return {
      ok: false,
      error: "This unit is still in warehouse stock. Dispatch the order first, then start warranty at the branch.",
      code: "NOT_DISPATCHED",
    }
  }

  const now = new Date()
  const warrantyEnd = addYears(now, WARRANTY_YEARS)

  let warranty = unit.warrantyId
    ? await prisma.erpWarranty.findFirst({ where: { warrantyId: unit.warrantyId } })
    : null

  if (!warranty) {
    warranty = await prisma.erpWarranty.findFirst({
      where: { serialNumber: { equals: serialNumber, mode: "insensitive" } },
    })
  }

  const customerPatch = {
    customerName: options?.customerName?.trim() || undefined,
    customerPhone: options?.customerPhone?.trim() || undefined,
    customerAddress: options?.customerAddress?.trim() || undefined,
    installLocation: options?.installLocation?.trim() || undefined,
    invoiceDocumentUrl: options?.invoiceDocumentUrl?.trim() || undefined,
  }

  if (warranty?.activatedAt && isWarrantyActivated(warranty)) {
    const hasUpdates = Object.values(customerPatch).some(Boolean)
    if (hasUpdates) {
      warranty = await prisma.erpWarranty.update({
        where: { id: warranty.id },
        data: {
          customerName: customerPatch.customerName ?? warranty.customerName,
          customerPhone: customerPatch.customerPhone ?? warranty.customerPhone,
          customerAddress: customerPatch.customerAddress ?? warranty.customerAddress,
          installLocation: customerPatch.installLocation ?? warranty.installLocation,
          invoiceDocumentUrl: customerPatch.invoiceDocumentUrl ?? warranty.invoiceDocumentUrl,
        },
      })
    }
    return {
      ok: true,
      alreadyActive: true,
      warranty: await serializeWarrantyPublic(warranty),
    }
  }

  const activationNote = `Warranty activated ${now.toISOString().slice(0, 10)}${
    options?.activatedBy ? ` by ${options.activatedBy}` : ""
  }`

  if (warranty) {
    warranty = await prisma.erpWarranty.update({
      where: { id: warranty.id },
      data: {
        activatedAt: now,
        warrantyStartDate: now,
        warrantyEndDate: warrantyEnd,
        soldDate: warranty.soldDate || now,
        customerName: customerPatch.customerName || warranty.customerName,
        customerPhone: customerPatch.customerPhone || warranty.customerPhone,
        customerAddress: customerPatch.customerAddress || warranty.customerAddress,
        installLocation: customerPatch.installLocation || warranty.installLocation,
        invoiceDocumentUrl: customerPatch.invoiceDocumentUrl || warranty.invoiceDocumentUrl,
        notes: `${warranty.notes || ""}\n${activationNote}`.trim(),
      },
    })
  } else {
    const generatedWarrantyId = `vol-${Math.floor(10000 + Math.random() * 90000)}`
    warranty = await prisma.erpWarranty.create({
      data: {
        warrantyId: generatedWarrantyId,
        serialNumber: unit.serialNumber,
        productName: unit.model || unit.productName || unit.serialNumber,
        soldDate: now,
        warrantyStartDate: now,
        warrantyEndDate: warrantyEnd,
        activatedAt: now,
        customerName: customerPatch.customerName || null,
        customerPhone: customerPatch.customerPhone || null,
        customerAddress: customerPatch.customerAddress || null,
        installLocation: customerPatch.installLocation || null,
        invoiceDocumentUrl: customerPatch.invoiceDocumentUrl || null,
        notes: activationNote,
        createdBy: options?.activatedBy || "branch",
      },
    })
  }

  const warrantyId = warranty.warrantyId
  await prisma.erpInventorySerialUnit.update({
    where: { id: unit.id },
    data: {
      warrantyId,
      warrantyStartDate: now,
      warrantyEndDate: warrantyEnd,
    },
  })

  return {
    ok: true,
    alreadyActive: false,
    warranty: await serializeWarrantyPublic(warranty),
  }
}

export async function resetWarrantyToPending(warrantyRowId: string) {
  const warranty = await prisma.erpWarranty.findUnique({ where: { id: warrantyRowId } })
  if (!warranty) {
    return { ok: false as const, error: "Warranty not found" }
  }

  if (!isWarrantyActivated(warranty)) {
    return { ok: false as const, error: "Warranty is not started yet." }
  }

  const unit = warranty.serialNumber
    ? await prisma.erpInventorySerialUnit.findFirst({
        where: { serialNumber: { equals: warranty.serialNumber, mode: "insensitive" } },
      })
    : warranty.warrantyId
      ? await prisma.erpInventorySerialUnit.findFirst({ where: { warrantyId: warranty.warrantyId } })
      : null

  if (unit?.status === "in_stock") {
    return { ok: false as const, error: "Unit is still in warehouse stock." }
  }

  const orderNumber =
    parseOrderNumberFromWarrantyNotes(warranty.notes) ||
    parseOrderNumberFromUnitNotes(unit?.notes) ||
    null

  const pendingNote = orderNumber
    ? buildPendingDispatchNote(orderNumber)
    : "Pending: scan QR at branch or voltrixbatteries.com/warranty to start warranty."

  const soldDate = warranty.soldDate || new Date()
  const placeholderEnd = addYears(soldDate, WARRANTY_YEARS)

  const updated = await prisma.erpWarranty.update({
    where: { id: warranty.id },
    data: {
      activatedAt: null,
      warrantyStartDate: soldDate,
      warrantyEndDate: placeholderEnd,
      notes: pendingNote,
    },
  })

  if (unit) {
    await prisma.erpInventorySerialUnit.update({
      where: { id: unit.id },
      data: {
        warrantyStartDate: null,
        warrantyEndDate: null,
      },
    })
  }

  return {
    ok: true as const,
    warranty: await serializeWarrantyPublic(updated),
  }
}

async function serializeWarrantyPublic(w: {
  id: string
  warrantyId: string | null
  serialNumber: string | null
  productName: string
  soldDate: Date
  warrantyStartDate: Date
  warrantyEndDate: Date
  customerName: string | null
  customerEmail: string | null
  customerPhone: string | null
  customerAddress?: string | null
  installLocation?: string | null
  invoiceDocumentUrl?: string | null
  notes: string | null
  activatedAt: Date | null
}) {
  const invoiceNumber = await resolveInvoiceNumberForWarranty({
    serialNumber: w.serialNumber,
    warrantyId: w.warrantyId,
    notes: w.notes,
  })

  return {
    id: w.id,
    warrantyId: w.warrantyId,
    serialNumber: w.serialNumber,
    productName: w.productName,
    soldDate: w.soldDate.toISOString(),
    warrantyStartDate: w.warrantyStartDate.toISOString(),
    warrantyEndDate: w.warrantyEndDate.toISOString(),
    customerName: w.customerName,
    customerEmail: w.customerEmail,
    customerPhone: w.customerPhone,
    customerAddress: w.customerAddress ?? null,
    installLocation: w.installLocation ?? null,
    invoiceDocumentUrl: w.invoiceDocumentUrl ?? null,
    notes: w.notes,
    activatedAt: w.activatedAt?.toISOString() ?? null,
    invoiceNumber,
    status: isWarrantyActivated(w) ? "active" : "pending",
  }
}


export async function lookupWarrantyForPublic(idOrSerial: string) {
  const trimmed = idOrSerial.trim()
  if (!trimmed) return null

  const resolvedSerial = resolveSerialFromWarrantyScan(trimmed)
  const lookupKeys = [...new Set([trimmed, resolvedSerial].filter(Boolean))]

  let warranty = null as Awaited<ReturnType<typeof prisma.erpWarranty.findFirst>>
  for (const key of lookupKeys) {
    warranty = await prisma.erpWarranty.findFirst({
      where: {
        OR: [
          { warrantyId: key },
          { serialNumber: { equals: key, mode: "insensitive" } },
        ],
      },
    })
    if (warranty) break
  }

  if (!warranty) {
    const serialForUnit = resolvedSerial || trimmed
    const unit = await prisma.erpInventorySerialUnit.findFirst({
      where: { serialNumber: { equals: serialForUnit, mode: "insensitive" } },
    })

    if (unit?.warrantyId) {
      warranty = await prisma.erpWarranty.findFirst({
        where: { warrantyId: unit.warrantyId },
      })
    }

    if (!warranty && unit?.serialNumber) {
      warranty = await prisma.erpWarranty.findFirst({
        where: { serialNumber: { equals: unit.serialNumber, mode: "insensitive" } },
      })
    }
  }

  if (!warranty) return null

  return {
    warranty: await serializeWarrantyPublic(warranty),
    pending: !isWarrantyActivated(warranty),
    active: isWarrantyActivated(warranty),
  }
}

export type WarrantyStartPreviewResult =
  | {
      ok: true
      status: "already_active"
      warranty: Record<string, unknown>
    }
  | {
      ok: true
      status: "delivered_pending"
      serialNumber: string
      productName: string
      customerName?: string | null
      customerPhone?: string | null
      customerAddress?: string | null
      installLocation?: string | null
      invoiceNumber?: string | null
      message: string
    }
  | { ok: false; error: string; code?: string }

/** Validate scan for start flow: delivered unit → collect customer details before activation. */
export async function previewWarrantyStart(rawScan: string): Promise<WarrantyStartPreviewResult> {
  const serialNumber = resolveSerialFromWarrantyScan(rawScan)
  if (!serialNumber) {
    return { ok: false, error: "Could not read serial number from scan.", code: "INVALID_SCAN" }
  }

  const unit = await prisma.erpInventorySerialUnit.findFirst({
    where: { serialNumber: { equals: serialNumber, mode: "insensitive" } },
  })

  if (!unit) {
    return {
      ok: false,
      error: `Serial ${serialNumber} is not registered. Contact Voltrix support.`,
      code: "NOT_FOUND",
    }
  }

  if (unit.status === "in_stock") {
    return {
      ok: false,
      error:
        "This unit is still in warehouse stock. Warranty can be started after your dealer dispatches the order.",
      code: "NOT_DISPATCHED",
    }
  }

  const existing = await lookupWarrantyForPublic(rawScan)
  if (existing?.active) {
    return {
      ok: true,
      status: "already_active",
      warranty: existing.warranty,
    }
  }

  if (existing?.pending) {
    const w = existing.warranty
    return {
      ok: true,
      status: "delivered_pending",
      serialNumber: String(w.serialNumber || serialNumber),
      productName: String(w.productName || unit.model || unit.productName),
      customerName: w.customerName as string | null,
      customerPhone: w.customerPhone as string | null,
      customerAddress: w.customerAddress as string | null,
      installLocation: w.installLocation as string | null,
      invoiceNumber: w.invoiceNumber as string | null,
      message: "Product found and delivered. Please enter your details to start warranty.",
    }
  }

  const invoiceNumber = await resolveInvoiceNumberForWarranty({
    serialNumber: unit.serialNumber,
    warrantyId: unit.warrantyId,
    notes: null,
  })

  return {
    ok: true,
    status: "delivered_pending",
    serialNumber: unit.serialNumber,
    productName: unit.model || unit.productName || unit.serialNumber,
    customerName: null,
    customerPhone: null,
    customerAddress: null,
    installLocation: null,
    invoiceNumber,
    message: "Product found and delivered. Please enter your details to start warranty.",
  }
}
