import {
  BG51100_LAST_SEGMENT_LEN,
  BG51100_MODEL,
  isBg51100Model,
  parseMacStyleQr,
} from "@/lib/bg51100-mac-qr"
import { prisma } from "@/lib/db"
import { parseProductQrPayload } from "@/lib/parse-product-qr"
import {
  buildPendingDispatchNote,
  parseOrderNumberFromUnitNotes,
  parseOrderNumberFromWarrantyNotes,
  resolveInvoiceNumberForWarranty,
  resolveWarrantyHolderName,
} from "@/lib/warranty-order-resolver"
import { warrantyHolderNamesMatch } from "@/lib/warranty-holder-name"
import {
  DEFAULT_WARRANTY_YEARS,
  warrantyYearsForProduct,
} from "@/lib/warranty-policy"

/** Default 5+5 (10 years). Specific SKUs in warranty-policy.ts stay at 5 years. */
export const WARRANTY_YEARS = DEFAULT_WARRANTY_YEARS
export const WARRANTY_POLICY_LABEL = "5+5 Year Replacement"

export async function generatePublicWarrantyNumber(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const id = `vol-${Math.floor(10000 + Math.random() * 90000)}`
    const exists = await prisma.erpWarranty.findFirst({
      where: { warrantyId: { equals: id, mode: "insensitive" } },
    })
    if (!exists) return id
  }
  return `vol-${Date.now().toString().slice(-8)}`
}

export function normalizeWarrantyNumberInput(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ""
  if (/^vol-/i.test(trimmed)) return trimmed.toLowerCase()
  if (/^\d{4,6}$/.test(trimmed)) return `vol-${trimmed}`
  return trimmed
}

export function addYears(date: Date, years: number) {
  const next = new Date(date)
  next.setFullYear(next.getFullYear() + years)
  return next
}

const MS_PER_YEAR = 1000 * 60 * 60 * 24 * 365.25

function spanYears(start: Date, end: Date) {
  return (end.getTime() - start.getTime()) / MS_PER_YEAR
}

/** Align stored end dates with this product's policy (5 years or 5+5). */
export async function applyCurrentReplacementSpan<
  T extends {
    id: string
    warrantyStartDate: Date
    warrantyEndDate: Date
    serialNumber?: string | null
    warrantyId?: string | null
    productName?: string
  },
>(w: T): Promise<T> {
  const targetYears = warrantyYearsForProduct(w.productName, w.serialNumber)
  const currentYears = spanYears(w.warrantyStartDate, w.warrantyEndDate)
  const isFiveish = currentYears >= 4.8 && currentYears < 6.2
  const isTenish = currentYears >= 9.5 && currentYears < 10.6
  if (!isFiveish && !isTenish) return w
  if (Math.abs(currentYears - targetYears) < 0.2) return w

  const warrantyEndDate = addYears(w.warrantyStartDate, targetYears)
  const updated = await prisma.erpWarranty.update({
    where: { id: w.id },
    data: { warrantyEndDate },
  })

  const unit = w.serialNumber
    ? await prisma.erpInventorySerialUnit.findFirst({
        where: { serialNumber: { equals: w.serialNumber, mode: "insensitive" } },
      })
    : w.warrantyId
      ? await prisma.erpInventorySerialUnit.findFirst({ where: { warrantyId: w.warrantyId } })
      : null

  if (unit) {
    await prisma.erpInventorySerialUnit.update({
      where: { id: unit.id },
      data: { warrantyEndDate },
    })
  }

  return { ...w, warrantyEndDate: updated.warrantyEndDate }
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

  // HS-BG51100 MAC-style (any last-segment length): keep full payload as serial.
  const mac = parseMacStyleQr(trimmed)
  if (mac) return mac.serial

  const parsed = parseProductQrPayload(trimmed)
  return (parsed.serialNumber || trimmed).trim()
}

/**
 * Serial variants for DB lookup. Box QRs often encode model + serial with a
 * separator (HS12.8V100Ah-voltrix-45) while warranties store the short serial
 * (voltrix-45). Exact/full forms are tried first. Glued payloads without a
 * separator (HS-25.6V100AHvoltrix-N) keep only the full serial so they do not
 * collide with a different product's short voltrix-N row.
 */
