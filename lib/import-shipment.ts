/** Import shipment / container landed-cost domain (Pakistan PSW flow) */

export type ImportShipmentStatus =
  | "draft"
  | "ordered"
  | "in_transit"
  | "arrived"
  | "clearance"
  | "costing"
  | "landed"
  | "received"
  | "closed"

export type AllocationMethod = "by_value" | "by_weight" | "by_qty" | "by_cbm"

export type AttachmentCategory =
  | "contract"
  | "proforma_invoice"
  | "commercial_invoice"
  | "packing_list"
  | "bill_of_lading"
  | "insurance"
  | "bank_lc_eif"
  | "payment_proof"
  | "psw_gd"
  | "psid_receipt"
  | "customs_assessment"
  | "duty_tax_challan"
  | "clearing_agent_invoice"
  | "freight_invoice"
  | "transport_invoice"
  | "container_photos"
  | "grn"
  | "other"

export type ChargeCategory =
  | "product"
  | "ocean_freight"
  | "air_freight"
  | "insurance"
  | "customs_duty"
  | "additional_customs_duty"
  | "duty_tax_customs_partial"
  | "sales_tax"
  | "income_tax"
  | "fed"
  | "regulatory_fee"
  | "psw_fee"
  | "clearing_agent"
  | "port_handling"
  | "examination"
  | "appraisement"
  | "handling_service"
  | "demurrage"
  | "detention"
  | "do_bl_charges"
  | "local_transport"
  | "labor_unloading"
  | "bank_charges"
  | "logworld_total_invoice"
  | "aict_terminal_invoice"
  | "gst_on_charges"
  | "other"

export interface ImportAttachment {
  id: string
  category: AttachmentCategory
  name: string
  url: string
  uploadedBy: string
  uploadedAt: string
  notes?: string
}

export interface ImportContainer {
  id: string
  containerNo: string
  size: string // 20ft | 40ft | 40HC | LCL | other
  sealNo: string
  grossWeightKg: number
  netWeightKg: number
  cbm: number
  packageCount: number
  notes: string
}

export interface ImportItem {
  id: string
  containerId: string
  description: string
  sku: string
  hsCode: string
  qty: number
  receivedQty: number
  unit: string
  /** Unit price in foreign currency (synced from actualPrice for landed cost) */
  unitPriceForeign: number
  /** Commercial / invoice unit price */
  actualPrice: number
  /** Price declared on GD */
  declaredPrice: number
  /** Customs assessed unit price */
  assessedPrice: number
  /** Gross weight (kg) */
  grossWeightKg: number
  /** Net weight (kg) — preferred for by_weight allocation */
  netWeightKg: number
  /** @deprecated Prefer netWeightKg; kept for older shipments */
  weightKg: number
  /** Volume (CBM) — used for by_cbm allocation */
  cbm: number
  origin: string
  notes: string
  /** Computed fields (filled by calculateLandedCost) */
  productCostPkr?: number
  allocatedChargesPkr?: number
  directChargesPkr?: number
  totalLandedPkr?: number
  unitLandedCost?: number
}

/** One customs duty / tax line on the GD (PSW step) */
export interface CustomsDutyEntry {
  id: string
  /** Display order label e.g. "Customs Duty 1" */
  name: string
  category: ChargeCategory
  amount: number
  currency: string
  description: string
  itemId?: string
  paid: boolean
  paymentRef: string
}

/** SRO applied on a GD / item, or saved in the scope library */
export interface ImportSro {
  id: string
  code: string
  title: string
  description: string
  notes?: string
  /** When set, SRO applies to this invoice item */
  itemId?: string
}

/** Extra tax line on a landing charge (custom label + amount) */
export interface ImportChargeTax {
  id: string
  label: string
  amount: number
}

