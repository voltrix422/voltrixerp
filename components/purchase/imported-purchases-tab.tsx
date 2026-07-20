"use client"

import { useCallback, useEffect, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from "react"
import {
  Plus, Search, Loader2, Ship, ArrowLeft, Trash2, Lock, Calculator,
  ChevronRight, Package, Save, CheckCircle2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useDialog } from "@/components/ui/dialog-provider"
import { useToast } from "@/components/ui/toast"
import { useAuth } from "@/components/auth-provider"
import { getSuppliers, type Supplier } from "@/lib/purchase"
import {
  ATTACHMENT_CATEGORIES,
  CHARGE_CATEGORIES,
  CONTAINER_SIZES,
  CURRENCIES,
  IMPORT_STEPS,
  INCOTERMS,
  STATUS_LABELS,
  applyLandedCostToItems,
  calculateLandedCost,
  deleteImportShipment,
  emptyShipment,
  formatPkr,
  getImportShipments,
  newId,
  saveImportShipment,
  statusForStep,
  type AllocationMethod,
  type AttachmentCategory,
  type ChargeCategory,
  type ImportCharge,
  type ImportContainer,
  type ImportItem,
  type ImportShipment,
  type ImportShipmentStatus,
  type LandedCostSummary,
} from "@/lib/import-shipment"
import { ImportAttachments } from "@/components/purchase/import-attachments"
import { ImportShipmentManual } from "@/components/purchase/import-shipment-manual"

function statusVariant(s: ImportShipmentStatus): "default" | "secondary" | "outline" | "destructive" {
  if (s === "landed" || s === "received" || s === "closed") return "default"
  if (s === "draft") return "outline"
  if (s === "costing" || s === "clearance") return "secondary"
  return "secondary"
}

function Field({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={`space-y-1 min-w-0 ${className}`}>
      <label className="text-xs font-medium">{label}</label>
      {children}
    </div>
  )
}

const inputCls = "w-full min-w-0 h-9 rounded-md border bg-[hsl(var(--background))] px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"

export function ImportedPurchasesTab({ purchaseScopeId }: { purchaseScopeId: string }) {
  const { user } = useAuth()
  const { confirm } = useDialog()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [shipments, setShipments] = useState<ImportShipment[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState<ImportShipment | null>(null)
  const [draft, setDraft] = useState<ImportShipment | null>(null)

  const importedSuppliers = useMemo(
    () => suppliers.filter(s => s.type === "imported" || s.type === "trade"),
    [suppliers],
  )

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [rows, sups] = await Promise.all([
        getImportShipments(purchaseScopeId),
        getSuppliers(purchaseScopeId),
      ])
      setShipments(rows)
      setSuppliers(sups)
    } catch (e) {
      toast({
        type: "error",
        title: "Could not load imports",
        message: e instanceof Error ? e.message : "Error",
      })
    } finally {
      setLoading(false)
    }
  }, [purchaseScopeId, toast])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return shipments
    return shipments.filter(s =>
      [s.shipmentNumber, s.supplierName, s.blNumber, s.gdNumber, s.psid, s.pssid, s.contractRef]
        .join(" ")
        .toLowerCase()
        .includes(q),
    )
  }, [shipments, search])

  function openNew() {
    const base = emptyShipment(purchaseScopeId, user?.name || user?.email || "")
    const local: ImportShipment = {
      ...base,
      id: "",
      shipmentNumber: "(auto)",
    }
    setSelected(local)
    setDraft(local)
  }

  function openExisting(s: ImportShipment) {
    setSelected(s)
    setDraft({ ...s, containers: [...(s.containers || [])], items: [...(s.items || [])], charges: [...(s.charges || [])], attachments: [...(s.attachments || [])], payments: [...(s.payments || [])] })
  }

  function patch(p: Partial<ImportShipment>) {
    setDraft(d => (d ? { ...d, ...p } : d))
  }

  async function persist(extra?: Record<string, unknown>) {
    if (!draft) return null
    setSaving(true)
    try {
      const shipmentNumber =
        !draft.id || draft.shipmentNumber === "(auto)" ? undefined : draft.shipmentNumber
      const saved = await saveImportShipment({
        ...draft,
        id: draft.id || undefined,
        shipmentNumber: shipmentNumber as string | undefined,
        purchaseScopeId,
        createdBy: draft.createdBy || user?.name || "",
        ...extra,
      })
      setDraft(saved)
      setSelected(saved)
      await load()
      toast({ type: "success", title: "Saved", message: saved.shipmentNumber })
      return saved
    } catch (e) {
      toast({
        type: "error",
        title: "Save failed",
        message: e instanceof Error ? e.message : "Error",
      })
      return null
    } finally {
      setSaving(false)
    }
  }

  async function goStep(step: number) {
    if (!draft || draft.landedCostLocked && step < 6) {
      // allow viewing locked; block going back edits via readOnly on fields
    }
    const next = Math.min(7, Math.max(1, step))
    patch({ currentStep: next, status: draft?.landedCostLocked && next >= 6 ? (draft.receivedAtWarehouse ? "received" : "landed") : statusForStep(next) })
  }

  async function handleDelete(id: string) {
    const ok = await confirm({
      type: "confirm",
      title: "Delete import shipment?",
      message: "This cannot be undone.",
      confirmLabel: "Delete",
    })
    if (!ok) return
    await deleteImportShipment(id)
    setSelected(null)
    setDraft(null)
    await load()
    toast({ type: "success", title: "Deleted" })
  }

  if (selected && draft) {
    return (
      <ShipmentDetail
        draft={draft}
        patch={patch}
        setDraft={setDraft}
        saving={saving}
        onBack={() => { setSelected(null); setDraft(null); void load() }}
        onSave={() => void persist()}
        onPersist={persist}
        onStep={goStep}
        onDelete={draft.id ? () => void handleDelete(draft.id) : undefined}
        importedSuppliers={importedSuppliers}
        userName={user?.name || user?.email || ""}
      />
    )
  }

  return (
    <div className="p-4 sm:p-6 pt-4 space-y-4">
      <ImportShipmentManual />

      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div>
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Ship className="h-4 w-4" />
            Imported Purchases
          </h2>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
            Shipments · containers · PSW · landed cost per item
          </p>
        </div>
        <Button size="sm" className="h-9 text-xs" onClick={openNew}>
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          New import shipment
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search shipment #, supplier, B/L, GD, PSID…"
          className="w-full h-9 rounded-md border bg-[hsl(var(--background))] pl-9 pr-3 text-sm"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-[hsl(var(--muted-foreground))]">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed px-6 py-12 text-center">
          <Ship className="h-8 w-8 mx-auto mb-3 text-[hsl(var(--muted-foreground))]" />
          <p className="text-sm font-medium">No import shipments yet</p>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1 mb-4">
            Create a shipment to track containers, PSW clearance, and landed cost.
          </p>
          <Button size="sm" onClick={openNew}>
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Start first shipment
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-[hsl(var(--muted))]/30 text-left text-[11px] text-[hsl(var(--muted-foreground))]">
                  <th className="px-3 py-2 font-semibold">Shipment</th>
                  <th className="px-3 py-2 font-semibold">Supplier</th>
                  <th className="px-3 py-2 font-semibold">Containers</th>
                  <th className="px-3 py-2 font-semibold">B/L · GD</th>
                  <th className="px-3 py-2 font-semibold">Status</th>
                  <th className="px-3 py-2 font-semibold text-right">Landed total</th>
                  <th className="px-3 py-2 font-semibold w-10" />
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => {
                  const summary = s.landedCostSummary as LandedCostSummary
                  const total = summary?.grandTotalPkr
                  return (
                    <tr
                      key={s.id}
                      className="border-b last:border-0 hover:bg-[hsl(var(--muted))]/20 cursor-pointer"
                      onClick={() => openExisting(s)}
                    >
                      <td className="px-3 py-2.5">
                        <p className="font-mono text-xs font-semibold">{s.shipmentNumber}</p>
                        <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Step {s.currentStep}/7</p>
                      </td>
                      <td className="px-3 py-2.5">
                        <p className="text-xs">{s.supplierName || "—"}</p>
                        <p className="text-[10px] text-[hsl(var(--muted-foreground))]">{s.currency} @ {s.fxRate || "—"}</p>
                      </td>
                      <td className="px-3 py-2.5 text-xs">
                        {(s.containers || []).length || 0} · {(s.items || []).length || 0} items
                      </td>
                      <td className="px-3 py-2.5 text-[11px]">
                        <p>{s.blNumber || "—"}</p>
                        <p className="text-[hsl(var(--muted-foreground))]">{s.gdNumber || "—"}</p>
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge variant={statusVariant(s.status)} className="text-[10px]">
                          {STATUS_LABELS[s.status] || s.status}
                        </Badge>
                        {s.landedCostLocked && (
                          <span className="ml-1 inline-flex items-center text-[10px] text-[hsl(var(--muted-foreground))]">
                            <Lock className="h-3 w-3 mr-0.5" /> locked
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right text-xs font-medium">
                        {typeof total === "number" ? formatPkr(total) : "—"}
                      </td>
                      <td className="px-3 py-2.5">
                        <ChevronRight className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function ShipmentDetail({
  draft,
  patch,
  setDraft,
  saving,
  onBack,
  onSave,
  onPersist,
  onStep,
  onDelete,
  importedSuppliers,
  userName,
}: {
  draft: ImportShipment
  patch: (p: Partial<ImportShipment>) => void
  setDraft: Dispatch<SetStateAction<ImportShipment | null>>
  saving: boolean
  onBack: () => void
  onSave: () => void
  onPersist: (extra?: Record<string, unknown>) => Promise<ImportShipment | null>
  onStep: (step: number) => void
  onDelete?: () => void
  importedSuppliers: Supplier[]
  userName: string
}) {
  const locked = draft.landedCostLocked
  const step = draft.currentStep || 1
  const readOnly = locked && step < 7

  return (
    <div className="p-4 sm:p-6 pt-4 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start gap-3 justify-between">
        <div className="flex items-start gap-2 min-w-0">
          <Button type="button" variant="ghost" size="sm" className="h-8 px-2 shrink-0" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <p className="font-mono text-sm font-semibold">{draft.shipmentNumber}</p>
            <p className="text-xs text-[hsl(var(--muted-foreground))] truncate">
              {draft.supplierName || "New import"} · {STATUS_LABELS[draft.status]}
              {locked ? " · cost locked" : ""}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {onDelete && (
            <Button type="button" variant="outline" size="sm" className="h-8 text-xs text-red-600" onClick={onDelete}>
              <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
            </Button>
          )}
          <Button type="button" size="sm" className="h-8 text-xs" disabled={saving} onClick={onSave}>
            {saving ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1" />}
            Save
          </Button>
        </div>
      </div>

      {/* Stepper */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {IMPORT_STEPS.map(s => {
          const active = step === s.step
          const done = step > s.step
          return (
            <button
              key={s.step}
              type="button"
              onClick={() => onStep(s.step)}
              className={`shrink-0 px-2.5 py-1.5 rounded-md text-[11px] font-medium border cursor-pointer transition-colors ${
                active
                  ? "bg-[hsl(var(--foreground))] text-[hsl(var(--background))] border-transparent"
                  : done
                    ? "bg-[hsl(var(--muted))]/40 border-transparent"
                    : "bg-transparent text-[hsl(var(--muted-foreground))]"
              }`}
            >
              {s.step}. {s.short}
            </button>
          )
        })}
      </div>

      <ImportShipmentManual />

      {step === 1 && (
        <StepBasics
          draft={draft}
          patch={patch}
          readOnly={!!readOnly}
          importedSuppliers={importedSuppliers}
          userName={userName}
        />
      )}
      {step === 2 && (
        <StepContainersItems
          draft={draft}
          setDraft={setDraft}
          readOnly={!!readOnly}
          userName={userName}
        />
      )}
      {step === 3 && (
        <StepShipping draft={draft} patch={patch} readOnly={!!readOnly} userName={userName} />
      )}
      {step === 4 && (
        <StepPsw draft={draft} patch={patch} readOnly={!!readOnly} userName={userName} />
      )}
      {step === 5 && (
        <StepCharges draft={draft} setDraft={setDraft} readOnly={!!readOnly} userName={userName} />
      )}
      {step === 6 && (
        <StepLanded
          draft={draft}
          patch={patch}
          setDraft={setDraft}
          onPersist={onPersist}
          saving={saving}
          userName={userName}
        />
      )}
      {step === 7 && (
        <StepReceive draft={draft} patch={patch} setDraft={setDraft} onPersist={onPersist} saving={saving} userName={userName} />
      )}

      <div className="flex justify-between gap-2 pt-2 border-t">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={step <= 1}
          onClick={() => onStep(step - 1)}
        >
          Previous
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={step >= 7 || saving}
          onClick={async () => {
            await onPersist({
              currentStep: step,
              historyAction: "step_save",
              historyNote: `Saved step ${step}: ${IMPORT_STEPS[step - 1]?.title}`,
              historyBy: userName,
            })
            onStep(step + 1)
          }}
        >
          {step >= 7 ? "Done" : "Save & next"}
          <ChevronRight className="h-3.5 w-3.5 ml-1" />
        </Button>
      </div>
    </div>
  )
}

function StepBasics({
  draft, patch, readOnly, importedSuppliers, userName,
}: {
  draft: ImportShipment
  patch: (p: Partial<ImportShipment>) => void
  readOnly: boolean
  importedSuppliers: Supplier[]
  userName: string
}) {
  return (
    <div className="space-y-4">
      <Section title="Supplier & contract">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Imported supplier *">
            <select
              disabled={readOnly}
              value={draft.supplierId || ""}
              onChange={e => {
                const s = importedSuppliers.find(x => x.id === e.target.value)
                patch({ supplierId: e.target.value || null, supplierName: s?.name || "" })
              }}
              className={inputCls}
            >
              <option value="">Select supplier…</option>
              {importedSuppliers.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Or type supplier name">
            <input disabled={readOnly} value={draft.supplierName} onChange={e => patch({ supplierName: e.target.value })} className={inputCls} placeholder="Foreign supplier name" />
          </Field>
          <Field label="Contract / PO reference">
            <input disabled={readOnly} value={draft.contractRef} onChange={e => patch({ contractRef: e.target.value })} className={inputCls} />
          </Field>
          <Field label="Contract date">
            <input disabled={readOnly} type="date" value={draft.contractDate} onChange={e => patch({ contractDate: e.target.value })} className={inputCls} />
          </Field>
          <Field label="Incoterms">
            <select disabled={readOnly} value={draft.incoterms} onChange={e => patch({ incoterms: e.target.value })} className={inputCls}>
              {INCOTERMS.map(i => <option key={i} value={i}>{i}</option>)}
            </select>
          </Field>
          <Field label="Currency">
            <select disabled={readOnly} value={draft.currency} onChange={e => patch({ currency: e.target.value })} className={inputCls}>
              {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="FX rate (1 foreign = ? PKR) *">
            <input disabled={readOnly} type="number" min="0" step="0.01" value={draft.fxRate || ""} onChange={e => patch({ fxRate: Number(e.target.value) || 0 })} className={inputCls} placeholder="e.g. 280" />
          </Field>
          <Field label="Clearing agent">
            <input disabled={readOnly} value={draft.clearingAgent} onChange={e => patch({ clearingAgent: e.target.value })} className={inputCls} />
          </Field>
          <Field label="Origin country">
            <input disabled={readOnly} value={draft.originCountry} onChange={e => patch({ originCountry: e.target.value })} className={inputCls} />
          </Field>
          <Field label="Origin port">
            <input disabled={readOnly} value={draft.originPort} onChange={e => patch({ originPort: e.target.value })} className={inputCls} />
          </Field>
          <Field label="Destination port">
            <input disabled={readOnly} value={draft.destinationPort} onChange={e => patch({ destinationPort: e.target.value })} className={inputCls} />
          </Field>
          <Field label="Notes" className="sm:col-span-2">
            <textarea disabled={readOnly} value={draft.notes} onChange={e => patch({ notes: e.target.value })} className={`${inputCls} h-20 py-2`} />
          </Field>
        </div>
      </Section>
      <ImportAttachments
        attachments={draft.attachments}
        onChange={atts => patch({ attachments: atts })}
        uploadedBy={userName}
        readOnly={readOnly}
        allowedCategories={["contract", "proforma_invoice", "bank_lc_eif", "other"]}
        title="Contract & bank documents"
        hint="Upload contract/PO, proforma invoice, LC or EIF — multiple files allowed."
      />
    </div>
  )
}

function StepContainersItems({
  draft, setDraft, readOnly, userName,
}: {
  draft: ImportShipment
  setDraft: Dispatch<SetStateAction<ImportShipment | null>>
  readOnly: boolean
  userName: string
}) {
  const containers = draft.containers || []
  const items = draft.items || []

  function addContainer() {
    const c: ImportContainer = {
      id: newId(),
      containerNo: "",
      size: "40HC",
      sealNo: "",
      grossWeightKg: 0,
      netWeightKg: 0,
      cbm: 0,
      packageCount: 0,
      notes: "",
    }
    setDraft(d => d ? { ...d, containers: [...(d.containers || []), c] } : d)
  }

  function updateContainer(id: string, p: Partial<ImportContainer>) {
    setDraft(d => d ? { ...d, containers: (d.containers || []).map(c => c.id === id ? { ...c, ...p } : c) } : d)
  }

  function removeContainer(id: string) {
    setDraft(d => d ? {
      ...d,
      containers: (d.containers || []).filter(c => c.id !== id),
      items: (d.items || []).filter(i => i.containerId !== id),
    } : d)
  }

  function addItem(containerId: string) {
    const item: ImportItem = {
      id: newId(),
      containerId,
      description: "",
      sku: "",
      hsCode: "",
      qty: 1,
      receivedQty: 0,
      unit: "pcs",
      unitPriceForeign: 0,
      weightKg: 0,
      cbm: 0,
      origin: draft.originCountry || "",
      notes: "",
    }
    setDraft(d => d ? { ...d, items: [...(d.items || []), item] } : d)
  }

  function updateItem(id: string, p: Partial<ImportItem>) {
    setDraft(d => d ? { ...d, items: (d.items || []).map(i => i.id === id ? { ...i, ...p } : i) } : d)
  }

  function removeItem(id: string) {
    setDraft(d => d ? { ...d, items: (d.items || []).filter(i => i.id !== id) } : d)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Containers</p>
        {!readOnly && (
          <Button type="button" size="sm" variant="outline" className="h-8 text-xs" onClick={addContainer}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Add container
          </Button>
        )}
      </div>

      {containers.length === 0 && (
        <p className="text-xs text-[hsl(var(--muted-foreground))] rounded-md border border-dashed p-4 text-center">
          Add at least one container (or LCL), then add items inside it.
        </p>
      )}

      {containers.map((c, idx) => {
        const cItems = items.filter(i => i.containerId === c.id)
        return (
          <div key={c.id} className="rounded-lg border p-3 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-bold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                Container {idx + 1}
              </p>
              {!readOnly && (
                <Button type="button" variant="ghost" size="sm" className="h-7 text-xs text-red-600" onClick={() => removeContainer(c.id)}>
                  Remove
                </Button>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Field label="Container no.">
                <input disabled={readOnly} value={c.containerNo} onChange={e => updateContainer(c.id, { containerNo: e.target.value })} className={inputCls} placeholder="MSKU…" />
              </Field>
              <Field label="Size">
                <select disabled={readOnly} value={c.size} onChange={e => updateContainer(c.id, { size: e.target.value })} className={inputCls}>
                  {CONTAINER_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="Seal no.">
                <input disabled={readOnly} value={c.sealNo} onChange={e => updateContainer(c.id, { sealNo: e.target.value })} className={inputCls} />
              </Field>
              <Field label="Packages">
                <input disabled={readOnly} type="number" value={c.packageCount || ""} onChange={e => updateContainer(c.id, { packageCount: Number(e.target.value) || 0 })} className={inputCls} />
              </Field>
              <Field label="Gross kg">
                <input disabled={readOnly} type="number" value={c.grossWeightKg || ""} onChange={e => updateContainer(c.id, { grossWeightKg: Number(e.target.value) || 0 })} className={inputCls} />
              </Field>
              <Field label="Net kg">
                <input disabled={readOnly} type="number" value={c.netWeightKg || ""} onChange={e => updateContainer(c.id, { netWeightKg: Number(e.target.value) || 0 })} className={inputCls} />
              </Field>
              <Field label="CBM">
                <input disabled={readOnly} type="number" step="0.01" value={c.cbm || ""} onChange={e => updateContainer(c.id, { cbm: Number(e.target.value) || 0 })} className={inputCls} />
              </Field>
            </div>

            <div className="flex items-center justify-between pt-1">
              <p className="text-xs font-semibold flex items-center gap-1">
                <Package className="h-3.5 w-3.5" /> Items in this container
              </p>
              {!readOnly && (
                <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => addItem(c.id)}>
                  <Plus className="h-3 w-3 mr-1" /> Add item
                </Button>
              )}
            </div>

            {cItems.length === 0 ? (
              <p className="text-[11px] text-[hsl(var(--muted-foreground))]">No items yet.</p>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-[hsl(var(--muted))]/30 text-left text-[10px] text-[hsl(var(--muted-foreground))]">
                      <th className="px-2 py-1.5">Description</th>
                      <th className="px-2 py-1.5">HS</th>
                      <th className="px-2 py-1.5">Qty</th>
                      <th className="px-2 py-1.5">Unit {draft.currency}</th>
                      <th className="px-2 py-1.5">Kg</th>
                      <th className="px-2 py-1.5">CBM</th>
                      <th className="px-2 py-1.5 w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {cItems.map(item => (
                      <tr key={item.id} className="border-t">
                        <td className="px-2 py-1">
                          <input disabled={readOnly} value={item.description} onChange={e => updateItem(item.id, { description: e.target.value })} className={inputCls + " h-8"} placeholder="Product" />
                          <input disabled={readOnly} value={item.sku} onChange={e => updateItem(item.id, { sku: e.target.value })} className={inputCls + " h-7 mt-1 text-[11px]"} placeholder="SKU (optional)" />
                        </td>
                        <td className="px-2 py-1">
                          <input disabled={readOnly} value={item.hsCode} onChange={e => updateItem(item.id, { hsCode: e.target.value })} className={inputCls + " h-8 w-24"} placeholder="HS code" />
                        </td>
                        <td className="px-2 py-1">
                          <input disabled={readOnly} type="number" value={item.qty || ""} onChange={e => updateItem(item.id, { qty: Number(e.target.value) || 0 })} className={inputCls + " h-8 w-20"} />
                        </td>
                        <td className="px-2 py-1">
                          <input disabled={readOnly} type="number" step="0.01" value={item.unitPriceForeign || ""} onChange={e => updateItem(item.id, { unitPriceForeign: Number(e.target.value) || 0 })} className={inputCls + " h-8 w-24"} />
                        </td>
                        <td className="px-2 py-1">
                          <input disabled={readOnly} type="number" step="0.01" value={item.weightKg || ""} onChange={e => updateItem(item.id, { weightKg: Number(e.target.value) || 0 })} className={inputCls + " h-8 w-20"} />
                        </td>
                        <td className="px-2 py-1">
                          <input disabled={readOnly} type="number" step="0.001" value={item.cbm || ""} onChange={e => updateItem(item.id, { cbm: Number(e.target.value) || 0 })} className={inputCls + " h-8 w-20"} />
                        </td>
                        <td className="px-2 py-1">
                          {!readOnly && (
                            <button type="button" className="text-red-600 cursor-pointer" onClick={() => removeItem(item.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )
      })}

      <ImportAttachments
        attachments={draft.attachments}
        onChange={atts => setDraft(d => d ? { ...d, attachments: atts } : d)}
        uploadedBy={userName}
        readOnly={readOnly}
        allowedCategories={["commercial_invoice", "packing_list", "other"]}
        title="Invoice & packing list"
        hint="Commercial invoice and packing list for the container(s)."
      />
    </div>
  )
}

function StepShipping({
  draft, patch, readOnly, userName,
}: {
  draft: ImportShipment
  patch: (p: Partial<ImportShipment>) => void
  readOnly: boolean
  userName: string
}) {
  return (
    <div className="space-y-4">
      <Section title="Bill of Lading & vessel">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="B/L number">
            <input disabled={readOnly} value={draft.blNumber} onChange={e => patch({ blNumber: e.target.value })} className={inputCls} />
          </Field>
          <Field label="Vessel name">
            <input disabled={readOnly} value={draft.vesselName} onChange={e => patch({ vesselName: e.target.value })} className={inputCls} />
          </Field>
          <Field label="Voyage no.">
            <input disabled={readOnly} value={draft.voyageNo} onChange={e => patch({ voyageNo: e.target.value })} className={inputCls} />
          </Field>
          <Field label="ETD">
            <input disabled={readOnly} type="date" value={draft.etd} onChange={e => patch({ etd: e.target.value })} className={inputCls} />
          </Field>
          <Field label="ETA">
            <input disabled={readOnly} type="date" value={draft.eta} onChange={e => patch({ eta: e.target.value })} className={inputCls} />
          </Field>
          <Field label="ATA (actual arrival)">
            <input disabled={readOnly} type="date" value={draft.ata} onChange={e => patch({ ata: e.target.value })} className={inputCls} />
          </Field>
          <Field label="IGM number">
            <input disabled={readOnly} value={draft.igmNumber} onChange={e => patch({ igmNumber: e.target.value })} className={inputCls} />
          </Field>
          <Field label="IGM date">
            <input disabled={readOnly} type="date" value={draft.igmDate} onChange={e => patch({ igmDate: e.target.value })} className={inputCls} />
          </Field>
        </div>
      </Section>
      <ImportAttachments
        attachments={draft.attachments}
        onChange={atts => patch({ attachments: atts })}
        uploadedBy={userName}
        readOnly={readOnly}
        allowedCategories={["bill_of_lading", "insurance", "container_photos", "other"]}
        title="Shipping documents"
        hint="B/L, insurance, container photos — multiple files OK."
      />
    </div>
  )
}

function StepPsw({
  draft, patch, readOnly, userName,
}: {
  draft: ImportShipment
  patch: (p: Partial<ImportShipment>) => void
  readOnly: boolean
  userName: string
}) {
  return (
    <div className="space-y-4">
      <Section title="PSW Goods Declaration & payment IDs">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="GD number">
            <input disabled={readOnly} value={draft.gdNumber} onChange={e => patch({ gdNumber: e.target.value })} className={inputCls} />
          </Field>
          <Field label="GD date">
            <input disabled={readOnly} type="date" value={draft.gdDate} onChange={e => patch({ gdDate: e.target.value })} className={inputCls} />
          </Field>
          <Field label="PSID (payment slip)">
            <input disabled={readOnly} value={draft.psid} onChange={e => patch({ psid: e.target.value })} className={inputCls} placeholder="From PSW after submit" />
          </Field>
          <Field label="PSSID">
            <input disabled={readOnly} value={draft.pssid} onChange={e => patch({ pssid: e.target.value })} className={inputCls} />
          </Field>
          <Field label="Collectorate">
            <input disabled={readOnly} value={draft.collectorate} onChange={e => patch({ collectorate: e.target.value })} className={inputCls} placeholder="e.g. MCC Appraisement West" />
          </Field>
          <Field label="Assessment channel">
            <select disabled={readOnly} value={draft.assessmentChannel} onChange={e => patch({ assessmentChannel: e.target.value })} className={inputCls}>
              <option value="">Select…</option>
              <option value="Green">Green</option>
              <option value="Yellow">Yellow</option>
              <option value="Red">Red</option>
            </select>
          </Field>
        </div>
      </Section>
      <ImportAttachments
        attachments={draft.attachments}
        onChange={atts => patch({ attachments: atts })}
        uploadedBy={userName}
        readOnly={readOnly}
        allowedCategories={["psw_gd", "psid_receipt", "customs_assessment", "duty_tax_challan", "other"]}
        title="PSW & customs proofs"
        hint="GD printout, PSID receipt, assessment, duty/tax challans."
      />
    </div>
  )
}

function StepCharges({
  draft, setDraft, readOnly, userName,
}: {
  draft: ImportShipment
  setDraft: Dispatch<SetStateAction<ImportShipment | null>>
  readOnly: boolean
  userName: string
}) {
  const charges = draft.charges || []
  const items = draft.items || []

  function addCharge(partial?: Partial<ImportCharge>) {
    const cat = (partial?.category || "ocean_freight") as ChargeCategory
    const meta = CHARGE_CATEGORIES.find(c => c.value === cat)
    const c: ImportCharge = {
      id: newId(),
      category: cat,
      description: meta?.label || "",
      amount: 0,
      currency: "PKR",
      fxRate: 0,
      isShared: meta?.typicallyShared ?? true,
      itemId: "",
      allocationMethod: "",
      paid: false,
      paymentRef: "",
      notes: "",
      ...partial,
    }
    setDraft(d => d ? { ...d, charges: [...(d.charges || []), c] } : d)
  }

  function updateCharge(id: string, p: Partial<ImportCharge>) {
    setDraft(d => d ? { ...d, charges: (d.charges || []).map(c => c.id === id ? { ...c, ...p } : c) } : d)
  }

  function removeCharge(id: string) {
    setDraft(d => d ? { ...d, charges: (d.charges || []).filter(c => c.id !== id) } : d)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">All landing charges</p>
          <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
            Shared costs split across items · direct costs go to one item (e.g. duty by HS).
          </p>
        </div>
        {!readOnly && (
          <Button type="button" size="sm" variant="outline" className="h-8 text-xs" onClick={() => addCharge()}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Add charge
          </Button>
        )}
      </div>

      {!readOnly && (
        <div className="flex flex-wrap gap-1.5">
          {(["ocean_freight", "customs_duty", "sales_tax", "clearing_agent", "local_transport", "bank_charges"] as ChargeCategory[]).map(cat => (
            <button
              key={cat}
              type="button"
              onClick={() => addCharge({ category: cat })}
              className="text-[10px] px-2 py-1 rounded-md border hover:bg-[hsl(var(--muted))]/40 cursor-pointer"
            >
              + {CHARGE_CATEGORIES.find(c => c.value === cat)?.label}
            </button>
          ))}
        </div>
      )}

      {charges.length === 0 ? (
        <p className="text-xs text-[hsl(var(--muted-foreground))] border border-dashed rounded-md p-4 text-center">
          Add freight, duties, clearing, transport, bank charges, etc.
        </p>
      ) : (
        <div className="space-y-2">
          {charges.map(c => (
            <div key={c.id} className="rounded-md border p-3 grid grid-cols-1 sm:grid-cols-6 gap-2">
              <Field label="Type" className="sm:col-span-2">
                <select
                  disabled={readOnly}
                  value={c.category}
                  onChange={e => {
                    const cat = e.target.value as ChargeCategory
                    const meta = CHARGE_CATEGORIES.find(x => x.value === cat)
                    updateCharge(c.id, {
                      category: cat,
                      description: c.description || meta?.label || "",
                      isShared: meta?.typicallyShared ?? c.isShared,
                    })
                  }}
                  className={inputCls}
                >
                  {CHARGE_CATEGORIES.map(x => (
                    <option key={x.value} value={x.value}>{x.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Amount">
                <input disabled={readOnly} type="number" step="0.01" value={c.amount || ""} onChange={e => updateCharge(c.id, { amount: Number(e.target.value) || 0 })} className={inputCls} />
              </Field>
              <Field label="Currency">
                <select disabled={readOnly} value={c.currency} onChange={e => updateCharge(c.id, { currency: e.target.value })} className={inputCls}>
                  {CURRENCIES.map(cur => <option key={cur} value={cur}>{cur}</option>)}
                </select>
              </Field>
              <Field label="FX (if foreign)">
                <input disabled={readOnly || c.currency === "PKR"} type="number" step="0.01" value={c.fxRate || ""} onChange={e => updateCharge(c.id, { fxRate: Number(e.target.value) || 0 })} className={inputCls} placeholder="or use shipment FX" />
              </Field>
              <Field label="Shared?">
                <select
                  disabled={readOnly}
                  value={c.isShared ? "shared" : "direct"}
                  onChange={e => updateCharge(c.id, { isShared: e.target.value === "shared" })}
                  className={inputCls}
                >
                  <option value="shared">Shared (allocate)</option>
                  <option value="direct">Direct (one item)</option>
                </select>
              </Field>
              {!c.isShared && (
                <Field label="Item" className="sm:col-span-2">
                  <select disabled={readOnly} value={c.itemId || ""} onChange={e => updateCharge(c.id, { itemId: e.target.value })} className={inputCls}>
                    <option value="">Select item…</option>
                    {items.map(i => (
                      <option key={i.id} value={i.id}>{i.description || i.sku || i.id}</option>
                    ))}
                  </select>
                </Field>
              )}
              <Field label="Description" className="sm:col-span-2">
                <input disabled={readOnly} value={c.description} onChange={e => updateCharge(c.id, { description: e.target.value })} className={inputCls} />
              </Field>
              <Field label="Payment ref">
                <input disabled={readOnly} value={c.paymentRef} onChange={e => updateCharge(c.id, { paymentRef: e.target.value })} className={inputCls} />
              </Field>
              <div className="flex items-end gap-2 sm:col-span-2">
                <label className="flex items-center gap-1.5 text-xs h-9">
                  <input disabled={readOnly} type="checkbox" checked={c.paid} onChange={e => updateCharge(c.id, { paid: e.target.checked })} />
                  Paid
                </label>
                {!readOnly && (
                  <Button type="button" variant="ghost" size="sm" className="h-8 text-xs text-red-600 ml-auto" onClick={() => removeCharge(c.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <ImportAttachments
        attachments={draft.attachments}
        onChange={atts => setDraft(d => d ? { ...d, attachments: atts } : d)}
        uploadedBy={userName}
        readOnly={readOnly}
        allowedCategories={["freight_invoice", "clearing_agent_invoice", "transport_invoice", "payment_proof", "other"]}
        title="Charge invoices & payment proofs"
        hint="Freight, clearing agent, transport invoices and bank payment proofs."
      />
    </div>
  )
}

function StepLanded({
  draft, patch, setDraft, onPersist, saving, userName,
}: {
  draft: ImportShipment
  patch: (p: Partial<ImportShipment>) => void
  setDraft: Dispatch<SetStateAction<ImportShipment | null>>
  onPersist: (extra?: Record<string, unknown>) => Promise<ImportShipment | null>
  saving: boolean
  userName: string
}) {
  const preview = useMemo(
    () => calculateLandedCost(draft),
    [draft],
  )

  function applyLocal() {
    const summary = calculateLandedCost(draft)
    const items = applyLandedCostToItems(draft.items || [], summary)
    setDraft(d => d ? { ...d, items, landedCostSummary: summary } : d)
  }

  async function lock() {
    applyLocal()
    await onPersist({
      recalculateLandedCost: true,
      lockLandedCost: true,
      historyAction: "lock_landed_cost",
      historyNote: "Landed cost calculated and locked",
      historyBy: userName,
    })
  }

  const summary = (draft.landedCostSummary && "lines" in draft.landedCostSummary
    ? draft.landedCostSummary
    : preview) as LandedCostSummary

  const containerName = (id: string) =>
    (draft.containers || []).find(c => c.id === id)?.containerNo || "—"

  return (
    <div className="space-y-4">
      <Section title="Allocation & calculate">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Allocate shared costs by">
            <select
              disabled={draft.landedCostLocked}
              value={draft.allocationMethod}
              onChange={e => patch({ allocationMethod: e.target.value as AllocationMethod })}
              className={inputCls}
            >
              <option value="by_value">Invoice value (recommended)</option>
              <option value="by_weight">Weight (kg)</option>
              <option value="by_cbm">Volume (CBM)</option>
              <option value="by_qty">Quantity</option>
            </select>
          </Field>
          <Field label="FX rate in use">
            <input disabled value={draft.fxRate} className={inputCls} />
          </Field>
          <div className="flex items-end gap-2">
            <Button type="button" size="sm" variant="outline" className="h-9 text-xs" disabled={draft.landedCostLocked} onClick={applyLocal}>
              <Calculator className="h-3.5 w-3.5 mr-1" /> Calculate
            </Button>
            <Button type="button" size="sm" className="h-9 text-xs" disabled={saving || draft.landedCostLocked} onClick={() => void lock()}>
              {saving ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Lock className="h-3.5 w-3.5 mr-1" />}
              Lock landed cost
            </Button>
          </div>
        </div>
        {draft.landedCostLocked && (
          <p className="text-[11px] text-emerald-700 mt-2 flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5" /> Landed cost locked — unit costs below are final for this shipment.
          </p>
        )}
      </Section>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Stat label="Product (PKR)" value={formatPkr(summary.productTotalPkr || 0)} />
        <Stat label="Shared charges" value={formatPkr(summary.sharedChargesPkr || 0)} />
        <Stat label="Direct charges" value={formatPkr(summary.directChargesPkr || 0)} />
        <Stat label="Grand total" value={formatPkr(summary.grandTotalPkr || 0)} highlight />
      </div>

      <div className="rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[hsl(var(--muted))]/30 text-left text-[10px] text-[hsl(var(--muted-foreground))]">
                <th className="px-3 py-2">Item</th>
                <th className="px-3 py-2">Container</th>
                <th className="px-3 py-2 text-right">Qty</th>
                <th className="px-3 py-2 text-right">Product</th>
                <th className="px-3 py-2 text-right">Allocated</th>
                <th className="px-3 py-2 text-right">Direct</th>
                <th className="px-3 py-2 text-right">Total landed</th>
                <th className="px-3 py-2 text-right">Unit landed</th>
              </tr>
            </thead>
            <tbody>
              {(summary.lines || []).map(line => (
                <tr key={line.itemId} className="border-t">
                  <td className="px-3 py-2 font-medium">{line.description || "—"}</td>
                  <td className="px-3 py-2 text-[hsl(var(--muted-foreground))]">{containerName(line.containerId)}</td>
                  <td className="px-3 py-2 text-right">{line.receivedQty || line.qty}</td>
                  <td className="px-3 py-2 text-right">{formatPkr(line.productCostPkr)}</td>
                  <td className="px-3 py-2 text-right">{formatPkr(line.allocatedChargesPkr)}</td>
                  <td className="px-3 py-2 text-right">{formatPkr(line.directChargesPkr)}</td>
                  <td className="px-3 py-2 text-right font-semibold">{formatPkr(line.totalLandedPkr)}</td>
                  <td className="px-3 py-2 text-right font-bold text-emerald-700 dark:text-emerald-400">
                    {formatPkr(line.unitLandedCost)}
                  </td>
                </tr>
              ))}
              {(!summary.lines || summary.lines.length === 0) && (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-[hsl(var(--muted-foreground))]">
                    Add containers/items and charges, then Calculate.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {(summary.chargeBreakdown || []).length > 0 && (
        <Section title="Charge breakdown">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {summary.chargeBreakdown.map(b => (
              <div key={b.category} className="rounded-md border px-3 py-2 text-xs flex justify-between gap-2">
                <span className="text-[hsl(var(--muted-foreground))] capitalize">{b.category.replace(/_/g, " ")}</span>
                <span className="font-medium">{formatPkr(b.amountPkr)}</span>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  )
}

function StepReceive({
  draft, patch, setDraft, onPersist, saving, userName,
}: {
  draft: ImportShipment
  patch: (p: Partial<ImportShipment>) => void
  setDraft: Dispatch<SetStateAction<ImportShipment | null>>
  onPersist: (extra?: Record<string, unknown>) => Promise<ImportShipment | null>
  saving: boolean
  userName: string
}) {
  function updateItem(id: string, receivedQty: number) {
    setDraft(d => d ? {
      ...d,
      items: (d.items || []).map(i => i.id === id ? { ...i, receivedQty } : i),
    } : d)
  }

  async function markReceived() {
    await onPersist({
      receivedAtWarehouse: true,
      currentStep: 7,
      status: "received",
      recalculateLandedCost: true,
      historyAction: "warehouse_receive",
      historyNote: "Marked received at warehouse",
      historyBy: userName,
    })
  }

  return (
    <div className="space-y-4">
      <Section title="Warehouse receive">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Warehouse / location">
            <input value={draft.warehouseLocation} onChange={e => patch({ warehouseLocation: e.target.value })} className={inputCls} placeholder="Main warehouse…" />
          </Field>
          <Field label="Received date">
            <input type="date" value={draft.receivedDate} onChange={e => patch({ receivedDate: e.target.value })} className={inputCls} />
          </Field>
        </div>
      </Section>

      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-[hsl(var(--muted))]/30 text-left text-[10px] text-[hsl(var(--muted-foreground))]">
              <th className="px-3 py-2">Item</th>
              <th className="px-3 py-2 text-right">Shipped qty</th>
              <th className="px-3 py-2 text-right">Received qty</th>
              <th className="px-3 py-2 text-right">Unit landed</th>
            </tr>
          </thead>
          <tbody>
            {(draft.items || []).map(item => (
              <tr key={item.id} className="border-t">
                <td className="px-3 py-2">{item.description || "—"}</td>
                <td className="px-3 py-2 text-right">{item.qty}</td>
                <td className="px-3 py-2 text-right">
                  <input
                    type="number"
                    className={inputCls + " h-8 w-24 ml-auto"}
                    value={item.receivedQty || item.qty || ""}
                    onChange={e => updateItem(item.id, Number(e.target.value) || 0)}
                  />
                </td>
                <td className="px-3 py-2 text-right font-semibold">
                  {item.unitLandedCost != null ? formatPkr(item.unitLandedCost) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ImportAttachments
        attachments={draft.attachments}
        onChange={atts => patch({ attachments: atts })}
        uploadedBy={userName}
        allowedCategories={["grn", "container_photos", "other"]}
        title="GRN & receive proofs"
        hint="Upload goods receipt note and unload photos."
      />

      <Button type="button" size="sm" disabled={saving || draft.receivedAtWarehouse} onClick={() => void markReceived()}>
        {saving ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1" />}
        {draft.receivedAtWarehouse ? "Already received" : "Mark received at warehouse"}
      </Button>

      {/* All attachments overview */}
      <Section title="Full document file (all categories)">
        <ImportAttachments
          attachments={draft.attachments}
          onChange={atts => patch({ attachments: atts })}
          uploadedBy={userName}
          title="All attachments"
          hint={`Total ${(draft.attachments || []).length} file(s). Categories: ${ATTACHMENT_CATEGORIES.map(c => c.label).join(", ")}.`}
        />
      </Section>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border p-3 sm:p-4 space-y-3">
      <p className="text-sm font-semibold">{title}</p>
      {children}
    </div>
  )
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-lg border px-3 py-2 ${highlight ? "bg-[hsl(var(--muted))]/30" : ""}`}>
      <p className="text-[10px] text-[hsl(var(--muted-foreground))]">{label}</p>
      <p className={`text-sm font-semibold ${highlight ? "text-emerald-700 dark:text-emerald-400" : ""}`}>{value}</p>
    </div>
  )
}
