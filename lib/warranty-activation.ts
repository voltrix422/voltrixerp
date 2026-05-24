import { prisma } from "@/lib/db"
import { parseProductQrPayload } from "@/lib/parse-product-qr"

const WARRANTY_YEARS = 5

export function addYears(date: Date, years: number) {
  const next = new Date(date)
  next.setFullYear(next.getFullYear() + years)
  return next
}

export function isWarrantyPendingActivation(notes: string | null | undefined): boolean {
  const n = (notes || "").toLowerCase()
  if (n.includes("pending") && n.includes("scan")) return true
  if (n.includes("dispatched on order") && !n.includes("warranty activated")) return true
  return false
}

export function isWarrantyActivated(row: {
  activatedAt?: Date | string | null
  notes?: string | null
}): boolean {
  if (isWarrantyPendingActivation(row.notes)) return false
  const n = (row.notes || "").toLowerCase()
  if (n.includes("warranty activated")) return true
  // Manual admin entries (not from dispatch flow) may have activatedAt only
  if (row.activatedAt && !n.includes("dispatched on order")) return true
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

export async function activateWarrantyBySerial(
  rawScan: string,
  options?: { activatedBy?: string; customerName?: string },
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

  if (warranty?.activatedAt && isWarrantyActivated(warranty)) {
    return {
      ok: true,
      alreadyActive: true,
      warranty: serializeWarranty(warranty),
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
        customerName: options?.customerName?.trim() || warranty.customerName,
        notes: isWarrantyPendingActivation(warranty.notes)
          ? activationNote
          : `${warranty.notes || ""}\n${activationNote}`.trim(),
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
        customerName: options?.customerName?.trim() || null,
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
    warranty: serializeWarranty(warranty),
  }
}

function serializeWarranty(w: {
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
  notes: string | null
  activatedAt: Date | null
}) {
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
    notes: w.notes,
    activatedAt: w.activatedAt?.toISOString() ?? null,
    status: isWarrantyActivated(w) ? "active" : "pending",
  }
}

export async function lookupWarrantyForPublic(idOrSerial: string) {
  const key = idOrSerial.trim()
  if (!key) return null

  const warranty = await prisma.erpWarranty.findFirst({
    where: {
      OR: [
        { warrantyId: key },
        { serialNumber: { equals: key, mode: "insensitive" } },
      ],
    },
  })

  if (!warranty) return null

  return {
    warranty: serializeWarranty(warranty),
    pending: !isWarrantyActivated(warranty),
    active: isWarrantyActivated(warranty),
  }
}