export interface ImportCharge {
  id: string
  category: ChargeCategory
  description: string
  amount: number
  currency: string
  /** If charge currency differs from PKR, use this FX (else shipment fxRate for foreign product) */
  fxRate: number
  /** true = allocate across items; false = attach to one item */
  isShared: boolean
  itemId?: string
  /** Override allocation for this charge only */
  allocationMethod?: AllocationMethod | ""
  paid: boolean
  /** @deprecated Prefer proofUrl / proofName */
  paymentRef: string
  notes: string
  /** When set, this charge was synced from a PSW customs duty row */
  fromDutyId?: string
  /** Local transport route */
  transportFrom?: string
  transportTo?: string
  /** Payment / invoice proof (screenshot, PDF, etc.) */
  proofUrl?: string
  proofName?: string
  /** Named taxes on this charge (included in landed cost) */
  taxes?: ImportChargeTax[]
  /** For gst_on_charges: percent of charges subtotal, or fixed amount */
  gstMode?: "percent" | "amount"
  /** GST % when gstMode is percent (amount is derived) */
  gstPercent?: number
}

export interface ImportPayment {
  id: string
  kind: "supplier" | "customs" | "freight" | "clearing" | "transport" | "other"
  amount: number
  currency: string
  date: string
  method: string
  reference: string
  proofUrl: string
  proofName: string
  notes: string
}

export interface LandedCostLine {
  itemId: string
  description: string
  containerId: string
  qty: number
  receivedQty: number
  productCostPkr: number
  allocatedChargesPkr: number
  directChargesPkr: number
  totalLandedPkr: number
  unitLandedCost: number
  sharePercent: number
}

export interface LandedCostSummary {
  calculatedAt: string
  allocationMethod: AllocationMethod
  fxRate: number
  currency: string
  productTotalPkr: number
  sharedChargesPkr: number
  directChargesPkr: number
  grandTotalPkr: number
  lines: LandedCostLine[]
  chargeBreakdown: { category: string; amountPkr: number }[]
}

export interface FlowHistoryEntry {
  at: string
  by: string
  action: string
  note?: string
}

export interface ImportShipment {
  id: string
  purchaseScopeId: string
  shipmentNumber: string
  status: ImportShipmentStatus
  currentStep: number
  supplierId?: string | null
  supplierName: string
  contractRef: string
  contractDate: string
  incoterms: string
  currency: string
  fxRate: number
  originCountry: string
  originPort: string
  destinationPort: string
  clearingAgent: string
  notes: string
  blNumber: string
  vesselName: string
  voyageNo: string
  etd: string
  eta: string
  ata: string
  igmNumber: string
  igmDate: string
  gdNumber: string
  gdDate: string
  /** Serialized PSIDs (newline-separated). Prefer `psids` helpers. */
  psid: string
  /** @deprecated Removed from UI — migrated into psid list */
  pssid: string
  collectorate: string
  assessmentChannel: string
  allocationMethod: AllocationMethod
  landedCostLocked: boolean
  receivedAtWarehouse: boolean
  warehouseLocation: string
  receivedDate: string
  containers: ImportContainer[]
  items: ImportItem[]
  charges: ImportCharge[]
  attachments: ImportAttachment[]
  payments: ImportPayment[]
  /** Multi customs duties entered on PSW / GD step */
  customsDuties: CustomsDutyEntry[]
  /** SROs linked to this GD */
  gdSros: ImportSro[]
  landedCostSummary: LandedCostSummary | Record<string, unknown>
  flowHistory: FlowHistoryEntry[]
  createdBy: string
  createdAt?: string
  updatedAt?: string
}

/** 6-step flow: Shipping lives inside Basics; Items renamed Invoice */
export const IMPORT_STEPS = [
  { step: 1, key: "basics", title: "Basics & Shipping", short: "Basics" },
  { step: 2, key: "invoice", title: "Invoice & Containers", short: "Invoice" },
  { step: 3, key: "psw", title: "PSW / Customs", short: "PSW" },
  { step: 4, key: "charges", title: "All Charges", short: "Charges" },
  { step: 5, key: "landed", title: "Landed Cost", short: "Landed" },
  { step: 6, key: "receive", title: "Warehouse Receive", short: "Receive" },
] as const

export const IMPORT_STEP_COUNT = IMPORT_STEPS.length