export function serialLookupCandidates(raw: string): string[] {
  const trimmed = raw.trim()
  if (!trimmed) return []

  const resolved = resolveSerialFromWarrantyScan(trimmed)
  const out: string[] = []
  const add = (value: string | null | undefined) => {
    const next = (value || "").trim()
    if (!next) return
    if (out.some((existing) => existing.toLowerCase() === next.toLowerCase())) return
    out.push(next)
  }

  add(resolved)
  add(trimmed)

  for (const source of [resolved, trimmed]) {
    // Only when model and serial are separated (dash/space), not glued.
    const separated = source.match(
      /^((?:MAN-)?HS-?\d+(?:[.-]\d+)?V\s*\d+\s*A[hH]?)[\s\-–—]+([A-Za-z][A-Za-z0-9._-]{1,40})$/i,
    )
    if (separated?.[2]) add(separated[2].trim())

    const modelSn = source.match(
      /^([A-Za-z0-9][A-Za-z0-9._/\s-]{2,48})\s*(?:->|=>|→|—>|-->|[-–—])\s*([A-Za-z0-9][A-Za-z0-9._/-]{4,60})$/i,
    )
    if (modelSn?.[2]) add(modelSn[2].trim())
  }

  return out
}

/**
 * Resolve product for a warranty scan. HS-BG51100 MAC QRs only map when last
 * segment length is 2; other lengths are not this product.
 */
export function resolveProductFromWarrantyScan(
  raw: string,
  fallbackProductName?: string | null,
): string {
  const trimmed = raw.trim()
  const mac = parseMacStyleQr(trimmed)
  if (mac) {
    if (mac.lastSegmentLen === BG51100_LAST_SEGMENT_LEN) return BG51100_MODEL
    // Wrong last-segment length must not inherit HS-BG51100 from a fallback.
    if (isBg51100Model(fallbackProductName)) return ""
    return fallbackProductName?.trim() || ""
  }
  const parsed = parseProductQrPayload(trimmed)
  return (
    parsed.model?.trim() ||
    parsed.productName?.trim() ||
    fallbackProductName?.trim() ||
    ""
  )
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
  /**
   * ERP admin only: create and start a warranty even if the serial is not in
   * inventory or the warranty registry. Never enable this on the public scan API.
   */
  allowUnregistered?: boolean
  productName?: string
  /**
   * ERP admin only: if the order has a warranty name, use it when the operator
   * did not type one. Never enable this on the public scan API.
   */
  useAssignedHolderName?: boolean
}

async function findWarrantyBySerial(serialNumber: string) {
  for (const key of serialLookupCandidates(serialNumber)) {
    const row = await prisma.erpWarranty.findFirst({
      where: { serialNumber: { equals: key, mode: "insensitive" } },
    })
    if (row) return row
  }
  return null
}

async function findUnitBySerial(serialNumber: string) {
  for (const key of serialLookupCandidates(serialNumber)) {
    const row = await prisma.erpInventorySerialUnit.findFirst({
      where: { serialNumber: { equals: key, mode: "insensitive" } },
    })
    if (row) return row
  }
  return null
}

