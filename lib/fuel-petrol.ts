export type FuelAllotmentStatus = "allotted" | "settled"

export type FuelVehicle = {
  id: string
  name: string
  plate: string
  avgKmPerLiter: number
  active: boolean
  notes: string
  createdBy: string
  createdAt: string
  updatedAt: string
}

export type FuelAllotment = {
  id: string
  vehicleId: string
  vehicleName: string
  vehiclePlate: string
  avgKmPerLiter: number
  personStaffId: string | null
  personName: string
  personUserId: string | null
  amountPkr: number
  liters: number | null
  allottedAt: string
  paymentProofUrls: string[]
  notes: string
  status: FuelAllotmentStatus | string
  kmDriven: number | null
  odometerStart: number | null
  odometerEnd: number | null
  settlementNotes: string
  spendingProofUrls: string[]
  settledAt: string | null
  settledBy: string
  allottedBy: string
  createdAt: string
  updatedAt: string
}

function urls(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((u) => String(u ?? "").trim()).filter(Boolean)
}

function mapVehicle(row: Record<string, unknown>): FuelVehicle {
  return {
    id: String(row.id || ""),
    name: String(row.name || ""),
    plate: String(row.plate || ""),
    avgKmPerLiter: Number(row.avgKmPerLiter) || 0,
    active: row.active !== false,
    notes: String(row.notes || ""),
    createdBy: String(row.createdBy || ""),
    createdAt: String(row.createdAt || ""),
    updatedAt: String(row.updatedAt || ""),
  }
}

function mapAllotment(row: Record<string, unknown>): FuelAllotment {
  const vehicle = (row.vehicle && typeof row.vehicle === "object"
    ? (row.vehicle as Record<string, unknown>)
    : {}) as Record<string, unknown>
  return {
    id: String(row.id || ""),
    vehicleId: String(row.vehicleId || ""),
    vehicleName: String(vehicle.name || row.vehicleName || ""),
    vehiclePlate: String(vehicle.plate || row.vehiclePlate || ""),
    avgKmPerLiter: Number(vehicle.avgKmPerLiter ?? row.avgKmPerLiter) || 0,
    personStaffId: row.personStaffId ? String(row.personStaffId) : null,
    personName: String(row.personName || ""),
    personUserId: row.personUserId ? String(row.personUserId) : null,
    amountPkr: Number(row.amountPkr) || 0,
    liters: row.liters == null || row.liters === "" ? null : Number(row.liters),
    allottedAt: String(row.allottedAt || ""),
    paymentProofUrls: urls(row.paymentProofUrls),
    notes: String(row.notes || ""),
    status: String(row.status || "allotted"),
    kmDriven: row.kmDriven == null || row.kmDriven === "" ? null : Number(row.kmDriven),
    odometerStart: row.odometerStart == null || row.odometerStart === "" ? null : Number(row.odometerStart),
    odometerEnd: row.odometerEnd == null || row.odometerEnd === "" ? null : Number(row.odometerEnd),
    settlementNotes: String(row.settlementNotes || ""),
    spendingProofUrls: urls(row.spendingProofUrls),
    settledAt: row.settledAt ? String(row.settledAt) : null,
    settledBy: String(row.settledBy || ""),
    allottedBy: String(row.allottedBy || ""),
    createdAt: String(row.createdAt || ""),
    updatedAt: String(row.updatedAt || ""),
  }
}

export async function listFuelVehicles(includeInactive = false): Promise<FuelVehicle[]> {
  const qs = new URLSearchParams({ resource: "vehicles" })
  if (includeInactive) qs.set("includeInactive", "1")
  const res = await fetch(`/api/db/fuel-petrol?${qs}`, { cache: "no-store" })
  if (!res.ok) throw new Error("Failed to load vehicles")
  const data = await res.json()
  return Array.isArray(data) ? data.map((r) => mapVehicle(r)) : []
}

export async function saveFuelVehicle(input: {
  id?: string
  name: string
  plate?: string
  avgKmPerLiter: number
  active?: boolean
  notes?: string
  createdBy?: string
}): Promise<FuelVehicle> {
  const res = await fetch("/api/db/fuel-petrol", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "save_vehicle", ...input }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || "Failed to save vehicle")
  return mapVehicle(data)
}

export async function listFuelAllotments(params?: {
  mineForUserId?: string
  mineForName?: string
  mineForStaffId?: string
  status?: string
}): Promise<FuelAllotment[]> {
  const qs = new URLSearchParams({ resource: "allotments" })
  if (params?.mineForUserId) qs.set("userId", params.mineForUserId)
  if (params?.mineForName) qs.set("personName", params.mineForName)
  if (params?.mineForStaffId) qs.set("staffId", params.mineForStaffId)
  if (params?.status) qs.set("status", params.status)
  const res = await fetch(`/api/db/fuel-petrol?${qs}`, { cache: "no-store" })
  if (!res.ok) throw new Error("Failed to load fuel allotments")
  const data = await res.json()
  return Array.isArray(data) ? data.map((r) => mapAllotment(r)) : []
}

export async function createFuelAllotment(input: {
  vehicleId: string
  personStaffId?: string
  personName: string
  personUserId?: string
  amountPkr: number
  liters?: number
  notes?: string
  paymentProofUrls?: string[]
  allottedBy?: string
}): Promise<FuelAllotment> {
  const res = await fetch("/api/db/fuel-petrol", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "allot", ...input }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || "Failed to allot fuel")
  return mapAllotment(data)
}

export async function settleFuelAllotment(input: {
  id: string
  kmDriven: number
  odometerStart?: number
  odometerEnd?: number
  settlementNotes?: string
  spendingProofUrls?: string[]
  settledBy?: string
}): Promise<FuelAllotment> {
  const res = await fetch("/api/db/fuel-petrol", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "settle", ...input }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || "Failed to settle fuel")
  return mapAllotment(data)
}

export async function deleteFuelAllotment(id: string): Promise<void> {
  const res = await fetch("/api/db/fuel-petrol", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "delete_allotment", id }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || "Failed to delete allotment")
}

/** Expected KM from allotted liters × vehicle avg (km/L). */
export function expectedKm(avgKmPerLiter: number, liters: number | null | undefined): number | null {
  if (!avgKmPerLiter || liters == null || liters <= 0) return null
  return avgKmPerLiter * liters
}