/** Common Pakistan SROs for quick-add */
export const QUICK_ADD_SROS: Omit<ImportSro, "id">[] = [
  { code: "SRO 1125(I)/2011", title: "Sales tax exemption / reduced rate", description: "Common ST exemption SRO" },
  { code: "SRO 499(I)/2013", title: "Additional customs duty related", description: "ACD / duty related SRO" },
  { code: "SRO 678(I)/2004", title: "Customs duty concession", description: "Duty concession / exemption" },
  { code: "SRO 575(I)/2006", title: "Regulatory duty related", description: "RD related notification" },
  { code: "SRO 1265(I)/2007", title: "Sales tax zero-rating", description: "Zero-rating / ST related" },
  { code: "SRO 863(I)/2007", title: "Plant & machinery concession", description: "Machinery / industrial concession" },
]

/** Common Pakistan destination ports (+ custom free-text) */
export const DESTINATION_PORTS = [
  "Karachi",
  "Karachi (KICT)",
  "Karachi (SAPT)",
  "Karachi (PICT)",
  "Port Qasim",
  "Port Qasim (PQEPT)",
  "Gwadar",
  "Islamabad Dry Port",
  "Lahore Dry Port",
  "Faisalabad Dry Port",
  "Multan Dry Port",
  "Peshawar Dry Port",
  "Sialkot Dry Port",
] as const

export const DESTINATION_PORT_CUSTOM = "__custom__"

export interface ClearingAgent {
  id: string
  name: string
  contact?: string
  notes?: string
}

export const ATTACHMENT_CATEGORIES: { value: AttachmentCategory; label: string; stepHint: number }[] = [
  { value: "contract", label: "Contract / PO", stepHint: 1 },
  { value: "proforma_invoice", label: "Proforma Invoice", stepHint: 1 },
  { value: "commercial_invoice", label: "Commercial Invoice", stepHint: 2 },
  { value: "packing_list", label: "Packing List", stepHint: 2 },
  { value: "bill_of_lading", label: "Bill of Lading (B/L)", stepHint: 1 },
  { value: "insurance", label: "Insurance Policy", stepHint: 1 },
  { value: "bank_lc_eif", label: "LC / EIF / Bank Instrument", stepHint: 1 },
  { value: "payment_proof", label: "Payment Proof", stepHint: 4 },
  { value: "psw_gd", label: "PSW Goods Declaration (GD)", stepHint: 3 },
  { value: "psid_receipt", label: "PSID / Payment Slip", stepHint: 3 },
  { value: "customs_assessment", label: "Customs Assessment", stepHint: 3 },
  { value: "duty_tax_challan", label: "Duty / Tax Challan", stepHint: 3 },
  { value: "clearing_agent_invoice", label: "Clearing Agent Invoice", stepHint: 4 },
  { value: "freight_invoice", label: "Freight Invoice", stepHint: 4 },
  { value: "transport_invoice", label: "Local Transport Invoice", stepHint: 4 },
  { value: "container_photos", label: "Container Photos", stepHint: 1 },
  { value: "grn", label: "GRN / Warehouse Proof", stepHint: 6 },
  { value: "other", label: "Other", stepHint: 1 },
]

export const CHARGE_CATEGORIES: { value: ChargeCategory; label: string; typicallyShared: boolean }[] = [
  { value: "ocean_freight", label: "Ocean Freight", typicallyShared: true },
  { value: "air_freight", label: "Air Freight", typicallyShared: true },
  { value: "insurance", label: "Insurance", typicallyShared: true },
  { value: "customs_duty", label: "Customs Duty (CD)", typicallyShared: false },
  { value: "additional_customs_duty", label: "Additional Customs Duty (ACD)", typicallyShared: false },
  { value: "duty_tax_customs_partial", label: "Duty & Tax (Customs, partial)", typicallyShared: false },
  { value: "sales_tax", label: "Sales Tax", typicallyShared: false },
  { value: "income_tax", label: "Income Tax / WHT", typicallyShared: false },
  { value: "fed", label: "FED", typicallyShared: false },
  { value: "regulatory_fee", label: "Regulatory / OGA Fee", typicallyShared: true },
  { value: "psw_fee", label: "PSW Fee", typicallyShared: true },
  { value: "do_bl_charges", label: "DO / B/L Charges (Shipping Line)", typicallyShared: true },
  { value: "port_handling", label: "Port Handling / THC", typicallyShared: true },
  { value: "examination", label: "Examination", typicallyShared: true },
  { value: "appraisement", label: "Appraisement", typicallyShared: true },
  { value: "handling_service", label: "Handling and Service", typicallyShared: true },
  { value: "local_transport", label: "Local Transport / Trucking", typicallyShared: true },
  { value: "clearing_agent", label: "Clearing Agent Fee", typicallyShared: true },
  { value: "logworld_total_invoice", label: "Logworld Total Invoice", typicallyShared: true },
  { value: "aict_terminal_invoice", label: "AICT Terminal Invoice", typicallyShared: true },
  { value: "demurrage", label: "Demurrage", typicallyShared: true },
  { value: "detention", label: "Detention", typicallyShared: true },
  { value: "labor_unloading", label: "Labor / Unloading", typicallyShared: true },
  { value: "bank_charges", label: "Bank Charges", typicallyShared: true },
  { value: "gst_on_charges", label: "GST on charges", typicallyShared: true },
  { value: "other", label: "Other Charge", typicallyShared: true },
]

