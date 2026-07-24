"use client"

import { useCallback, useEffect, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from "react"
import {
  Plus, Search, Loader2, Ship, ArrowLeft, Trash2, Lock, Calculator,
  ChevronRight, Package, Save, CheckCircle2, HelpCircle, BookMarked, Hash,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useDialog } from "@/components/ui/dialog-provider"
import { useToast } from "@/components/ui/toast"
import { useAuth } from "@/components/auth-provider"
import { getSuppliers, saveSupplier, type Supplier } from "@/lib/purchase"
import {
  CHARGE_CATEGORIES,
  CONTAINER_SIZES,
  CURRENCIES,
  DESTINATION_PORTS,
  DESTINATION_PORT_CUSTOM,
  IMPORT_STEPS,
  IMPORT_STEP_COUNT,
  INCOTERMS,
  QUICK_ADD_SROS,
  STATUS_LABELS,
  applyLandedCostToItems,
  calculateLandedCost,
  deleteImportShipment,
  emptyShipment,
  formatPkr,
  getImportShipments,
  loadAgentLibrary,
  loadSroLibrary,
  newId,
  normalizeImportStep,
  saveAgentLibrary,
  saveImportShipment,
  saveSroLibrary,
  statusForStep,
  syncDutiesIntoCharges,
  type AllocationMethod,
  type ChargeCategory,
  type ClearingAgent,
  type CustomsDutyEntry,
  type ImportCharge,
  type ImportContainer,
  type ImportItem,
  type ImportShipment,
  type ImportShipmentStatus,
  type ImportSro,
  type LandedCostSummary,
} from "@/lib/import-shipment"
import { ImportAttachments } from "@/components/purchase/import-attachments"
import { ImportShipmentManual } from "@/components/purchase/import-shipment-manual"
import { ImportSroDrawer } from "@/components/purchase/import-sro-drawer"

function statusVariant(s: ImportShipmentStatus): "default" | "secondary" | "outline" | "destructive" {
  if (s === "landed" || s === "received" || s === "closed") return "default"
  if (s === "draft") return "outline"
  if (s === "costing" || s === "clearance") return "secondary"
  return "secondary"
}

function Field({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={`space-y-0.5 min-w-0 ${className}`}>
      <label className="text-[10px] font-medium text-[hsl(var(--muted-foreground))] leading-none">{label}</label>
      {children}
    </div>
  )
}

const inputCls =
  "w-full min-w-0 h-7 rounded border bg-[hsl(var(--background))] px-2 text-xs focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))] transition-colors"

const btnHover = "cursor-pointer transition-all duration-150 hover:shadow-sm hover:brightness-[0.97] active:scale-[0.98]"
const chipHover =
  "text-[10px] px-1.5 py-0.5 rounded border cursor-pointer transition-all duration-150 hover:bg-[hsl(var(--muted))]/50 hover:border-[hsl(var(--foreground))]/25 hover:shadow-sm active:scale-[0.98]"

const DUTY_CATEGORIES: ChargeCategory[] = [
  "customs_duty",
  "additional_customs_duty",
  "duty_tax_customs_partial",
  "sales_tax",
  "income_tax",
  "fed",
  "regulatory_fee",
  "psw_fee",
  "other",
]

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
  const [showHelp, setShowHelp] = useState(false)
  const [sroDrawerOpen, setSroDrawerOpen] = useState(false)
  const [sroLibrary, setSroLibrary] = useState<ImportSro[]>([])
  const [agentLibrary, setAgentLibrary] = useState<ClearingAgent[]>([])

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
      setSroLibrary(loadSroLibrary(purchaseScopeId))
      setAgentLibrary(loadAgentLibrary(purchaseScopeId))
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

  function persistSroLibrary(next: ImportSro[]) {
    setSroLibrary(next)
    saveSroLibrary(purchaseScopeId, next)
  }

  function addSroToLibrary(partial?: Partial<ImportSro>) {
    const code = (partial?.code || "").trim()
    if (!code) {
      toast({ type: "error", title: "SRO code required" })
      return
    }
    if (sroLibrary.some(s => s.code.toLowerCase() === code.toLowerCase())) {
      toast({ type: "error", title: "SRO already in library", message: code })
      return
    }
    const row: ImportSro = {
      id: newId(),
      code,
      title: (partial?.title || "").trim(),
      description: (partial?.description || "").trim(),
    }
    persistSroLibrary([row, ...sroLibrary])
    toast({ type: "success", title: "SRO saved", message: code })
  }

  function removeSroFromLibrary(id: string) {
    persistSroLibrary(sroLibrary.filter(s => s.id !== id))
  }

  function persistAgents(next: ClearingAgent[]) {
    setAgentLibrary(next)
    saveAgentLibrary(purchaseScopeId, next)
  }

  async function refreshSuppliers() {
    const sups = await getSuppliers(purchaseScopeId)
    setSuppliers(sups)
    return sups
  }

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
    const step = normalizeImportStep(s.currentStep)
    setSelected(s)
    setDraft({
      ...s,
      currentStep: step,
      containers: [...(s.containers || [])],
      items: [...(s.items || [])],
      charges: [...(s.charges || [])],
      attachments: [...(s.attachments || [])],
      payments: [...(s.payments || [])],
      customsDuties: [...(s.customsDuties || [])],
      gdSros: [...(s.gdSros || [])],
    })
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
      setDraft({
        ...saved,
        currentStep: normalizeImportStep(saved.currentStep),
        customsDuties: saved.customsDuties || [],
        gdSros: saved.gdSros || [],
      })
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
    const next = normalizeImportStep(step)
    patch({
      currentStep: next,
      status:
        draft?.landedCostLocked && next >= 5
          ? draft.receivedAtWarehouse
            ? "received"
            : "landed"
          : statusForStep(next),
    })
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
      <>
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
          purchaseScopeId={purchaseScopeId}
          onSuppliersRefresh={refreshSuppliers}
          agentLibrary={agentLibrary}
          onAgentsChange={persistAgents}
          userName={user?.name || user?.email || ""}
          sroLibrary={sroLibrary}
          onAddSroToLibrary={addSroToLibrary}
          onOpenSroLibrary={() => setSroDrawerOpen(true)}
        />
        <ImportSroDrawer
          open={sroDrawerOpen}
          onClose={() => setSroDrawerOpen(false)}
          sroLibrary={sroLibrary}
          onAdd={addSroToLibrary}
          onRemove={removeSroFromLibrary}
        />
      </>
    )
  }

  return (
    <div className="p-3 sm:p-4 pt-3 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
        <div>
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Ship className="h-4 w-4" />
            Imported Purchases
          </h2>
          <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-0.5">
            Shipments · PSW · duties · landed cost
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={`h-8 text-xs ${btnHover}`}
            onClick={() => setSroDrawerOpen(true)}
          >
            <BookMarked className="h-3.5 w-3.5 mr-1" />
            SRO library
            {sroLibrary.length > 0 ? (
              <Badge variant="secondary" className="ml-1 text-[9px] h-4 px-1">{sroLibrary.length}</Badge>
            ) : null}
          </Button>
          <Button
            type="button"
            size="sm"
            variant={showHelp ? "secondary" : "outline"}
            className={`h-8 text-xs ${btnHover}`}
            onClick={() => setShowHelp(v => !v)}
          >
            <HelpCircle className="h-3.5 w-3.5 mr-1" />
            Help
          </Button>
          <Button size="sm" className={`h-8 text-xs ${btnHover}`} onClick={openNew}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            New import
          </Button>
        </div>
      </div>

      {showHelp && <ImportShipmentManual defaultOpen />}

      <ImportSroDrawer
        open={sroDrawerOpen}
        onClose={() => setSroDrawerOpen(false)}
        sroLibrary={sroLibrary}
        onAdd={addSroToLibrary}
        onRemove={removeSroFromLibrary}
      />

      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search shipment #, supplier, B/L, GD, PSID…"
          className="w-full h-8 rounded-md border bg-[hsl(var(--background))] pl-8 pr-3 text-xs"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-[hsl(var(--muted-foreground))]">
          <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading…
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-md border border-dashed px-4 py-10 text-center">
          <Ship className="h-7 w-7 mx-auto mb-2 text-[hsl(var(--muted-foreground))]" />
          <p className="text-sm font-medium">No import shipments yet</p>
          <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-1 mb-3">
            Create a shipment to track containers, PSW clearance, and landed cost.
          </p>
          <Button size="sm" className={`h-8 text-xs ${btnHover}`} onClick={openNew}>
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Start first shipment
          </Button>
        </div>
      ) : (
        <div className="rounded-md border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-[hsl(var(--muted))]/30 text-left text-[10px] text-[hsl(var(--muted-foreground))]">
                  <th className="px-2.5 py-1.5 font-semibold">Import ID</th>
                  <th className="px-2.5 py-1.5 font-semibold">Supplier</th>
                  <th className="px-2.5 py-1.5 font-semibold">Containers</th>
                  <th className="px-2.5 py-1.5 font-semibold">B/L · GD</th>
                  <th className="px-2.5 py-1.5 font-semibold">Status</th>
                  <th className="px-2.5 py-1.5 font-semibold text-right">Landed total</th>
                  <th className="px-2.5 py-1.5 font-semibold w-8" />
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => {
                  const summary = s.landedCostSummary as LandedCostSummary
                  const total = summary?.grandTotalPkr
                  const step = normalizeImportStep(s.currentStep)
                  return (
                    <tr
                      key={s.id}
                      className="border-b last:border-0 hover:bg-[hsl(var(--muted))]/20 cursor-pointer transition-colors"
                      onClick={() => openExisting(s)}
                    >
                      <td className="px-2.5 py-2">
                        <p className="font-mono text-[11px] font-semibold flex items-center gap-1">
                          <Hash className="h-3 w-3 text-[hsl(var(--muted-foreground))]" />
                          {s.shipmentNumber}
                        </p>
                        <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
                          Step {step}/{IMPORT_STEP_COUNT}
                        </p>
                      </td>
                      <td className="px-2.5 py-2">
                        <p className="text-[11px]">{s.supplierName || "—"}</p>
                        <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
                          {s.currency} @ {s.fxRate || "—"}
                        </p>
                      </td>
                      <td className="px-2.5 py-2 text-[11px]">
                        {(s.containers || []).length || 0} · {(s.items || []).length || 0} items
                      </td>
                      <td className="px-2.5 py-2 text-[10px]">
                        <p>{s.blNumber || "—"}</p>
                        <p className="text-[hsl(var(--muted-foreground))]">{s.gdNumber || "—"}</p>
                      </td>
                      <td className="px-2.5 py-2">
                        <Badge variant={statusVariant(s.status)} className="text-[10px]">
                          {STATUS_LABELS[s.status] || s.status}
                        </Badge>
                        {s.landedCostLocked && (
                          <span className="ml-1 inline-flex items-center text-[10px] text-[hsl(var(--muted-foreground))]">
                            <Lock className="h-3 w-3 mr-0.5" /> locked
                          </span>
                        )}
                      </td>
                      <td className="px-2.5 py-2 text-right text-[11px] font-medium">
                        {typeof total === "number" ? formatPkr(total) : "—"}
                      </td>
                      <td className="px-2.5 py-2">
                        <ChevronRight className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
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
  purchaseScopeId,
  onSuppliersRefresh,
  agentLibrary,
  onAgentsChange,
  userName,
  sroLibrary,
  onAddSroToLibrary,
  onOpenSroLibrary,
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
  purchaseScopeId: string
  onSuppliersRefresh: () => Promise<Supplier[]>
  agentLibrary: ClearingAgent[]
  onAgentsChange: (agents: ClearingAgent[]) => void
  userName: string
  sroLibrary: ImportSro[]
  onAddSroToLibrary: (partial?: Partial<ImportSro>) => void
  onOpenSroLibrary: () => void
}) {
  const locked = draft.landedCostLocked
  const step = normalizeImportStep(draft.currentStep || 1)
  const readOnly = locked && step < 6
  const [helpOpen, setHelpOpen] = useState(false)
  const isNew = !draft.id || draft.shipmentNumber === "(auto)"

  return (
    <div className="p-3 sm:p-4 pt-3 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-start gap-2 justify-between">
        <div className="flex items-start gap-1.5 min-w-0">
          <Button type="button" variant="ghost" size="sm" className={`h-7 px-1.5 shrink-0 ${btnHover}`} onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <p className="font-mono text-xs font-semibold flex items-center gap-1">
                <Hash className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
                {isNew ? "New import" : draft.shipmentNumber}
              </p>
              <Badge variant="outline" className="text-[9px] h-5 font-mono">
                {isNew ? "ID on first save" : `ID ${draft.shipmentNumber}`}
              </Badge>
            </div>
            <p className="text-[10px] text-[hsl(var(--muted-foreground))] truncate">
              {draft.supplierName || "Untitled"} · {STATUS_LABELS[draft.status]}
              {locked ? " · cost locked" : ""}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={`h-7 text-[11px] ${btnHover}`}
            onClick={onOpenSroLibrary}
          >
            <BookMarked className="h-3 w-3 mr-1" /> SRO library
          </Button>
          <Button
            type="button"
            variant={helpOpen ? "secondary" : "outline"}
            size="sm"
            className={`h-7 text-[11px] ${btnHover}`}
            onClick={() => setHelpOpen(v => !v)}
          >
            <HelpCircle className="h-3 w-3 mr-1" /> Help
          </Button>
          {onDelete && (
            <Button type="button" variant="outline" size="sm" className={`h-7 text-[11px] text-red-600 ${btnHover}`} onClick={onDelete}>
              <Trash2 className="h-3 w-3 mr-1" /> Delete
            </Button>
          )}
          <Button type="button" size="sm" className={`h-7 text-[11px] ${btnHover}`} disabled={saving} onClick={onSave}>
            {saving ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Save className="h-3 w-3 mr-1" />}
            Save
          </Button>
        </div>
      </div>

      {helpOpen && <ImportShipmentManual defaultOpen />}

      <div className="flex gap-1 overflow-x-auto pb-0.5">
        {IMPORT_STEPS.map(s => {
          const active = step === s.step
          const done = step > s.step
          return (
            <button
              key={s.step}
              type="button"
              onClick={() => onStep(s.step)}
              className={`shrink-0 px-2 py-1 rounded text-[10px] font-medium border cursor-pointer transition-all duration-150 hover:shadow-sm ${
                active
                  ? "bg-[hsl(var(--foreground))] text-[hsl(var(--background))] border-transparent"
                  : done
                    ? "bg-[hsl(var(--muted))]/40 border-transparent hover:bg-[hsl(var(--muted))]/60"
                    : "bg-transparent text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]/30"
              }`}
            >
              {s.step}. {s.short}
            </button>
          )
        })}
      </div>

      {step === 1 && (
        <StepBasics
          draft={draft}
          patch={patch}
          readOnly={!!readOnly}
          importedSuppliers={importedSuppliers}
          purchaseScopeId={purchaseScopeId}
          onSuppliersRefresh={onSuppliersRefresh}
          agentLibrary={agentLibrary}
          onAgentsChange={onAgentsChange}
          userName={userName}
        />
      )}
      {step === 2 && (
        <StepInvoice
          draft={draft}
          setDraft={setDraft}
          readOnly={!!readOnly}
          userName={userName}
        />
      )}
      {step === 3 && (
        <StepPsw
          draft={draft}
          patch={patch}
          setDraft={setDraft}
          readOnly={!!readOnly}
          userName={userName}
          sroLibrary={sroLibrary}
          onAddSroToLibrary={onAddSroToLibrary}
          onOpenSroLibrary={onOpenSroLibrary}
        />
      )}
      {step === 4 && (
        <StepCharges draft={draft} setDraft={setDraft} readOnly={!!readOnly} userName={userName} />
      )}
      {step === 5 && (
        <StepLanded
          draft={draft}
          patch={patch}
          setDraft={setDraft}
          onPersist={onPersist}
          saving={saving}
          userName={userName}
        />
      )}
      {step === 6 && (
        <StepReceive draft={draft} patch={patch} setDraft={setDraft} onPersist={onPersist} saving={saving} userName={userName} />
      )}

      <div className="flex justify-between gap-2 pt-2 border-t">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={`h-7 text-[11px] ${btnHover}`}
          disabled={step <= 1}
          onClick={() => onStep(step - 1)}
        >
          Previous
        </Button>
        <Button
          type="button"
          size="sm"
          className={`h-7 text-[11px] ${btnHover}`}
          disabled={step >= IMPORT_STEP_COUNT || saving}
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
          {step >= IMPORT_STEP_COUNT ? "Done" : "Save & next"}
          <ChevronRight className="h-3 w-3 ml-1" />
        </Button>
      </div>
    </div>
  )
}

function StepBasics({
  draft, patch, readOnly, importedSuppliers, purchaseScopeId, onSuppliersRefresh, agentLibrary, onAgentsChange, userName,
}: {
  draft: ImportShipment
  patch: (p: Partial<ImportShipment>) => void
  readOnly: boolean
  importedSuppliers: Supplier[]
  purchaseScopeId: string
  onSuppliersRefresh: () => Promise<Supplier[]>
  agentLibrary: ClearingAgent[]
  onAgentsChange: (agents: ClearingAgent[]) => void
  userName: string
}) {
  const { toast } = useToast()
  const [showAddSupplier, setShowAddSupplier] = useState(false)
  const [showAddAgent, setShowAddAgent] = useState(false)
  const [savingSupplier, setSavingSupplier] = useState(false)
  const [newSupplierName, setNewSupplierName] = useState("")
  const [newSupplierContact, setNewSupplierContact] = useState("")
  const [newAgentName, setNewAgentName] = useState("")
  const [newAgentContact, setNewAgentContact] = useState("")

  const knownPorts = DESTINATION_PORTS as readonly string[]
  const portIsCustom = Boolean(draft.destinationPort) && !knownPorts.includes(draft.destinationPort)
  const portDropdownValue = !draft.destinationPort
    ? "Karachi"
    : knownPorts.includes(draft.destinationPort)
      ? draft.destinationPort
      : DESTINATION_PORT_CUSTOM

  async function handleAddSupplier() {
    const name = newSupplierName.trim()
    if (!name) {
      toast({ type: "error", title: "Supplier name required" })
      return
    }
    setSavingSupplier(true)
    try {
      const id = Date.now().toString()
      await saveSupplier({
        id,
        name,
        type: "imported",
        contact: newSupplierContact.trim(),
        email: "",
        address: "",
        company: "",
        tradingAs: "",
        bankAccounts: [],
        accountTitle: "",
        bankNames: [],
        bankIban: "",
      }, purchaseScopeId)
      await onSuppliersRefresh()
      patch({ supplierId: id, supplierName: name })
      setNewSupplierName("")
      setNewSupplierContact("")
      setShowAddSupplier(false)
      toast({ type: "success", title: "Supplier added", message: name })
    } catch (e) {
      toast({
        type: "error",
        title: "Could not add supplier",
        message: e instanceof Error ? e.message : "Error",
      })
    } finally {
      setSavingSupplier(false)
    }
  }

  function handleAddAgent() {
    const name = newAgentName.trim()
    if (!name) {
      toast({ type: "error", title: "Agent name required" })
      return
    }
    if (agentLibrary.some(a => a.name.toLowerCase() === name.toLowerCase())) {
      patch({ clearingAgent: name })
      setShowAddAgent(false)
      setNewAgentName("")
      setNewAgentContact("")
      toast({ type: "success", title: "Agent selected", message: name })
      return
    }
    const row: ClearingAgent = {
      id: newId(),
      name,
      contact: newAgentContact.trim() || undefined,
    }
    onAgentsChange([row, ...agentLibrary])
    patch({ clearingAgent: name })
    setNewAgentName("")
    setNewAgentContact("")
    setShowAddAgent(false)
    toast({ type: "success", title: "Agent saved", message: name })
  }

  return (
    <div className="space-y-3">
      <Section title="Basics · Supplier & contract">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
          <Field label="Imported supplier *" className="sm:col-span-2">
            <div className="flex gap-1">
              <select
                disabled={readOnly}
                value={draft.supplierId || ""}
                onChange={e => {
                  const s = importedSuppliers.find(x => x.id === e.target.value)
                  patch({ supplierId: e.target.value || null, supplierName: s?.name || "" })
                }}
                className={inputCls + " flex-1"}
              >
                <option value="">Select supplier…</option>
                {importedSuppliers.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              {!readOnly && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className={`h-7 px-2 text-[10px] shrink-0 ${btnHover}`}
                  onClick={() => { setShowAddSupplier(v => !v); setShowAddAgent(false) }}
                >
                  <Plus className="h-3 w-3 mr-0.5" /> Add
                </Button>
              )}
            </div>
          </Field>
          <Field label="Or type name only" className="sm:col-span-2">
            <input
              disabled={readOnly}
              value={draft.supplierName}
              onChange={e => patch({ supplierId: null, supplierName: e.target.value })}
              className={inputCls}
              placeholder="Foreign supplier name (one-off OK)"
            />
          </Field>

          {showAddSupplier && !readOnly && (
            <div className="col-span-2 sm:col-span-4 rounded border bg-[hsl(var(--muted))]/15 p-2 grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              <Field label="New supplier name *" className="sm:col-span-2">
                <input value={newSupplierName} onChange={e => setNewSupplierName(e.target.value)} className={inputCls} placeholder="Company name" />
              </Field>
              <Field label="Phone / WhatsApp">
                <input value={newSupplierContact} onChange={e => setNewSupplierContact(e.target.value)} className={inputCls} placeholder="Optional" />
              </Field>
              <div className="flex items-end gap-1">
                <Button type="button" size="sm" className={`h-7 text-[10px] flex-1 ${btnHover}`} disabled={savingSupplier} onClick={() => void handleAddSupplier()}>
                  {savingSupplier ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save supplier"}
                </Button>
                <Button type="button" size="sm" variant="ghost" className={`h-7 text-[10px] ${btnHover}`} onClick={() => setShowAddSupplier(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          <Field label="Contract / PO ref">
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
          <Field label="FX (1 = ? PKR) *">
            <input disabled={readOnly} type="number" min="0" step="0.01" value={draft.fxRate || ""} onChange={e => patch({ fxRate: Number(e.target.value) || 0 })} className={inputCls} placeholder="280" />
          </Field>

          <Field label="Clearing agent" className="sm:col-span-2">
            <div className="flex gap-1">
              <select
                disabled={readOnly}
                value={agentLibrary.some(a => a.name === draft.clearingAgent) ? draft.clearingAgent : ""}
                onChange={e => {
                  if (e.target.value) patch({ clearingAgent: e.target.value })
                }}
                className={inputCls + " flex-1"}
              >
                <option value="">Select saved agent…</option>
                {agentLibrary.map(a => (
                  <option key={a.id} value={a.name}>{a.name}</option>
                ))}
              </select>
              {!readOnly && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className={`h-7 px-2 text-[10px] shrink-0 ${btnHover}`}
                  onClick={() => { setShowAddAgent(v => !v); setShowAddSupplier(false) }}
                >
                  <Plus className="h-3 w-3 mr-0.5" /> Add
                </Button>
              )}
            </div>
          </Field>
          <Field label="Or type agent name" className="sm:col-span-1">
            <input
              disabled={readOnly}
              value={draft.clearingAgent}
              onChange={e => patch({ clearingAgent: e.target.value })}
              className={inputCls}
              placeholder="Agent name"
            />
          </Field>

          {showAddAgent && !readOnly && (
            <div className="col-span-2 sm:col-span-4 rounded border bg-[hsl(var(--muted))]/15 p-2 grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              <Field label="New agent name *" className="sm:col-span-2">
                <input value={newAgentName} onChange={e => setNewAgentName(e.target.value)} className={inputCls} placeholder="Clearing agent" />
              </Field>
              <Field label="Contact">
                <input value={newAgentContact} onChange={e => setNewAgentContact(e.target.value)} className={inputCls} placeholder="Optional" />
              </Field>
              <div className="flex items-end gap-1">
                <Button type="button" size="sm" className={`h-7 text-[10px] flex-1 ${btnHover}`} onClick={handleAddAgent}>
                  Save agent
                </Button>
                <Button type="button" size="sm" variant="ghost" className={`h-7 text-[10px] ${btnHover}`} onClick={() => setShowAddAgent(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          <Field label="Origin country">
            <input disabled={readOnly} value={draft.originCountry} onChange={e => patch({ originCountry: e.target.value })} className={inputCls} />
          </Field>
          <Field label="Origin port">
            <input disabled={readOnly} value={draft.originPort} onChange={e => patch({ originPort: e.target.value })} className={inputCls} />
          </Field>
          <Field label="Destination port" className="sm:col-span-2">
            <div className="flex flex-col gap-1">
              <select
                disabled={readOnly}
                value={portDropdownValue}
                onChange={e => {
                  const v = e.target.value
                  if (v === DESTINATION_PORT_CUSTOM) {
                    if (!portIsCustom) patch({ destinationPort: "" })
                  } else {
                    patch({ destinationPort: v })
                  }
                }}
                className={inputCls}
              >
                {DESTINATION_PORTS.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
                <option value={DESTINATION_PORT_CUSTOM}>Custom port…</option>
              </select>
              {portDropdownValue === DESTINATION_PORT_CUSTOM && (
                <input
                  disabled={readOnly}
                  value={draft.destinationPort}
                  onChange={e => patch({ destinationPort: e.target.value })}
                  className={inputCls}
                  placeholder="Type custom port / dry port name"
                />
              )}
            </div>
          </Field>
          <Field label="Notes" className="col-span-2 sm:col-span-4">
            <input disabled={readOnly} value={draft.notes} onChange={e => patch({ notes: e.target.value })} className={inputCls} placeholder="Optional notes" />
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
        hint="Contract/PO, proforma, LC or EIF."
      />

      <Section title="Shipping · Bill of Lading & vessel">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
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
          <Field label="ATA (actual)">
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
        hint="B/L, insurance, container photos."
      />
    </div>
  )
}

function StepInvoice({
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
      actualPrice: 0,
      declaredPrice: 0,
      assessedPrice: 0,
      weightKg: 0,
      cbm: 0,
      origin: draft.originCountry || "",
      notes: "",
    }
    setDraft(d => d ? { ...d, items: [...(d.items || []), item] } : d)
  }

  function updateItem(id: string, p: Partial<ImportItem>) {
    setDraft(d => {
      if (!d) return d
      return {
        ...d,
        items: (d.items || []).map(i => {
          if (i.id !== id) return i
          const next = { ...i, ...p }
          if (p.actualPrice != null) next.unitPriceForeign = Number(p.actualPrice) || 0
          return next
        }),
      }
    })
  }

  function removeItem(id: string) {
    setDraft(d => d ? { ...d, items: (d.items || []).filter(i => i.id !== id) } : d)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold">Invoice · Containers & items</p>
        {!readOnly && (
          <Button type="button" size="sm" variant="outline" className="h-7 text-[11px]" onClick={addContainer}>
            <Plus className="h-3 w-3 mr-1" /> Add container
          </Button>
        )}
      </div>

      {containers.length === 0 && (
        <p className="text-[11px] text-[hsl(var(--muted-foreground))] rounded border border-dashed p-3 text-center">
          Add a container (or LCL), then add invoice line items.
        </p>
      )}

      {containers.map((c, idx) => {
        const cItems = items.filter(i => i.containerId === c.id)
        return (
          <div key={c.id} className="rounded-md border p-2.5 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-bold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                Container {idx + 1}
              </p>
              {!readOnly && (
                <Button type="button" variant="ghost" size="sm" className="h-6 text-[10px] text-red-600" onClick={() => removeContainer(c.id)}>
                  Remove
                </Button>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
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

            <div className="flex items-center justify-between pt-0.5">
              <p className="text-[11px] font-semibold flex items-center gap-1">
                <Package className="h-3 w-3" /> Invoice items
              </p>
              {!readOnly && (
                <Button type="button" size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => addItem(c.id)}>
                  <Plus className="h-3 w-3 mr-1" /> Add item
                </Button>
              )}
            </div>

            {cItems.length === 0 ? (
              <p className="text-[10px] text-[hsl(var(--muted-foreground))]">No items yet.</p>
            ) : (
              <div className="overflow-x-auto rounded border">
                <table className="w-full text-[11px] min-w-[720px]">
                  <thead>
                    <tr className="bg-[hsl(var(--muted))]/30 text-left text-[9px] text-[hsl(var(--muted-foreground))]">
                      <th className="px-1.5 py-1">Description</th>
                      <th className="px-1.5 py-1">HS</th>
                      <th className="px-1.5 py-1">Qty</th>
                      <th className="px-1.5 py-1">Actual {draft.currency}</th>
                      <th className="px-1.5 py-1">Declared</th>
                      <th className="px-1.5 py-1">Assessed</th>
                      <th className="px-1.5 py-1">Kg</th>
                      <th className="px-1.5 py-1">CBM</th>
                      <th className="px-1.5 py-1 w-6" />
                    </tr>
                  </thead>
                  <tbody>
                    {cItems.map(item => (
                      <tr key={item.id} className="border-t align-top">
                        <td className="px-1.5 py-1">
                          <input disabled={readOnly} value={item.description} onChange={e => updateItem(item.id, { description: e.target.value })} className={inputCls} placeholder="Product" />
                          <input disabled={readOnly} value={item.sku} onChange={e => updateItem(item.id, { sku: e.target.value })} className={inputCls + " mt-0.5 text-[10px]"} placeholder="SKU (optional)" />
                        </td>
                        <td className="px-1.5 py-1">
                          <input disabled={readOnly} value={item.hsCode} onChange={e => updateItem(item.id, { hsCode: e.target.value })} className={inputCls + " w-20"} placeholder="HS" />
                        </td>
                        <td className="px-1.5 py-1">
                          <input disabled={readOnly} type="number" value={item.qty || ""} onChange={e => updateItem(item.id, { qty: Number(e.target.value) || 0 })} className={inputCls + " w-14"} />
                        </td>
                        <td className="px-1.5 py-1">
                          <input
                            disabled={readOnly}
                            type="number"
                            step="0.01"
                            value={item.actualPrice || item.unitPriceForeign || ""}
                            onChange={e => updateItem(item.id, { actualPrice: Number(e.target.value) || 0 })}
                            className={inputCls + " w-[4.5rem]"}
                          />
                        </td>
                        <td className="px-1.5 py-1">
                          <input disabled={readOnly} type="number" step="0.01" value={item.declaredPrice || ""} onChange={e => updateItem(item.id, { declaredPrice: Number(e.target.value) || 0 })} className={inputCls + " w-[4.5rem]"} />
                        </td>
                        <td className="px-1.5 py-1">
                          <input disabled={readOnly} type="number" step="0.01" value={item.assessedPrice || ""} onChange={e => updateItem(item.id, { assessedPrice: Number(e.target.value) || 0 })} className={inputCls + " w-[4.5rem]"} />
                        </td>
                        <td className="px-1.5 py-1">
                          <input disabled={readOnly} type="number" step="0.01" value={item.weightKg || ""} onChange={e => updateItem(item.id, { weightKg: Number(e.target.value) || 0 })} className={inputCls + " w-14"} />
                        </td>
                        <td className="px-1.5 py-1">
                          <input disabled={readOnly} type="number" step="0.001" value={item.cbm || ""} onChange={e => updateItem(item.id, { cbm: Number(e.target.value) || 0 })} className={inputCls + " w-14"} />
                        </td>
                        <td className="px-1.5 py-1">
                          {!readOnly && (
                            <button type="button" className="text-red-600 cursor-pointer" onClick={() => removeItem(item.id)}>
                              <Trash2 className="h-3 w-3" />
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
        hint="Commercial invoice and packing list."
      />
    </div>
  )
}

function StepPsw({
  draft, patch, setDraft, readOnly, userName, sroLibrary, onAddSroToLibrary, onOpenSroLibrary,
}: {
  draft: ImportShipment
  patch: (p: Partial<ImportShipment>) => void
  setDraft: Dispatch<SetStateAction<ImportShipment | null>>
  readOnly: boolean
  userName: string
  sroLibrary: ImportSro[]
  onAddSroToLibrary: (partial?: Partial<ImportSro>) => void
  onOpenSroLibrary: () => void
}) {
  const duties = draft.customsDuties || []
  const gdSros = draft.gdSros || []
  const items = draft.items || []
  const [sroCode, setSroCode] = useState("")
  const [sroTitle, setSroTitle] = useState("")

  function setDuties(next: CustomsDutyEntry[]) {
    setDraft(d => {
      if (!d) return d
      const charges = syncDutiesIntoCharges(d.charges || [], next)
      return { ...d, customsDuties: next, charges }
    })
  }

  function addDuty() {
    const n = duties.length + 1
    const row: CustomsDutyEntry = {
      id: newId(),
      name: `Customs Duty ${n}`,
      category: n === 1 ? "customs_duty" : "additional_customs_duty",
      amount: 0,
      currency: "PKR",
      description: "",
      itemId: "",
      paid: false,
      paymentRef: "",
    }
    setDuties([...duties, row])
  }

  function updateDuty(id: string, p: Partial<CustomsDutyEntry>) {
    setDuties(duties.map(d => d.id === id ? { ...d, ...p } : d))
  }

  function removeDuty(id: string) {
    setDuties(duties.filter(d => d.id !== id).map((d, i) => ({
      ...d,
      name: d.name.match(/^Customs Duty \d+$/) ? `Customs Duty ${i + 1}` : d.name,
    })))
  }

  function addSroToGd(sro: ImportSro) {
    if (gdSros.some(s => s.code.toLowerCase() === sro.code.toLowerCase())) return
    patch({ gdSros: [...gdSros, { ...sro, id: newId() }] })
  }

  function addTypedSro() {
    const code = sroCode.trim()
    if (!code) return
    const row: ImportSro = {
      id: newId(),
      code,
      title: sroTitle.trim(),
      description: "",
    }
    addSroToGd(row)
    onAddSroToLibrary(row)
    setSroCode("")
    setSroTitle("")
  }

  function removeGdSro(id: string) {
    patch({ gdSros: gdSros.filter(s => s.id !== id) })
  }

  return (
    <div className="space-y-3">
      <Section title="PSW · Goods Declaration & payment IDs">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
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
            <input disabled={readOnly} value={draft.collectorate} onChange={e => patch({ collectorate: e.target.value })} className={inputCls} placeholder="MCC Appraisement West" />
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

      <Section title="Customs duties on this GD">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
            Add Duty 1, Duty 2… — amounts sync into Charges for landed cost
          </p>
          {!readOnly && (
            <Button type="button" size="sm" variant="outline" className="h-6 text-[10px]" onClick={addDuty}>
              <Plus className="h-3 w-3 mr-1" /> Add duty
            </Button>
          )}
        </div>
        {duties.length === 0 ? (
          <p className="text-[10px] text-[hsl(var(--muted-foreground))] border border-dashed rounded px-2 py-2 text-center">
            No duties yet — add Customs Duty 1, then more as needed.
          </p>
        ) : (
          <div className="space-y-2">
            {duties.map((d, idx) => (
              <div key={d.id} className="rounded border p-2 space-y-1.5 bg-[hsl(var(--muted))]/10">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold">{d.name || `Customs Duty ${idx + 1}`}</p>
                  {!readOnly && (
                    <button type="button" className="text-red-600 cursor-pointer" onClick={() => removeDuty(d.id)}>
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  <Field label="Label">
                    <input disabled={readOnly} value={d.name} onChange={e => updateDuty(d.id, { name: e.target.value })} className={inputCls} />
                  </Field>
                  <Field label="Type">
                    <select
                      disabled={readOnly}
                      value={d.category}
                      onChange={e => updateDuty(d.id, { category: e.target.value as ChargeCategory })}
                      className={inputCls}
                    >
                      {DUTY_CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>
                          {CHARGE_CATEGORIES.find(c => c.value === cat)?.label || cat}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Amount">
                    <input disabled={readOnly} type="number" step="0.01" value={d.amount || ""} onChange={e => updateDuty(d.id, { amount: Number(e.target.value) || 0 })} className={inputCls} />
                  </Field>
                  <Field label="Currency">
                    <select disabled={readOnly} value={d.currency} onChange={e => updateDuty(d.id, { currency: e.target.value })} className={inputCls}>
                      {CURRENCIES.map(cur => <option key={cur} value={cur}>{cur}</option>)}
                    </select>
                  </Field>
                  <Field label="Link to item (optional)" className="sm:col-span-2">
                    <select disabled={readOnly} value={d.itemId || ""} onChange={e => updateDuty(d.id, { itemId: e.target.value })} className={inputCls}>
                      <option value="">Shared across items</option>
                      {items.map(i => (
                        <option key={i.id} value={i.id}>{i.description || i.sku || i.hsCode || i.id}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Description" className="sm:col-span-2">
                    <input disabled={readOnly} value={d.description} onChange={e => updateDuty(d.id, { description: e.target.value })} className={inputCls} placeholder="Optional note" />
                  </Field>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="SROs on this GD">
        {!readOnly && (
          <div className="space-y-1.5 mb-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
                Type an SRO or quick-add from your library
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className={`h-6 text-[10px] ${btnHover}`}
                onClick={onOpenSroLibrary}
              >
                <BookMarked className="h-3 w-3 mr-1" /> Manage library
              </Button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              <Field label="SRO code" className="sm:col-span-2">
                <input value={sroCode} onChange={e => setSroCode(e.target.value)} className={inputCls} placeholder="Type SRO…" />
              </Field>
              <Field label="Title">
                <input value={sroTitle} onChange={e => setSroTitle(e.target.value)} className={inputCls} placeholder="Optional" />
              </Field>
              <div className="flex items-end">
                <Button type="button" size="sm" className={`h-7 text-[11px] w-full ${btnHover}`} onClick={addTypedSro}>
                  <Plus className="h-3 w-3 mr-1" /> Add SRO
                </Button>
              </div>
            </div>
            {(sroLibrary.length > 0 || QUICK_ADD_SROS.length > 0) && (
              <div className="flex flex-wrap gap-1">
                <span className="text-[10px] text-[hsl(var(--muted-foreground))] self-center mr-0.5">Quick add:</span>
                {sroLibrary.map(s => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => addSroToGd(s)}
                    className={chipHover}
                  >
                    + {s.code}
                  </button>
                ))}
                {QUICK_ADD_SROS.filter(q => !sroLibrary.some(s => s.code === q.code)).map(q => (
                  <button
                    key={q.code}
                    type="button"
                    onClick={() => {
                      const row = { ...q, id: newId() }
                      addSroToGd(row)
                      onAddSroToLibrary(q)
                    }}
                    className={`${chipHover} border-dashed`}
                  >
                    + {q.code}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {gdSros.length === 0 ? (
          <p className="text-[10px] text-[hsl(var(--muted-foreground))] border border-dashed rounded px-2 py-2 text-center">
            No SROs on this GD yet.
          </p>
        ) : (
          <div className="overflow-x-auto rounded border">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="bg-[hsl(var(--muted))]/30 text-left text-[10px] text-[hsl(var(--muted-foreground))]">
                  <th className="px-2 py-1">Code</th>
                  <th className="px-2 py-1">Title</th>
                  <th className="px-2 py-1 w-6" />
                </tr>
              </thead>
              <tbody>
                {gdSros.map(s => (
                  <tr key={s.id} className="border-t">
                    <td className="px-2 py-1 font-mono font-medium">{s.code}</td>
                    <td className="px-2 py-1">{s.title || "—"}</td>
                    <td className="px-2 py-1">
                      {!readOnly && (
                        <button type="button" className="text-red-600 cursor-pointer" onClick={() => removeGdSro(s.id)}>
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
  const charges = (draft.charges || []).filter(c => !c.fromDutyId)
  const items = draft.items || []
  const dutySynced = (draft.charges || []).filter(c => c.fromDutyId)

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
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold">All landing charges</p>
          <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
            Shared split across items · direct to one item. PSW duties listed below are read-only here.
          </p>
        </div>
        {!readOnly && (
          <Button type="button" size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => addCharge()}>
            <Plus className="h-3 w-3 mr-1" /> Add charge
          </Button>
        )}
      </div>

      {!readOnly && (
        <div className="flex flex-wrap gap-1">
          {([
            "duty_tax_customs_partial",
            "do_bl_charges",
            "port_handling",
            "examination",
            "appraisement",
            "handling_service",
            "local_transport",
            "clearing_agent",
            "logworld_total_invoice",
            "aict_terminal_invoice",
          ] as ChargeCategory[]).map(cat => (
            <button
              key={cat}
              type="button"
              onClick={() => addCharge({ category: cat })}
              className="text-[10px] px-1.5 py-0.5 rounded border hover:bg-[hsl(var(--muted))]/40 cursor-pointer"
            >
              + {CHARGE_CATEGORIES.find(c => c.value === cat)?.label}
            </button>
          ))}
        </div>
      )}

      {dutySynced.length > 0 && (
        <div className="rounded border px-2 py-1.5 text-[10px] text-[hsl(var(--muted-foreground))]">
          {dutySynced.length} customs duty line(s) from PSW — edit them on the PSW step.
        </div>
      )}

      {charges.length === 0 ? (
        <p className="text-[11px] text-[hsl(var(--muted-foreground))] border border-dashed rounded p-3 text-center">
          Add freight, clearing, transport, bank charges, etc.
        </p>
      ) : (
        <div className="space-y-1.5">
          {charges.map(c => (
            <div key={c.id} className="rounded border p-2 grid grid-cols-2 sm:grid-cols-6 gap-1.5">
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
                <input disabled={readOnly || c.currency === "PKR"} type="number" step="0.01" value={c.fxRate || ""} onChange={e => updateCharge(c.id, { fxRate: Number(e.target.value) || 0 })} className={inputCls} placeholder="shipment FX" />
              </Field>
              <Field label="Shared?">
                <select
                  disabled={readOnly}
                  value={c.isShared ? "shared" : "direct"}
                  onChange={e => updateCharge(c.id, { isShared: e.target.value === "shared" })}
                  className={inputCls}
                >
                  <option value="shared">Shared</option>
                  <option value="direct">Direct</option>
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
                <label className="flex items-center gap-1 text-[11px] h-7">
                  <input disabled={readOnly} type="checkbox" checked={c.paid} onChange={e => updateCharge(c.id, { paid: e.target.checked })} />
                  Paid
                </label>
                {!readOnly && (
                  <Button type="button" variant="ghost" size="sm" className="h-7 text-[11px] text-red-600 ml-auto" onClick={() => removeCharge(c.id)}>
                    <Trash2 className="h-3 w-3" />
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
        hint="Freight, clearing, transport invoices and payment proofs."
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
    <div className="space-y-3">
      <Section title="Allocation & calculate">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
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
          <div className="flex items-end gap-1.5">
            <Button type="button" size="sm" variant="outline" className="h-7 text-[11px]" disabled={draft.landedCostLocked} onClick={applyLocal}>
              <Calculator className="h-3 w-3 mr-1" /> Calculate
            </Button>
            <Button type="button" size="sm" className="h-7 text-[11px]" disabled={saving || draft.landedCostLocked} onClick={() => void lock()}>
              {saving ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Lock className="h-3 w-3 mr-1" />}
              Lock
            </Button>
          </div>
        </div>
        {draft.landedCostLocked && (
          <p className="text-[10px] text-emerald-700 mt-1.5 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" /> Landed cost locked.
          </p>
        )}
      </Section>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
        <Stat label="Product (PKR)" value={formatPkr(summary.productTotalPkr || 0)} />
        <Stat label="Shared charges" value={formatPkr(summary.sharedChargesPkr || 0)} />
        <Stat label="Direct charges" value={formatPkr(summary.directChargesPkr || 0)} />
        <Stat label="Grand total" value={formatPkr(summary.grandTotalPkr || 0)} highlight />
      </div>

      <div className="rounded-md border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="bg-[hsl(var(--muted))]/30 text-left text-[9px] text-[hsl(var(--muted-foreground))]">
                <th className="px-2 py-1.5">Item</th>
                <th className="px-2 py-1.5">Container</th>
                <th className="px-2 py-1.5 text-right">Qty</th>
                <th className="px-2 py-1.5 text-right">Product</th>
                <th className="px-2 py-1.5 text-right">Allocated</th>
                <th className="px-2 py-1.5 text-right">Direct</th>
                <th className="px-2 py-1.5 text-right">Total landed</th>
                <th className="px-2 py-1.5 text-right">Unit landed</th>
              </tr>
            </thead>
            <tbody>
              {(summary.lines || []).map(line => (
                <tr key={line.itemId} className="border-t">
                  <td className="px-2 py-1.5 font-medium">{line.description || "—"}</td>
                  <td className="px-2 py-1.5 text-[hsl(var(--muted-foreground))]">{containerName(line.containerId)}</td>
                  <td className="px-2 py-1.5 text-right">{line.receivedQty || line.qty}</td>
                  <td className="px-2 py-1.5 text-right">{formatPkr(line.productCostPkr)}</td>
                  <td className="px-2 py-1.5 text-right">{formatPkr(line.allocatedChargesPkr)}</td>
                  <td className="px-2 py-1.5 text-right">{formatPkr(line.directChargesPkr)}</td>
                  <td className="px-2 py-1.5 text-right font-semibold">{formatPkr(line.totalLandedPkr)}</td>
                  <td className="px-2 py-1.5 text-right font-bold text-emerald-700 dark:text-emerald-400">
                    {formatPkr(line.unitLandedCost)}
                  </td>
                </tr>
              ))}
              {(!summary.lines || summary.lines.length === 0) && (
                <tr>
                  <td colSpan={8} className="px-2 py-6 text-center text-[hsl(var(--muted-foreground))]">
                    Add invoice items and charges, then Calculate.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {(summary.chargeBreakdown || []).length > 0 && (
        <Section title="Charge breakdown">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            {summary.chargeBreakdown.map(b => (
              <div key={b.category} className="rounded border px-2 py-1.5 text-[11px] flex justify-between gap-2">
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
      currentStep: 6,
      status: "received",
      recalculateLandedCost: true,
      historyAction: "warehouse_receive",
      historyNote: "Marked received at warehouse",
      historyBy: userName,
    })
  }

  return (
    <div className="space-y-3">
      <Section title="Warehouse receive">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          <Field label="Warehouse / location">
            <input value={draft.warehouseLocation} onChange={e => patch({ warehouseLocation: e.target.value })} className={inputCls} placeholder="Main warehouse…" />
          </Field>
          <Field label="Received date">
            <input type="date" value={draft.receivedDate} onChange={e => patch({ receivedDate: e.target.value })} className={inputCls} />
          </Field>
        </div>
      </Section>

      <div className="rounded-md border overflow-hidden">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="bg-[hsl(var(--muted))]/30 text-left text-[9px] text-[hsl(var(--muted-foreground))]">
              <th className="px-2 py-1.5">Item</th>
              <th className="px-2 py-1.5 text-right">Shipped qty</th>
              <th className="px-2 py-1.5 text-right">Received qty</th>
              <th className="px-2 py-1.5 text-right">Unit landed</th>
            </tr>
          </thead>
          <tbody>
            {(draft.items || []).map(item => (
              <tr key={item.id} className="border-t">
                <td className="px-2 py-1.5">{item.description || "—"}</td>
                <td className="px-2 py-1.5 text-right">{item.qty}</td>
                <td className="px-2 py-1.5 text-right">
                  <input
                    type="number"
                    className={inputCls + " w-20 ml-auto"}
                    value={item.receivedQty || item.qty || ""}
                    onChange={e => updateItem(item.id, Number(e.target.value) || 0)}
                  />
                </td>
                <td className="px-2 py-1.5 text-right font-semibold">
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
        hint="Goods receipt note and unload photos."
      />

      <Button type="button" size="sm" className="h-7 text-[11px]" disabled={saving || draft.receivedAtWarehouse} onClick={() => void markReceived()}>
        {saving ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <CheckCircle2 className="h-3 w-3 mr-1" />}
        {draft.receivedAtWarehouse ? "Already received" : "Mark received at warehouse"}
      </Button>

      <Section title="Full document file">
        <ImportAttachments
          attachments={draft.attachments}
          onChange={atts => patch({ attachments: atts })}
          uploadedBy={userName}
          title="All attachments"
          hint={`Total ${(draft.attachments || []).length} file(s).`}
        />
      </Section>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-md border p-2.5 space-y-2">
      <p className="text-xs font-semibold">{title}</p>
      {children}
    </div>
  )
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-md border px-2.5 py-1.5 ${highlight ? "bg-[hsl(var(--muted))]/30" : ""}`}>
      <p className="text-[9px] text-[hsl(var(--muted-foreground))]">{label}</p>
      <p className={`text-xs font-semibold ${highlight ? "text-emerald-700 dark:text-emerald-400" : ""}`}>{value}</p>
    </div>
  )
}
