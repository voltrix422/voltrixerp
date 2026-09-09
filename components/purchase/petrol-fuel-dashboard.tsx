"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react"
import {
  ArrowLeft,
  Camera,
  Car,
  Check,
  ChevronRight,
  Fuel,
  Loader2,
  Plus,
  Trash2,
  Upload,
  X,
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
}: {
  label: string
  files: LocalFile[]
  onAdd: (list: FileList | null) => void
  onRemove: (index: number) => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">{label}</p>
      <div className="flex flex-wrap gap-2">
        {files.map((f, i) => (
          <div key={f.preview} className="relative h-16 w-16 rounded-lg overflow-hidden border">
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
          className="h-16 w-16 rounded-lg border border-dashed border-[hsl(var(--border))] flex flex-col items-center justify-center gap-0.5 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]/30"
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

function ProofGallery({
  title,
  urls,
  empty,
}: {
  title: string
  urls: string[]
  empty?: string
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold">{title}</p>
      {urls.length === 0 ? (
        <p className="text-[11px] text-[hsl(var(--muted-foreground))]">{empty || "None attached."}</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {urls.map((url) => (
            <a
              key={url}
              href={url}
              target="_blank"
              rel="noreferrer"
              className="h-24 w-24 sm:h-28 sm:w-28 rounded-xl overflow-hidden border border-[hsl(var(--border))] hover:ring-2 hover:ring-[#1faca6]/40"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="h-full w-full object-cover" />
            </a>
          ))}
        </div>
      )}
    </div>
  )
}

function belongsToUser(row: FuelAllotment, userId?: string, userName?: string) {
  if (row.personUserId && userId && row.personUserId === userId) return true
  if (userName && row.personName.toLowerCase() === userName.toLowerCase()) return true
  return false
}

export function PetrolFuelDashboard() {
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
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [mobileDetail, setMobileDetail] = useState(false)

  const [showAllot, setShowAllot] = useState(false)
  const [showVehicle, setShowVehicle] = useState(false)

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
      const mine = !isAdmin || view === "mine"
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
      setSelectedId((prev) => {
        if (prev && a.some((row) => row.id === prev)) return prev
        return a[0]?.id ?? null
      })
    } catch (err) {
      toast({
        title: "Could not load petrol",
        message: err instanceof Error ? err.message : "Try again",
        type: "error",
      })
    } finally {
      setLoading(false)
    }
  }, [toast, user?.id, user?.name, view, isAdmin])

  useEffect(() => {
    void load()
  }, [load])

  const activeVehicles = useMemo(() => vehicles.filter((v) => v.active), [vehicles])
  const selected = useMemo(
    () => allotments.find((a) => a.id === selectedId) ?? null,
    [allotments, selectedId],
  )

  const stats = useMemo(() => {
    const total = allotments.reduce((s, a) => s + (Number(a.amountPkr) || 0), 0)
    const settled = allotments.filter((a) => a.status === "settled").length
    return {
      count: allotments.length,
      total,
      settled,
      open: allotments.length - settled,
    }
  }, [allotments])

  function addFiles(list: FileList | null, setter: Dispatch<SetStateAction<LocalFile[]>>) {
    if (!list?.length) return
    const next = Array.from(list)
      .filter((f) => f.type.startsWith("image/"))
      .map((file) => ({ file, preview: URL.createObjectURL(file) }))
    setter((prev) => [...prev, ...next].slice(0, 8))
  }

  function removeFile(index: number, setter: Dispatch<SetStateAction<LocalFile[]>>) {
    setter((prev) => {
      const copy = [...prev]
      const [removed] = copy.splice(index, 1)
      if (removed) URL.revokeObjectURL(removed.preview)
      return copy
    })
  }

  function openAllotment(row: FuelAllotment) {
    setSelectedId(row.id)
    setMobileDetail(true)
    setSettleForm({ kmDriven: "", odometerStart: "", odometerEnd: "", settlementNotes: "" })
    spendFiles.forEach((f) => URL.revokeObjectURL(f.preview))
    setSpendFiles([])
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
      const created = await createFuelAllotment({
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
      setSelectedId(created.id)
      setMobileDetail(true)
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
    if (!selected) return
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
        id: selected.id,
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
    return belongsToUser(row, user?.id, user?.name)
  }

  function renderAllotmentCard(row: FuelAllotment) {
    const active = selectedId === row.id
    return (
      <button
        key={row.id}
        type="button"
        onClick={() => openAllotment(row)}
        className={`w-full text-left rounded-xl border px-3.5 py-3 transition-colors ${
          active
            ? "border-[#1faca6] bg-[#1faca6]/8 ring-1 ring-[#1faca6]/30"
            : "hover:bg-[hsl(var(--muted))]/25"
        }`}
      >
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold truncate">{row.personName}</p>
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
            <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-0.5 truncate">
              {row.vehicleName}
              {row.vehiclePlate ? ` · ${row.vehiclePlate}` : ""}
              {row.avgKmPerLiter ? ` · avg ${row.avgKmPerLiter} km/L` : ""}
            </p>
            <p className="text-sm font-semibold text-[#1faca6] mt-1">{fmtMoney(row.amountPkr)}</p>
            <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-0.5">
              Allotted {fmtWhen(row.allottedAt)}
              {row.allottedBy ? ` · ${row.allottedBy}` : ""}
            </p>
            {row.paymentProofUrls.length > 0 && (
              <p className="text-[10px] text-[#1faca6] mt-1">
                {row.paymentProofUrls.length} payment proof
                {row.paymentProofUrls.length === 1 ? "" : "s"}
              </p>
            )}
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-[hsl(var(--muted-foreground))] mt-1" />
        </div>
      </button>
    )
  }

  function renderDetail(row: FuelAllotment) {
    const exp = expectedKm(row.avgKmPerLiter, row.liters)
    const mine = belongsToUser(row, user?.id, user?.name)
    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold">{row.personName}</h2>
              <span
                className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded ${
                  row.status === "settled"
                    ? "bg-emerald-500/15 text-emerald-700"
                    : "bg-amber-500/15 text-amber-800"
                }`}
              >
                {row.status}
              </span>
              {mine && !isAdmin && (
                <span className="text-[10px] font-medium text-[#1faca6]">Your allotment</span>
              )}
            </div>
            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
              {row.vehicleName}
              {row.vehiclePlate ? ` · ${row.vehiclePlate}` : ""}
              {row.avgKmPerLiter ? ` · avg ${row.avgKmPerLiter} km/L` : ""}
            </p>
            <p className="text-2xl font-semibold text-[#1faca6] mt-2">
              {fmtMoney(row.amountPkr)}
              {row.liters != null ? (
                <span className="text-sm font-medium text-[hsl(var(--muted-foreground))] ml-2">
                  {row.liters} L
                </span>
              ) : null}
            </p>
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
              Allotted {fmtWhen(row.allottedAt)}
              {row.allottedBy ? ` by ${row.allottedBy}` : ""}
            </p>
            {row.notes ? (
              <p className="text-sm mt-2 rounded-lg bg-[hsl(var(--muted))]/30 px-3 py-2">{row.notes}</p>
            ) : null}
          </div>
          {isAdmin && row.status === "allotted" && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-xs text-red-600"
              onClick={() => {
                if (!confirm("Delete this allotment?")) return
                void deleteFuelAllotment(row.id)
                  .then(() => {
                    setSelectedId(null)
                    setMobileDetail(false)
                    return load()
                  })
                  .catch((err) =>
                    toast({
                      title: "Delete failed",
                      message: err instanceof Error ? err.message : "Try again",
                      type: "error",
                    }),
                  )
              }}
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </Button>
          )}
        </div>

        <div className="rounded-xl border bg-[hsl(var(--card))] p-4 space-y-3">
          <ProofGallery
            title={mine ? "Payment proof (sent to you)" : "Payment proof"}
            urls={row.paymentProofUrls}
            empty="No payment screenshot attached when allotted."
          />
        </div>

        {row.status === "settled" ? (
          <div className="rounded-xl border bg-[hsl(var(--card))] p-4 space-y-4">
            <div>
              <p className="text-xs font-semibold mb-1">Settlement</p>
              <p className="text-sm">
                <strong>{row.kmDriven ?? "—"} km</strong> driven
                {exp != null ? ` · expected ~${exp.toFixed(0)} km` : ""}
              </p>
              {(row.odometerStart != null || row.odometerEnd != null) && (
                <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-1">
                  Odometer {row.odometerStart ?? "—"} → {row.odometerEnd ?? "—"}
                </p>
              )}
              <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-1">
                Settled {fmtWhen(row.settledAt || "")}
                {row.settledBy ? ` · ${row.settledBy}` : ""}
              </p>
              {row.settlementNotes ? (
                <p className="text-sm mt-2 rounded-lg bg-[hsl(var(--muted))]/30 px-3 py-2">
                  {row.settlementNotes}
                </p>
              ) : null}
            </div>
            <ProofGallery
              title="Spending proofs (from person)"
              urls={row.spendingProofUrls}
              empty="No spending images submitted."
            />
          </div>
        ) : canSettle(row) ? (
          <form
            onSubmit={submitSettle}
            className="rounded-xl border bg-[hsl(var(--card))] p-4 space-y-3"
          >
            <div>
              <p className="text-sm font-semibold">Settle this allotment</p>
              <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-0.5">
                Enter KM driven and upload spending / pump photos. Admin will see this when they open
                this allotment.
              </p>
            </div>
            <div>
              <label className="text-[11px] font-medium">KM driven on this fuel *</label>
              <input
                type="number"
                min={1}
                step="0.1"
                value={settleForm.kmDriven}
                onChange={(e) => setSettleForm((f) => ({ ...f, kmDriven: e.target.value }))}
                className="mt-1 w-full h-10 rounded-md border px-3 text-sm"
                required
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
                  className="mt-1 w-full h-10 rounded-md border px-3 text-sm"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium">Odo end (optional)</label>
                <input
                  type="number"
                  min={0}
                  value={settleForm.odometerEnd}
                  onChange={(e) => setSettleForm((f) => ({ ...f, odometerEnd: e.target.value }))}
                  className="mt-1 w-full h-10 rounded-md border px-3 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="text-[11px] font-medium">Notes</label>
              <textarea
                value={settleForm.settlementNotes}
                onChange={(e) => setSettleForm((f) => ({ ...f, settlementNotes: e.target.value }))}
                rows={3}
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
            <Button
              type="submit"
              disabled={saving}
              className="h-10 bg-sky-600 hover:bg-sky-700 text-white gap-1.5"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Submit settlement
            </Button>
          </form>
        ) : (
          <div className="rounded-xl border border-dashed p-4 text-sm text-[hsl(var(--muted-foreground))]">
            Waiting for {row.personName} to settle with KM and spending proofs.
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[#1faca6]">
            <Fuel className="h-5 w-5" />
            <p className="text-xs font-semibold uppercase tracking-wide">Petrol / fuel</p>
          </div>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1 max-w-xl">
            {isAdmin
              ? "Allot fuel money to staff. Open a person to see payment proof and their settlement."
              : "Your fuel allotments only. Open one to see payment proof and submit KM + spending photos."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px]">
          <div className="rounded-lg border px-3 py-1.5 bg-[hsl(var(--card))]">
            <span className="text-[hsl(var(--muted-foreground))]">Allotments </span>
            <strong>{stats.count}</strong>
          </div>
          <div className="rounded-lg border px-3 py-1.5 bg-[hsl(var(--card))]">
            <span className="text-[hsl(var(--muted-foreground))]">Allotted </span>
            <strong className="text-[#1faca6]">{fmtMoney(stats.total)}</strong>
          </div>
          <div className="rounded-lg border px-3 py-1.5 bg-[hsl(var(--card))]">
            <span className="text-[hsl(var(--muted-foreground))]">Open </span>
            <strong className="text-amber-700">{stats.open}</strong>
          </div>
          <div className="rounded-lg border px-3 py-1.5 bg-[hsl(var(--card))]">
            <span className="text-[hsl(var(--muted-foreground))]">Settled </span>
            <strong className="text-emerald-700">{stats.settled}</strong>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border overflow-hidden text-xs">
          <button
            type="button"
            onClick={() => {
              setTab("allotments")
              setMobileDetail(false)
            }}
            className={`px-3 py-2 ${tab === "allotments" ? "bg-[#1faca6] text-white" : "bg-[hsl(var(--card))]"}`}
          >
            Allotments
          </button>
          {isAdmin && (
            <button
              type="button"
              onClick={() => {
                setTab("vehicles")
                setMobileDetail(false)
              }}
              className={`px-3 py-2 ${tab === "vehicles" ? "bg-[#1faca6] text-white" : "bg-[hsl(var(--card))]"}`}
            >
              Vehicles
            </button>
          )}
        </div>
        {tab === "allotments" && isAdmin && (
          <div className="inline-flex rounded-lg border overflow-hidden text-xs">
            <button
              type="button"
              onClick={() => setView("all")}
              className={`px-3 py-2 ${view === "all" ? "bg-[hsl(var(--muted))]" : "bg-[hsl(var(--card))]"}`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setView("mine")}
              className={`px-3 py-2 ${view === "mine" ? "bg-[hsl(var(--muted))]" : "bg-[hsl(var(--card))]"}`}
            >
              Mine
            </button>
          </div>
        )}
        <div className="ml-auto flex gap-2">
          {tab === "vehicles" && isAdmin && (
            <Button
              size="sm"
              className="h-9 text-xs gap-1"
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
              className="h-9 text-xs gap-1 bg-[#1faca6] hover:bg-[#17857f] text-white"
              onClick={() => setShowAllot(true)}
            >
              <Plus className="h-3.5 w-3.5" /> Allot fuel
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-24 text-sm text-[hsl(var(--muted-foreground))]">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : tab === "vehicles" ? (
        <div className="space-y-2 max-w-3xl">
          {vehicles.length === 0 ? (
            <p className="text-sm text-center text-[hsl(var(--muted-foreground))] py-16">
              No vehicles yet. Add a car and set its average (km/L).
            </p>
          ) : (
            vehicles.map((v) => (
              <div
                key={v.id}
                className="rounded-xl border bg-[hsl(var(--card))] px-4 py-3 flex flex-wrap items-center gap-3"
              >
                <div className="h-10 w-10 rounded-lg bg-[#1faca6]/10 text-[#1faca6] flex items-center justify-center">
                  <Car className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">
                    {v.name}
                    {!v.active && (
                      <span className="ml-2 text-[10px] text-[hsl(var(--muted-foreground))]">
                        Inactive
                      </span>
                    )}
                  </p>
                  <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
                    {v.plate || "No plate"} · Avg {v.avgKmPerLiter || "—"} km/L
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs"
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
          )}
        </div>
      ) : allotments.length === 0 ? (
        <p className="text-sm text-center text-[hsl(var(--muted-foreground))] py-16">
          {!isAdmin || view === "mine"
            ? "No fuel allotted to you yet."
            : "No allotments yet. Use Allot fuel to give money to a person."}
        </p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(280px,380px)_minmax(0,1fr)] gap-4 min-h-[60vh]">
          <div
            className={`space-y-2 ${mobileDetail ? "hidden lg:block" : "block"}`}
          >
            <p className="text-[11px] font-medium text-[hsl(var(--muted-foreground))] px-0.5">
              {!isAdmin || view === "mine" ? "Your allotments — tap to open" : "Allotments — tap a person to open"}
            </p>
            {allotments.map(renderAllotmentCard)}
          </div>

          <div
            className={`rounded-2xl border bg-[hsl(var(--background))] p-4 sm:p-6 ${
              mobileDetail ? "block" : "hidden lg:block"
            }`}
          >
            {mobileDetail && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mb-3 h-8 text-xs gap-1 lg:hidden -ml-2"
                onClick={() => setMobileDetail(false)}
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back to list
              </Button>
            )}
            {selected ? (
              renderDetail(selected)
            ) : (
              <div className="flex h-full min-h-[40vh] items-center justify-center text-sm text-[hsl(var(--muted-foreground))]">
                Select an allotment to see payment proof and settlement.
              </div>
            )}
          </div>
        </div>
      )}

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
                    {!s.erp_user_id ? " · (no login link)" : ""}
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
              label="Payment proof (screenshot) — visible on their allotment"
              files={paymentFiles}
              onAdd={(list) => addFiles(list, setPaymentFiles)}
              onRemove={(i) => removeFile(i, setPaymentFiles)}
            />
            <div className="flex gap-2 pt-1">
              <Button
                type="submit"
                disabled={saving}
                className="h-9 bg-[#1faca6] hover:bg-[#17857f] text-white gap-1"
              >
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
    </div>
  )
}