/** Categories that show From / To route fields */
export const TRANSPORT_CHARGE_CATEGORIES: ChargeCategory[] = [
  "local_transport",
  "ocean_freight",
  "air_freight",
]

export const STATUS_LABELS: Record<ImportShipmentStatus, string> = {
  draft: "Draft",
  ordered: "Ordered",
  in_transit: "In Transit",
  arrived: "Arrived",
  clearance: "Clearance",
  costing: "Costing",
  landed: "Landed Cost Done",
  received: "Received",
  closed: "Closed",
}

export const INCOTERMS = ["EXW", "FOB", "CFR", "CIF", "CIP", "DAP", "DDP"] as const
export const CURRENCIES = ["USD", "CNY", "EUR", "GBP", "AED", "PKR"] as const
export const CONTAINER_SIZES = ["20ft", "40ft", "40HC", "45HC", "LCL", "Other"] as const

/** Base charge amount in PKR (excludes nested taxes). */
export function chargeBaseAmountPkr(c: ImportCharge, shipmentFx: number): number {
  const cur = (c.currency || "PKR").toUpperCase()
  if (cur === "PKR") return Number(c.amount) || 0
  const fx = Number(c.fxRate) > 0 ? Number(c.fxRate) : Number(shipmentFx) || 0
  return (Number(c.amount) || 0) * fx
}

export function chargeTaxesPkr(c: ImportCharge): number {
  return (c.taxes || []).reduce((s, t) => s + (Number(t.amount) || 0), 0)
}

/** Charge + its taxes in PKR (used for landed cost / summaries). */
export function chargeAmountPkr(c: ImportCharge, shipmentFx: number): number {
  return chargeBaseAmountPkr(c, shipmentFx) + chargeTaxesPkr(c)
}

/** Display title: B/L number once set, otherwise system import ID (IMP-…). */
export function importDisplayName(s: { shipmentNumber?: string; blNumber?: string }): string {
  const bl = String(s.blNumber || "").trim()
  if (bl) return bl
  return String(s.shipmentNumber || "").trim() || "Import"
}

/** Item weight for allocation: net → legacy kg → gross */
export function itemWeightKg(item: ImportItem): number {
  const net = Number(item.netWeightKg) || 0
  if (net > 0) return net
  const legacy = Number(item.weightKg) || 0
  if (legacy > 0) return legacy
  return Number(item.grossWeightKg) || 0
}

function itemUnitPrice(item: ImportItem): number {
  const actual = Number(item.actualPrice)
  if (actual > 0) return actual
  return Number(item.unitPriceForeign) || 0
}

function itemBasis(item: ImportItem, method: AllocationMethod, fxRate: number): number {
  const qty = Number(item.qty) || 0
  switch (method) {
    case "by_weight":
      return itemWeightKg(item)
    case "by_cbm":
      return Number(item.cbm) || 0
    case "by_qty":
      return qty
    case "by_value":
    default:
      return qty * itemUnitPrice(item) * (Number(fxRate) || 0)
  }
}

