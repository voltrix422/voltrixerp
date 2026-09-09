"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react"
import {
  Camera,
  Fuel,
  Loader2,
  Plus,
  Trash2,
  Upload,
  X,
  Check,
  Car,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { useAuth } from "@/components/auth-provider"
import { roleHasAllModules } from "@/lib/auth"
import { getStaff, type Staff } from "@/lib/staff"
import { uploadFiles } from "@/lib/upload"
import {
  createFuelAllotment,
  deleteFuelAllotment,
  expectedKm,
  listFuelAllotments,
  listFuelVehicles,
  saveFuelVehicle,
  settleFuelAllotment,
  type FuelAllotment,
  type FuelVehicle,
} from "@/lib/fuel-petrol"

function fmtMoney(n: number) {
  return `PKR ${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
}

function fmtWhen(iso: string) {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleString([], { dateStyle: "medium", timeStyle: "short" })
}

type LocalFile = { file: File; preview: string }

function ProofUploader({
  label,
  files,
  onAdd,
  onRemove,
  existingUrls = [],
}: {
  label: string
  files: LocalFile[]
  onAdd: (list: FileList | null) => void
  onRemove: (index: number) => void
  existingUrls?: string[]
}) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">{label}</p>
      <div className="flex flex-wrap gap-2">
        {existingUrls.map((url) => (
          <a
            key={url}
            href={url}
            target="_blank"
            rel="noreferrer"
            className="h-14 w-14 rounded-lg overflow-hidden border border-[hsl(var(--border))]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" className="h-full w-full object-cover" />
          </a>
        ))}
        {files.map((f, i) => (
          <div key={f.preview} className="relative h-14 w-14 rounded-lg overflow-hidden border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={f.preview} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => onRemove(i)}
              className="absolute top-0.5 right-0.5 h-5 w-5 rounded-full bg-black/60 text-white flex items-center justify-center"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => ref.current?.click()}
          className="h-14 w-14 rounded-lg border border-dashed border-[hsl(var(--border))] flex flex-col items-center justify-center gap-0.5 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]/30"
        >
          <Camera className="h-4 w-4" />
          <span className="text-[9px]">Add</span>
        </button>
        <input
          ref={ref}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            onAdd(e.target.files)
            e.target.value = ""
          }}
        />
      </div>
    </div>
  )
}

export function PetrolFuelPanel({ onClose }: { onClose: () => void }) {
  const { user } = useAuth()
  const { toast } = useToast()
  const isAdmin = roleHasAllModules(user?.role)

  const [tab, setTab] = useState<"allotments" | "vehicles">("allotments")
  const [view, setView] = useState<"all" | "mine">(isAdmin ? "all" : "mine")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [vehicles, setVehicles] = useState<FuelVehicle[]>([])
  const [allotments, setAllotments] = useState<FuelAllotment[]>([])
  const [staff, setStaff] = useState<Staff[]>([])

  const [showAllot, setShowAllot] = useState(false)
  const [showVehicle, setShowVehicle] = useState(false)
  const [settleFor, setSettleFor] = useState<FuelAllotment | null>(null)

  const [vehicleForm, setVehicleForm] = useState({
    id: "",
    name: "",
    plate: "",
    avgKmPerLiter: "",
    notes: "",
  })

  const [allotForm, setAllotForm] = useState({
    vehicleId: "",
    personStaffId: "",
    amountPkr: "",
    liters: "",
    notes: "",
  })
  const [paymentFiles, setPaymentFiles] = useState<LocalFile[]>([])

  const [settleForm, setSettleForm] = useState({
    kmDriven: "",
    odometerStart: "",
    odometerEnd: "",
    settlementNotes: "",
  })
  const [spendFiles, setSpendFiles] = useState<LocalFile[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const mine = view === "mine"
      const [v, a, s] = await Promise.all([
        listFuelVehicles(true),
        listFuelAllotments(
          mine
            ? { mineForUserId: user?.id, mineForName: user?.name }
            : undefined,
        ),
        getStaff().catch(() => [] as Staff[]),
      ])
      setVehicles(v)
      setAllotments(a)
      setStaff(s.filter((x) => String(x.status || "").toLowerCase() !== "inactive"))
    } catch (err) {
      toast({
        title: "Could not load petrol",
        message: err instanceof Error ? err.message : "Try again",
        type: "error",
      })
    } finally {
      setLoading(false)
    }
  }, [toast, user?.id, user?.name, view])

  useEffect(() => {
    void load()
  }, [load])

  const activeVehicles = useMemo(() => vehicles.filter((v) => v.active), [vehicles])

  function addFiles(
    list: FileList | null,
    setter: Dispatch<SetStateAction<LocalFile[]>>,
  ) {
    if (!list?.length) return
    const next = Array.from(list)
      .filter((f) => f.type.startsWith("image/"))
      .map((file) => ({ file, preview: URL.createObjectURL(file) }))
    setter((prev) => [...prev, ...next].slice(0, 8))
  }

  function removeFile(
    index: number,
    setter: Dispatch<SetStateAction<LocalFile[]>>,
  ) {
    setter((prev) => {
      const copy = [...prev]
      const [removed] = copy.splice(index, 1)
      if (removed) URL.revokeObjectURL(removed.preview)
      return copy
    })
  }

  async function submitVehicle(e: React.FormEvent) {
    e.preventDefault()
    if (!vehicleForm.name.trim()) {
      toast({ title: "Name required", message: "Enter vehicle name.", type: "error" })
      return
    }
    setSaving(true)
    try {
      await saveFuelVehicle({
        id: vehicleForm.id || undefined,
        name: vehicleForm.name.trim(),
        plate: vehicleForm.plate.trim(),
        avgKmPerLiter: Number(vehicleForm.avgKmPerLiter) || 0,
        notes: vehicleForm.notes.trim(),
        createdBy: user?.name || "",
        active: true,
      })
      toast({ title: "Vehicle saved", type: "success" })
      setShowVehicle(false)
      setVehicleForm({ id: "", name: "", plate: "", avgKmPerLiter: "", notes: "" })
      await load()
    } catch (err) {
      toast({
        title: "Save failed",
        message: err instanceof Error ? err.message : "Try again",
        type: "error",
      })
    } finally {
      setSaving(false)
    }
  }

  async function submitAllot(e: React.FormEvent) {
    e.preventDefault()
    const person = staff.find((s) => s.id === allotForm.personStaffId)
    const personName = person?.name || ""
    if (!allotForm.vehicleId || !personName) {
      toast({ title: "Missing fields", message: "Select vehicle and person.", type: "error" })
      return
    }
    const amount = Number(allotForm.amountPkr) || 0
    if (amount <= 0) {
      toast({ title: "Amount required", message: "Enter money allotted.", type: "error" })
      return
    }
    setSaving(true)
    try {
      const paymentProofUrls = paymentFiles.length
        ? await uploadFiles(
            paymentFiles.map((p) => p.file),
            "fuel-proofs",
          )
        : []
      await createFuelAllotment({
        vehicleId: allotForm.vehicleId,
        personStaffId: person?.id,
        personName,
        personUserId: person?.erp_user_id || undefined,
        amountPkr: amount,
        liters: allotForm.liters ? Number(allotForm.liters) : undefined,
        notes: allotForm.notes.trim(),
        paymentProofUrls,
        allottedBy: user?.name || "",
      })
      toast({ title: "Fuel allotted", message: `${fmtMoney(amount)} to ${personName}`, type: "success" })
      paymentFiles.forEach((f) => URL.revokeObjectURL(f.preview))
      setPaymentFiles([])
      setShowAllot(false)
      setAllotForm({ vehicleId: "", personStaffId: "", amountPkr: "", liters: "", notes: "" })
      await load()
    } catch (err) {
      toast({
        title: "Allot failed",
        message: err instanceof Error ? err.message : "Try again",
        type: "error",
      })
    } finally {
      setSaving(false)
    }
  }

  async function submitSettle(e: React.FormEvent) {
    e.preventDefault()
    if (!settleFor) return
    const km = Number(settleForm.kmDriven) || 0
    if (km <= 0) {
      toast({ title: "KM required", message: "Enter kilometres driven on this fuel.", type: "error" })
      return
    }
    setSaving(true)
    try {
      const spendingProofUrls = spendFiles.length
        ? await uploadFiles(
            spendFiles.map((p) => p.file),
            "fuel-proofs",
          )
        : []
      await settleFuelAllotment({
        id: settleFor.id,
        kmDriven: km,
        odometerStart: settleForm.odometerStart ? Number(settleForm.odometerStart) : undefined,
        odometerEnd: settleForm.odometerEnd ? Number(settleForm.odometerEnd) : undefined,
        settlementNotes: settleForm.settlementNotes.trim(),
        spendingProofUrls,
        settledBy: user?.name || "",
      })
      toast({ title: "Fuel settled", message: `${km} km recorded.`, type: "success" })
      spendFiles.forEach((f) => URL.revokeObjectURL(f.preview))
      setSpendFiles([])
      setSettleFor(null)
      setSettleForm({ kmDriven: "", odometerStart: "", odometerEnd: "", settlementNotes: "" })
      await load()
    } catch (err) {
      toast({
        title: "Settle failed",
        message: err instanceof Error ? err.message : "Try again",
        type: "error",
      })
    } finally {
      setSaving(false)
    }
  }

  const canSettle = (row: FuelAllotment) => {
    if (row.status === "settled") return false
    if (isAdmin) return true
    if (row.personUserId && user?.id && row.personUserId === user.id) return true
    if (user?.name && row.personName.toLowerCase() === user.name.toLowerCase()) return true
    return false
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-4xl rounded-t-2xl sm:rounded-xl border bg-[hsl(var(--card))] shadow-2xl overflow-hidden flex flex-col max-h-[96dvh] sm:max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b shrink-0">
          <div className="flex items-center gap-2">
            <Fuel className="h-4 w-4 text-[#1faca6]" />
            <div>
              <p className="text-sm font-semibold">Petrol / fuel</p>
              <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
                Allot fuel money · settle with KM + spending proofs
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2 px-4 sm:px-6 py-2 border-b shrink-0">
          <div className="inline-flex rounded-lg border overflow-hidden text-[11px]">
            <button
              type="button"
              onClick={() => setTab("allotments")}
              className={`px-3 py-1.5 ${tab === "allotments" ? "bg-[#1faca6] text-white" : "bg-[hsl(var(--card))]"}`}
            >
              Allotments
            </button>
            {isAdmin && (
              <button
                type="button"
                onClick={() => setTab("vehicles")}
                className={`px-3 py-1.5 ${tab === "vehicles" ? "bg-[#1faca6] text-white" : "bg-[hsl(var(--card))]"}`}
              >
                Vehicles
              </button>
            )}
          </div>
          {tab === "allotments" && isAdmin && (
            <div className="inline-flex rounded-lg border overflow-hidden text-[11px]">
              <button
                type="button"
                onClick={() => setView("all")}
                className={`px-2.5 py-1.5 ${view === "all" ? "bg-[hsl(var(--muted))]" : ""}`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setView("mine")}
                className={`px-2.5 py-1.5 ${view === "mine" ? "bg-[hsl(var(--muted))]" : ""}`}
              >
                Mine
              </button>
            </div>
          )}
          <div className="ml-auto flex gap-2">
            {tab === "vehicles" && isAdmin && (
              <Button
                size="sm"
                className="h-8 text-xs gap-1"
                onClick={() => {
                  setVehicleForm({ id: "", name: "", plate: "", avgKmPerLiter: "", notes: "" })
                  setShowVehicle(true)
                }}
              >
                <Plus className="h-3.5 w-3.5" /> Add vehicle
              </Button>
            )}
            {tab === "allotments" && isAdmin && (
              <Button
                size="sm"
                className="h-8 text-xs gap-1 bg-[#1faca6] hover:bg-[#17857f] text-white"
                onClick={() => setShowAllot(true)}
              >
                <Plus className="h-3.5 w-3.5" /> Allot fuel
              </Button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-[hsl(var(--muted-foreground))]">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : tab === "vehicles" ? (
            vehicles.length === 0 ? (
              <p className="text-sm text-center text-[hsl(var(--muted-foreground))] py-10">
                No vehicles yet. Add a car and set its average (km/L).
              </p>
            ) : (
              vehicles.map((v) => (
                <div
                  key={v.id}
                  className="rounded-xl border px-3 py-3 flex flex-wrap items-center gap-3"
                >
                  <div className="h-9 w-9 rounded-lg bg-[#1faca6]/10 text-[#1faca6] flex items-center justify-center">
                    <Car className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">
                      {v.name}
                      {!v.active && (
                        <span className="ml-2 text-[10px] text-[hsl(var(--muted-foreground))]">Inactive</span>
                      )}
                    </p>
                    <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
                      {v.plate || "No plate"} · Avg {v.avgKmPerLiter || "—"} km/L
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-[11px]"
                    onClick={() => {
                      setVehicleForm({
                        id: v.id,
                        name: v.name,
                        plate: v.plate,
                        avgKmPerLiter: String(v.avgKmPerLiter || ""),
                        notes: v.notes,
                      })
                      setShowVehicle(true)
                    }}
                  >
                    Edit
                  </Button>
                </div>
              ))
            )
          ) : allotments.length === 0 ? (
            <p className="text-sm text-center text-[hsl(var(--muted-foreground))] py-10">
              {view === "mine"
                ? "No fuel allotted to you yet."
                : "No allotments yet. Use Allot fuel to give money to a person."}
            </p>
          ) : (
            allotments.map((row) => {
              const exp = expectedKm(row.avgKmPerLiter, row.liters)
              return (
                <div key={row.id} className="rounded-xl border px-3 py-3 space-y-2">
                  <div className="flex flex-wrap items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold">{row.personName}</p>
                        <span
                          className={`text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded ${
                            row.status === "settled"
                              ? "bg-emerald-500/15 text-emerald-700"
                              : "bg-amber-500/15 text-amber-800"
                          }`}
                        >
                          {row.status}
                        </span>
                      </div>
                      <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-0.5">
                        {row.vehicleName}
                        {row.vehiclePlate ? ` · ${row.vehiclePlate}` : ""}
                        {row.avgKmPerLiter ? ` · avg ${row.avgKmPerLiter} km/L` : ""}
                      </p>
                      <p className="text-sm font-semibold text-[#1faca6] mt-1">
                        {fmtMoney(row.amountPkr)}
                        {row.liters != null ? ` · ${row.liters} L` : ""}
                      </p>
                      <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-0.5">
                        Allotted {fmtWhen(row.allottedAt)}
                        {row.allottedBy ? ` · ${row.allottedBy}` : ""}
                      </p>
                      {row.status === "settled" && (
                        <p className="text-[11px] mt-1">
                          Settled: <strong>{row.kmDriven ?? "—"} km</strong>
                          {exp != null ? ` (expected ~${exp.toFixed(0)} km)` : ""}
                          {row.settledBy ? ` · ${row.settledBy}` : ""}
                        </p>
                      )}
                      {row.notes && (
                        <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-1">{row.notes}</p>
                      )}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {canSettle(row) && (
                        <Button
                          size="sm"
                          className="h-7 text-[11px] gap-1"
                          onClick={() => {
                            setSettleFor(row)
                            setSettleForm({
                              kmDriven: "",
                              odometerStart: "",
                              odometerEnd: "",
                              settlementNotes: "",
                            })
                            setSpendFiles([])
                          }}
                        >
                          <Check className="h-3 w-3" /> Settle
                        </Button>
                      )}
                      {isAdmin && row.status === "allotted" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-[11px] text-red-600"
                          onClick={() => {
                            if (!confirm("Delete this allotment?")) return
                            void deleteFuelAllotment(row.id)
                              .then(() => load())
                              .catch((err) =>
                                toast({
                                  title: "Delete failed",
                                  message: err instanceof Error ? err.message : "Try again",
                                  type: "error",
                                }),
                              )
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                  {(row.paymentProofUrls.length > 0 || row.spendingProofUrls.length > 0) && (
                    <div className="flex flex-wrap gap-1.5">
                      {row.paymentProofUrls.map((u) => (
                        <a key={u} href={u} target="_blank" rel="noreferrer" className="h-10 w-10 rounded border overflow-hidden">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={u} alt="Payment" className="h-full w-full object-cover" />
                        </a>
                      ))}
                      {row.spendingProofUrls.map((u) => (
                        <a key={u} href={u} target="_blank" rel="noreferrer" className="h-10 w-10 rounded border overflow-hidden ring-1 ring-sky-400/40">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={u} alt="Spend" className="h-full w-full object-cover" />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>

      {showVehicle && (
        <div
          className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4"
          onClick={() => setShowVehicle(false)}
        >
          <form
            onSubmit={submitVehicle}
            className="w-full sm:max-w-md rounded-t-2xl sm:rounded-xl border bg-[hsl(var(--card))] p-4 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-semibold">{vehicleForm.id ? "Edit vehicle" : "Add vehicle"}</p>
            <div>
              <label className="text-[11px] font-medium">Name *</label>
              <input
                value={vehicleForm.name}
                onChange={(e) => setVehicleForm((f) => ({ ...f, name: e.target.value }))}
                className="mt-1 w-full h-9 rounded-md border px-3 text-sm"
                placeholder="e.g. Civic office car"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-medium">Plate</label>
                <input
                  value={vehicleForm.plate}
                  onChange={(e) => setVehicleForm((f) => ({ ...f, plate: e.target.value }))}
                  className="mt-1 w-full h-9 rounded-md border px-3 text-sm"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium">Avg km/L *</label>
                <input
                  type="number"
                  min={0}
                  step="0.1"
                  value={vehicleForm.avgKmPerLiter}
                  onChange={(e) => setVehicleForm((f) => ({ ...f, avgKmPerLiter: e.target.value }))}
                  className="mt-1 w-full h-9 rounded-md border px-3 text-sm"
                  placeholder="e.g. 12"
                  required
                />
              </div>
            </div>
            <div>
              <label className="text-[11px] font-medium">Notes</label>
              <input
                value={vehicleForm.notes}
                onChange={(e) => setVehicleForm((f) => ({ ...f, notes: e.target.value }))}
                className="mt-1 w-full h-9 rounded-md border px-3 text-sm"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <Button type="submit" disabled={saving} className="h-9 bg-[#1faca6] hover:bg-[#17857f] text-white">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
              </Button>
              <Button type="button" variant="outline" className="h-9" onClick={() => setShowVehicle(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </div>
      )}

      {showAllot && (
        <div
          className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4"
          onClick={() => setShowAllot(false)}
        >
          <form
            onSubmit={submitAllot}
            className="w-full sm:max-w-md rounded-t-2xl sm:rounded-xl border bg-[hsl(var(--card))] p-4 space-y-3 max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-semibold">Allot fuel</p>
            <div>
              <label className="text-[11px] font-medium">Vehicle *</label>
              <select
                value={allotForm.vehicleId}
                onChange={(e) => setAllotForm((f) => ({ ...f, vehicleId: e.target.value }))}
                className="mt-1 w-full h-9 rounded-md border px-3 text-sm"
                required
              >
                <option value="">Select vehicle…</option>
                {activeVehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                    {v.plate ? ` (${v.plate})` : ""} — {v.avgKmPerLiter} km/L
                  </option>
                ))}
              </select>
              {activeVehicles.length === 0 && (
                <p className="text-[10px] text-amber-700 mt-1">Add a vehicle first (Vehicles tab).</p>
              )}
            </div>
            <div>
              <label className="text-[11px] font-medium">Person *</label>
              <select
                value={allotForm.personStaffId}
                onChange={(e) => setAllotForm((f) => ({ ...f, personStaffId: e.target.value }))}
                className="mt-1 w-full h-9 rounded-md border px-3 text-sm"
                required
              >
                <option value="">Select staff…</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.department ? ` · ${s.department}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-medium">Amount (PKR) *</label>
                <input
                  type="number"
                  min={1}
                  value={allotForm.amountPkr}
                  onChange={(e) => setAllotForm((f) => ({ ...f, amountPkr: e.target.value }))}
                  className="mt-1 w-full h-9 rounded-md border px-3 text-sm"
                  required
                />
              </div>
              <div>
                <label className="text-[11px] font-medium">Liters (optional)</label>
                <input
                  type="number"
                  min={0}
                  step="0.1"
                  value={allotForm.liters}
                  onChange={(e) => setAllotForm((f) => ({ ...f, liters: e.target.value }))}
                  className="mt-1 w-full h-9 rounded-md border px-3 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="text-[11px] font-medium">Notes</label>
              <input
                value={allotForm.notes}
                onChange={(e) => setAllotForm((f) => ({ ...f, notes: e.target.value }))}
                className="mt-1 w-full h-9 rounded-md border px-3 text-sm"
                placeholder="Purpose, trip…"
              />
            </div>
            <ProofUploader
              label="Payment proof (screenshot)"
              files={paymentFiles}
              onAdd={(list) => addFiles(list, setPaymentFiles)}
              onRemove={(i) => removeFile(i, setPaymentFiles)}
            />
            <div className="flex gap-2 pt-1">
              <Button type="submit" disabled={saving} className="h-9 bg-[#1faca6] hover:bg-[#17857f] text-white gap-1">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                Allot
              </Button>
              <Button type="button" variant="outline" className="h-9" onClick={() => setShowAllot(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </div>
      )}

      {settleFor && (
        <div
          className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4"
          onClick={() => setSettleFor(null)}
        >
          <form
            onSubmit={submitSettle}
            className="w-full sm:max-w-md rounded-t-2xl sm:rounded-xl border bg-[hsl(var(--card))] p-4 space-y-3 max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-semibold">Settle fuel · {settleFor.personName}</p>
            <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
              {settleFor.vehicleName} · {fmtMoney(settleFor.amountPkr)}
              {settleFor.liters != null ? ` · ${settleFor.liters} L` : ""}
            </p>
            <div>
              <label className="text-[11px] font-medium">KM driven on this fuel *</label>
              <input
                type="number"
                min={1}
                step="0.1"
                value={settleForm.kmDriven}
                onChange={(e) => setSettleForm((f) => ({ ...f, kmDriven: e.target.value }))}
                className="mt-1 w-full h-9 rounded-md border px-3 text-sm"
                required
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-medium">Odo start (optional)</label>
                <input
                  type="number"
                  min={0}
                  value={settleForm.odometerStart}
                  onChange={(e) => setSettleForm((f) => ({ ...f, odometerStart: e.target.value }))}
                  className="mt-1 w-full h-9 rounded-md border px-3 text-sm"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium">Odo end (optional)</label>
                <input
                  type="number"
                  min={0}
                  value={settleForm.odometerEnd}
                  onChange={(e) => setSettleForm((f) => ({ ...f, odometerEnd: e.target.value }))}
                  className="mt-1 w-full h-9 rounded-md border px-3 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="text-[11px] font-medium">Notes</label>
              <textarea
                value={settleForm.settlementNotes}
                onChange={(e) => setSettleForm((f) => ({ ...f, settlementNotes: e.target.value }))}
                rows={2}
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm resize-none"
                placeholder="Where you went, pump, etc."
              />
            </div>
            <ProofUploader
              label="Spending images (receipt / pump — multiple)"
              files={spendFiles}
              onAdd={(list) => addFiles(list, setSpendFiles)}
              onRemove={(i) => removeFile(i, setSpendFiles)}
            />
            <div className="flex gap-2 pt-1">
              <Button type="submit" disabled={saving} className="h-9 bg-sky-600 hover:bg-sky-700 text-white gap-1">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                Submit settlement
              </Button>
              <Button type="button" variant="outline" className="h-9" onClick={() => setSettleFor(null)}>
                Cancel
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