export async function activateWarrantyBySerial(
  rawScan: string,
  options?: ActivateWarrantyOptions,
): Promise<ActivateWarrantyResult> {
  const serialNumber = resolveSerialFromWarrantyScan(rawScan)
  if (!serialNumber) {
    return { ok: false, error: "Could not read serial number from scan.", code: "INVALID_SCAN" }
  }

  const unit = await findUnitBySerial(serialNumber)

  if (unit?.status === "in_stock") {
    return {
      ok: false,
      error: "This unit is still in warehouse stock. Dispatch the order first, then start warranty at the branch.",
      code: "NOT_DISPATCHED",
    }
  }

  const now = new Date()

  let warranty =
    (unit?.warrantyId
      ? await prisma.erpWarranty.findFirst({ where: { warrantyId: unit.warrantyId } })
      : null) || (await findWarrantyBySerial(serialNumber))

  const productHint =
    options?.productName?.trim() ||
    warranty?.productName ||
    unit?.model ||
    unit?.productName ||
    serialNumber
  const warrantyEnd = addYears(now, warrantyYearsForProduct(productHint, serialNumber))

  const alreadyActive = Boolean(warranty?.activatedAt && isWarrantyActivated(warranty))

  if (!alreadyActive) {
    const requiredHolder = await resolveWarrantyHolderName({
      serialNumber,
      warrantyId: warranty?.warrantyId || unit?.warrantyId,
      notes: warranty?.notes || unit?.notes,
    })
    if (requiredHolder) {
      const typed = options?.customerName?.trim() || ""
      if (options?.useAssignedHolderName && !typed) {
        options = { ...options, customerName: requiredHolder }
      } else if (!warrantyHolderNamesMatch(typed, requiredHolder)) {
        return {
          ok: false,
          error:
            "The warranty name does not match. Type the person or company name given by your dealer to start this warranty.",
          code: "HOLDER_NAME_MISMATCH",
        }
      } else {
        options = { ...options, customerName: requiredHolder }
      }
    }
  }

  const customerPatch = {
    customerName: options?.customerName?.trim() || undefined,
    customerPhone: options?.customerPhone?.trim() || undefined,
    customerAddress: options?.customerAddress?.trim() || undefined,
    installLocation: options?.installLocation?.trim() || undefined,
    invoiceDocumentUrl: options?.invoiceDocumentUrl?.trim() || undefined,
  }

  const activationNote = `Warranty activated ${now.toISOString().slice(0, 10)}${
    options?.activatedBy ? ` by ${options.activatedBy}` : ""
  }`

  if (!warranty && !unit) {
    if (!options?.allowUnregistered) {
      return {
        ok: false,
        error: `Serial ${serialNumber} is not registered. Contact Voltrix support.`,
        code: "NOT_FOUND",
      }
    }

    const parsed = parseProductQrPayload(rawScan)
    const mac = parseMacStyleQr(rawScan)
    if (
      mac &&
      mac.lastSegmentLen !== BG51100_LAST_SEGMENT_LEN &&
      isBg51100Model(options?.productName)
    ) {
      return {
        ok: false,
        error: `This QR last segment has ${mac.lastSegmentLen} character(s); HS-BG51100 requires ${BG51100_LAST_SEGMENT_LEN}. Different product.`,
        code: "BG51100_MAC_MISMATCH",
      }
    }
    const productName =
      resolveProductFromWarrantyScan(rawScan, options?.productName) ||
      options?.productName?.trim() ||
      parsed.model?.trim() ||
      parsed.productName?.trim() ||
      serialNumber
    const generatedWarrantyId = await generatePublicWarrantyNumber()
    const created = await prisma.erpWarranty.create({
      data: {
        warrantyId: generatedWarrantyId,
        serialNumber,
        productName,
        soldDate: now,
        warrantyStartDate: now,
        warrantyEndDate: addYears(now, warrantyYearsForProduct(productName, serialNumber)),
        activatedAt: now,
        customerName: customerPatch.customerName || null,
        customerPhone: customerPatch.customerPhone || null,
        customerAddress: customerPatch.customerAddress || null,
        installLocation: customerPatch.installLocation || null,
        invoiceDocumentUrl: customerPatch.invoiceDocumentUrl || null,
        notes: `${activationNote}\nStarted by ERP admin from QR (serial was not in registry).`,
        createdBy: options?.activatedBy || "ERP admin",
      },
    })
    return {
      ok: true,
      alreadyActive: false,
      warranty: await serializeWarrantyPublic(created),
    }
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
    warranty = await applyCurrentReplacementSpan(warranty)
    return {
      ok: true,
      alreadyActive: true,
      warranty: await serializeWarrantyPublic(warranty),
    }
  }

  if (warranty) {
    const assignedWarrantyId =
      warranty.warrantyId?.trim() || (await generatePublicWarrantyNumber())
    warranty = await prisma.erpWarranty.update({
      where: { id: warranty.id },
      data: {
        warrantyId: assignedWarrantyId,
        activatedAt: now,
        warrantyStartDate: now,
        warrantyEndDate: warrantyEnd,
        soldDate: warranty.soldDate || now,
        serialNumber: warranty.serialNumber || serialNumber,
        customerName: customerPatch.customerName || warranty.customerName,
        customerPhone: customerPatch.customerPhone || warranty.customerPhone,
        customerAddress: customerPatch.customerAddress || warranty.customerAddress,
        installLocation: customerPatch.installLocation || warranty.installLocation,
        invoiceDocumentUrl: customerPatch.invoiceDocumentUrl || warranty.invoiceDocumentUrl,
        notes: `${warranty.notes || ""}\n${activationNote}`.trim(),
      },
    })
  } else if (unit) {
    const generatedWarrantyId = await generatePublicWarrantyNumber()
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

  if (!warranty) {
    return {
      ok: false,
      error: `Serial ${serialNumber} is not registered. Contact Voltrix support.`,
      code: "NOT_FOUND",
    }
  }

  const warrantyId = warranty.warrantyId
  if (unit) {
    await prisma.erpInventorySerialUnit.update({
      where: { id: unit.id },
      data: {
        warrantyId,
        warrantyStartDate: now,
        warrantyEndDate: warrantyEnd,
      },
    })
  }

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
  const placeholderEnd = addYears(
    soldDate,
    warrantyYearsForProduct(warranty.productName, warranty.serialNumber),
  )

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

  const normalizedWarrantyNo = normalizeWarrantyNumberInput(trimmed)
  const resolvedSerial = resolveSerialFromWarrantyScan(trimmed)
  const lookupKeys = [
    ...new Set(
      [trimmed, normalizedWarrantyNo, resolvedSerial, ...serialLookupCandidates(trimmed)].filter(Boolean),
    ),
  ]

  let warranty = null as Awaited<ReturnType<typeof prisma.erpWarranty.findFirst>>
  for (const key of lookupKeys) {
    warranty = await prisma.erpWarranty.findFirst({
      where: {
        OR: [
          { warrantyId: { equals: key, mode: "insensitive" } },
          { serialNumber: { equals: key, mode: "insensitive" } },
        ],
      },
    })
    if (warranty) break
  }

  if (!warranty) {
    const unit = await findUnitBySerial(resolvedSerial || trimmed)

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

  warranty = await applyCurrentReplacementSpan(warranty)

  if (isWarrantyActivated(warranty) && !warranty.warrantyId?.trim()) {
    warranty = await prisma.erpWarranty.update({
      where: { id: warranty.id },
      data: { warrantyId: await generatePublicWarrantyNumber() },
    })
  }

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
      requiresHolderName?: boolean
      message: string
    }
  | { ok: false; error: string; code?: string }

/** Validate scan for start flow: delivered unit → collect customer details before activation. */
export async function previewWarrantyStart(rawScan: string): Promise<WarrantyStartPreviewResult> {
  const serialNumber = resolveSerialFromWarrantyScan(rawScan)
  if (!serialNumber) {
    return { ok: false, error: "Could not read serial number from scan.", code: "INVALID_SCAN" }
  }

  const existing = await lookupWarrantyForPublic(rawScan)
  if (existing?.active) {
    return {
      ok: true,
      status: "already_active",
      warranty: existing.warranty,
    }
  }

  const unit = await findUnitBySerial(serialNumber)

  if (unit?.status === "in_stock") {
    return {
      ok: false,
      error:
        "This unit is still in warehouse stock. Warranty can be started after your dealer dispatches the order.",
      code: "NOT_DISPATCHED",
    }
  }

  if (existing?.pending) {
    const w = existing.warranty
    const requiredHolder = await resolveWarrantyHolderName({
      serialNumber,
      warrantyId: typeof w.warrantyId === "string" ? w.warrantyId : null,
      notes: typeof w.notes === "string" ? w.notes : null,
    })
    return {
      ok: true,
      status: "delivered_pending",
      serialNumber: String(w.serialNumber || serialNumber),
      productName: String(w.productName || unit?.model || unit?.productName || serialNumber),
      customerName: null,
      customerPhone: w.customerPhone as string | null,
      customerAddress: w.customerAddress as string | null,
      installLocation: w.installLocation as string | null,
      invoiceNumber: w.invoiceNumber as string | null,
      requiresHolderName: Boolean(requiredHolder),
      message: requiredHolder
        ? "Product found and delivered. Type the warranty name given by your dealer to start warranty."
        : "Product found and delivered. Please enter your details to start warranty.",
    }
  }

  if (unit) {
    const invoiceNumber = await resolveInvoiceNumberForWarranty({
      serialNumber: unit.serialNumber,
      warrantyId: unit.warrantyId,
      notes: null,
    })
    const requiredHolder = await resolveWarrantyHolderName({
      serialNumber: unit.serialNumber,
      warrantyId: unit.warrantyId,
      notes: unit.notes,
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
      requiresHolderName: Boolean(requiredHolder),
      message: requiredHolder
        ? "Product found and delivered. Type the warranty name given by your dealer to start warranty."
        : "Product found and delivered. Please enter your details to start warranty.",
    }
  }

  return {
    ok: false,
    error: `Serial ${serialNumber} is not registered. Contact Voltrix support.`,
    code: "NOT_FOUND",
  }
}