/** Parse multi-PSID list from shipment fields (and legacy PSSID). */
export function parsePsids(shipment: { psid?: string; pssid?: string; psids?: string[] }): string[] {
  if (Array.isArray(shipment.psids) && shipment.psids.length > 0) {
    return shipment.psids.map(s => String(s || ""))
  }
  const raw = String(shipment.psid ?? "")
  const fromPssid = String(shipment.pssid || "").trim()
  if (!raw && !fromPssid) return []
  let parts: string[]
  if (raw.includes("\n")) {
    parts = raw.split("\n").map(s => s.trim())
  } else if (/[|,]/.test(raw)) {
    parts = raw.split(/[|,]/).map(s => s.trim()).filter(Boolean)
  } else {
    parts = raw.trim() ? [raw.trim()] : []
  }
  if (fromPssid && !parts.includes(fromPssid)) parts.push(fromPssid)
  return parts
}

export function serializePsids(psids: string[]): { psid: string; pssid: string } {
  return { psid: psids.map(s => String(s || "").trim()).join("\n"), pssid: "" }
}

/** Sum of charges in PKR (optionally exclude gst_on_charges / duty-synced). */
export function sumChargesPkr(
  charges: ImportCharge[],
  shipmentFx: number,
  opts?: { excludeGst?: boolean; excludeDuties?: boolean },
): number {
  return (charges || [])
    .filter(c => {
      if (opts?.excludeDuties && c.fromDutyId) return false
      if (opts?.excludeGst && c.category === "gst_on_charges") return false
      return true
    })
    .reduce((s, c) => s + chargeAmountPkr(c, shipmentFx), 0)
}

/** Calculate full landed cost for a shipment (does not mutate input). */
export function calculateLandedCost(shipment: Pick<
  ImportShipment,
  "items" | "charges" | "fxRate" | "currency" | "allocationMethod"
>): LandedCostSummary {
  const fxRate = Number(shipment.fxRate) || 0
  const currency = shipment.currency || "USD"
  const method = shipment.allocationMethod || "by_value"
  const items = shipment.items || []
  const charges = (shipment.charges || []).filter(c => c.category !== "product")

  const productLines = items.map(item => {
    const qty = Number(item.qty) || 0
    const productCostPkr = qty * itemUnitPrice(item) * fxRate
    return { item, productCostPkr }
  })
  const productTotalPkr = productLines.reduce((s, l) => s + l.productCostPkr, 0)

  const shared = charges.filter(c => c.isShared)
  const direct = charges.filter(c => !c.isShared)

  const sharedTotalPkr = shared.reduce((s, c) => s + chargeAmountPkr(c, fxRate), 0)
  const directTotalPkr = direct.reduce((s, c) => s + chargeAmountPkr(c, fxRate), 0)

  // Per-item allocation of each shared charge (supports per-charge method override)
  const allocatedByItem = new Map<string, number>()
  for (const item of items) allocatedByItem.set(item.id, 0)

  for (const charge of shared) {
    const amt = chargeAmountPkr(charge, fxRate)
    const m = (charge.allocationMethod || method) as AllocationMethod
    const bases = items.map(it => ({ id: it.id, base: itemBasis(it, m, fxRate) }))
    const totalBase = bases.reduce((s, b) => s + b.base, 0)
    if (totalBase <= 0 || items.length === 0) {
      // equal split fallback
      const each = items.length ? amt / items.length : 0
      for (const it of items) {
        allocatedByItem.set(it.id, (allocatedByItem.get(it.id) || 0) + each)
      }
    } else {
      for (const b of bases) {
        allocatedByItem.set(b.id, (allocatedByItem.get(b.id) || 0) + (amt * b.base) / totalBase)
      }
    }
  }

  const directByItem = new Map<string, number>()
  for (const item of items) directByItem.set(item.id, 0)
  for (const charge of direct) {
    const amt = chargeAmountPkr(charge, fxRate)
    if (charge.itemId && directByItem.has(charge.itemId)) {
      directByItem.set(charge.itemId, (directByItem.get(charge.itemId) || 0) + amt)
    } else if (items.length === 1) {
      directByItem.set(items[0].id, (directByItem.get(items[0].id) || 0) + amt)
    } else {
      // unassigned direct → treat as shared by value
      const bases = items.map(it => ({ id: it.id, base: itemBasis(it, "by_value", fxRate) }))
      const totalBase = bases.reduce((s, b) => s + b.base, 0) || items.length
      for (const b of bases) {
        const share = totalBase > 0 ? (amt * b.base) / totalBase : amt / items.length
        directByItem.set(b.id, (directByItem.get(b.id) || 0) + share)
      }
    }
  }

  const lines: LandedCostLine[] = productLines.map(({ item, productCostPkr }) => {
    const allocatedChargesPkr = allocatedByItem.get(item.id) || 0
    const directChargesPkr = directByItem.get(item.id) || 0
    const totalLandedPkr = productCostPkr + allocatedChargesPkr + directChargesPkr
    const recv = Number(item.receivedQty) > 0 ? Number(item.receivedQty) : Number(item.qty) || 1
    const unitLandedCost = recv > 0 ? totalLandedPkr / recv : 0
    const sharePercent = productTotalPkr > 0 ? (productCostPkr / productTotalPkr) * 100 : 0
    return {
      itemId: item.id,
      description: item.description,
      containerId: item.containerId,
      qty: Number(item.qty) || 0,
      receivedQty: Number(item.receivedQty) || Number(item.qty) || 0,
      productCostPkr,
      allocatedChargesPkr,
      directChargesPkr,
      totalLandedPkr,
      unitLandedCost,
      sharePercent,
    }
  })

  const categoryMap = new Map<string, number>()
  // Product as synthetic
  categoryMap.set("product", productTotalPkr)
  for (const c of charges) {
    const label = c.category
    categoryMap.set(label, (categoryMap.get(label) || 0) + chargeAmountPkr(c, fxRate))
  }

  return {
    calculatedAt: new Date().toISOString(),
    allocationMethod: method,
    fxRate,
    currency,
    productTotalPkr,
    sharedChargesPkr: sharedTotalPkr,
    directChargesPkr: directTotalPkr,
    grandTotalPkr: productTotalPkr + sharedTotalPkr + directTotalPkr,
    lines,
    chargeBreakdown: Array.from(categoryMap.entries()).map(([category, amountPkr]) => ({
      category,
      amountPkr,
    })),
  }
}

export function applyLandedCostToItems(
  items: ImportItem[],
  summary: LandedCostSummary,
): ImportItem[] {
  const byId = new Map(summary.lines.map(l => [l.itemId, l]))
  return items.map(item => {
    const line = byId.get(item.id)
    if (!line) return item
    return {
      ...item,
      productCostPkr: line.productCostPkr,
      allocatedChargesPkr: line.allocatedChargesPkr,
      directChargesPkr: line.directChargesPkr,
      totalLandedPkr: line.totalLandedPkr,
      unitLandedCost: line.unitLandedCost,
    }
  })
}

export function statusForStep(step: number): ImportShipmentStatus {
  if (step <= 1) return "draft"
  if (step === 2) return "ordered"
  if (step === 3) return "clearance"
  if (step === 4) return "costing"
  if (step === 5) return "landed"
  if (step >= 6) return "received"
  return "draft"
}

/** Clamp / migrate old 7-step wizard indices to the new 6-step flow */
export function normalizeImportStep(step: number): number {
  const n = Number(step) || 1
  // Legacy 7-step: 1 basics, 2 items, 3 shipping, 4 psw, 5 charges, 6 landed, 7 receive
  if (n === 7) return 6
  if (n > IMPORT_STEP_COUNT) return IMPORT_STEP_COUNT
  return Math.max(1, n)
}

/** Sync PSW customs duty rows into charges so landed cost includes them */
export function syncDutiesIntoCharges(
  charges: ImportCharge[],
  duties: CustomsDutyEntry[],
): ImportCharge[] {
  const nonDuty = (charges || []).filter(c => !c.fromDutyId)
  const existingByDuty = new Map(
    (charges || []).filter(c => c.fromDutyId).map(c => [c.fromDutyId!, c]),
  )
  const synced: ImportCharge[] = duties.map(d => {
    const existing = existingByDuty.get(d.id)
    return {
      id: existing?.id || `duty-${d.id}`,
      category: d.category,
      description: d.description || d.name,
      amount: d.amount,
      currency: d.currency || "PKR",
      fxRate: existing?.fxRate || 0,
      isShared: !d.itemId,
      itemId: d.itemId || "",
      allocationMethod: existing?.allocationMethod || "",
      paid: d.paid,
      paymentRef: d.paymentRef || "",
      notes: existing?.notes || "",
      fromDutyId: d.id,
      proofUrl: existing?.proofUrl || "",
      proofName: existing?.proofName || "",
      transportFrom: existing?.transportFrom || "",
      transportTo: existing?.transportTo || "",
      taxes: existing?.taxes || [],
    }
  })
  return [...nonDuty, ...synced]
}

const SRO_LIBRARY_KEY = (scope: string) => `erp-import-sro-library:${scope || "P1"}`

export function loadSroLibrary(scope: string): ImportSro[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(SRO_LIBRARY_KEY(scope))
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveSroLibrary(scope: string, sros: ImportSro[]) {
  if (typeof window === "undefined") return
  localStorage.setItem(SRO_LIBRARY_KEY(scope), JSON.stringify(sros))
}

const AGENT_LIBRARY_KEY = (scope: string) => `erp-import-agent-library:${scope || "P1"}`

export function loadAgentLibrary(scope: string): ClearingAgent[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(AGENT_LIBRARY_KEY(scope))
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveAgentLibrary(scope: string, agents: ClearingAgent[]) {
  if (typeof window === "undefined") return
  localStorage.setItem(AGENT_LIBRARY_KEY(scope), JSON.stringify(agents))
}

export function emptyShipment(scopeId: string, createdBy = ""): Omit<ImportShipment, "id" | "shipmentNumber" | "createdAt" | "updatedAt"> {
  return {
    purchaseScopeId: scopeId,
    status: "draft",
    currentStep: 1,
    supplierId: null,
    supplierName: "",
    contractRef: "",
    contractDate: "",
    incoterms: "FOB",
    currency: "USD",
    fxRate: 0,
    originCountry: "",
    originPort: "",
    destinationPort: "Karachi",
    clearingAgent: "",
    notes: "",
    blNumber: "",
    vesselName: "",
    voyageNo: "",
    etd: "",
    eta: "",
    ata: "",
    igmNumber: "",
    igmDate: "",
    gdNumber: "",
    gdDate: "",
    psid: "",
    pssid: "",
    collectorate: "",
    assessmentChannel: "",
    allocationMethod: "by_value",
    landedCostLocked: false,
    receivedAtWarehouse: false,
    warehouseLocation: "",
    receivedDate: "",
    containers: [],
    items: [],
    charges: [],
    attachments: [],
    payments: [],
    customsDuties: [],
    gdSros: [],
    landedCostSummary: {},
    flowHistory: [],
    createdBy,
  }
}

export function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export async function getImportShipments(scope?: string): Promise<ImportShipment[]> {
  const q = scope ? `?scope=${encodeURIComponent(scope)}` : ""
  const res = await fetch(`/api/db/import-shipments${q}`)
  if (!res.ok) throw new Error("Failed to load import shipments")
  return res.json()
}

export async function getImportShipment(id: string): Promise<ImportShipment> {
  const res = await fetch(`/api/db/import-shipments?id=${encodeURIComponent(id)}`)
  if (!res.ok) throw new Error("Failed to load shipment")
  return res.json()
}

export async function saveImportShipment(shipment: Partial<ImportShipment> & { purchaseScopeId: string }): Promise<ImportShipment> {
  const payload: Record<string, unknown> = { ...shipment }
  if (!payload.id || payload.shipmentNumber === "(auto)" || !payload.shipmentNumber) {
    delete payload.shipmentNumber
  }
  const res = await fetch("/api/db/import-shipments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || "Failed to save shipment")
  }
  return res.json()
}

export async function deleteImportShipment(id: string): Promise<void> {
  const res = await fetch("/api/db/import-shipments", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  })
  if (!res.ok) throw new Error("Failed to delete shipment")
}

export function formatPkr(n: number) {
  return `PKR ${Math.round(n || 0).toLocaleString("en-PK")}`
}

export function attachmentLabel(cat: AttachmentCategory) {
  return ATTACHMENT_CATEGORIES.find(c => c.value === cat)?.label || cat
}
