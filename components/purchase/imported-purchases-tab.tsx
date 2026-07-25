"use client"

import { useCallback, useEffect, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from "react"
import { createPortal } from "react-dom"
import {
  Plus, Search, Loader2, Ship, ArrowLeft, Trash2, Lock, Calculator,
  ChevronRight, Package, Save, CheckCircle2, HelpCircle, BookMarked, Hash,
  Maximize2, Minimize2, PanelsTopLeft,
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
  TRANSPORT_CHARGE_CATEGORIES,
  applyLandedCostToItems,
  calculateLandedCost,
  chargeAmountPkr,
  chargeBaseAmountPkr,
  chargeTaxesPkr,
  deleteImportShipment,
  emptyShipment,
  formatPkr,
  getImportShipments,
  importDisplayName,
  loadAgentLibrary,
  loadSroLibrary,
  newId,
  normalizeImportStep,
  parsePsids,
  saveAgentLibrary,
  saveImportShipment,
  saveSroLibrary,
  serializePsids,
  statusForStep,
  sumChargesPkr,
  syncDutiesIntoCharges,
  type AllocationMethod,
  type ChargeCategory,
  type ClearingAgent,
  type CustomsDutyEntry,
  type ImportCharge,
  type ImportChargeTax,
  type ImportContainer,
  type ImportItem,
  type ImportShipment,
  type ImportShipmentStatus,
  type ImportSro,
  type LandedCostSummary,
} from "@/lib/import-shipment"
import { uploadFile } from "@/lib/upload"
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
  const [viewMode, setViewMode] = useState<"compact" | "full">("compact")
  const [pendingOpen, setPendingOpen] = useState<ImportShipment | null>(null)
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
      [s.shipmentNumber, s.supplierName, s.blNumber, s.gdNumber, s.psid, parsePsids(s).join(" "), s.contractRef]
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
    setPendingOpen(local)
  }

  function loadShipmentDraft(s: ImportShipment) {
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

  function openExisting(s: ImportShipment) {
    setPendingOpen(s)
  }

  function confirmOpenView(mode: "compact" | "full") {
    if (!pendingOpen) return
    setViewMode(mode)
    loadShipmentDraft(pendingOpen)
    setPendingOpen(null)
  }

  function closeShipment() {
    setSelected(null)
    setDraft(null)
    setViewMode("compact")
    void load()
  }

  useEffect(() => {
    if (viewMode !== "full" || !selected) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [viewMode, selected])

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
      toast({ type: "success", title: "Saved", message: importDisplayName(saved) })
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
    closeShipment()
    toast({ type: "success", title: "Deleted" })
  }

  const detailProps = selected && draft ? {
    draft,
    patch,
    setDraft,
    saving,
    onBack: closeShipment,
    onSave: () => void persist(),
    onPersist: persist,
    onStep: goStep,
    onDelete: draft.id ? () => void handleDelete(draft.id) : undefined,
    importedSuppliers,
    purchaseScopeId,
    onSuppliersRefresh: refreshSuppliers,
    agentLibrary,
    onAgentsChange: persistAgents,
    userName: user?.name || user?.email || "",
    sroLibrary,
    onAddSroToLibrary: addSroToLibrary,
    onOpenSroLibrary: () => setSroDrawerOpen(true),
    viewMode,
    onViewModeChange: setViewMode,
  } as const : null

  if (selected && draft && detailProps && viewMode === "compact") {
    return (
      <>
        <ShipmentDetail {...detailProps} />
        <ImportSroDrawer
          open={sroDrawerOpen}
          onClose={() => setSroDrawerOpen(false)}
          sroLibrary={sroLibrary}
          onAdd={addSroToLibrary}
          onRemove={removeSroFromLibrary}
        />
        {pendingOpen && (
          <ImportOpenViewChooser
            shipment={pendingOpen}
            onChoose={confirmOpenView}
            onCancel={() => setPendingOpen(null)}
          />
        )}
      </>
    )
  }

  if (selected && draft && detailProps && viewMode === "full") {
    return (
      <>
        {typeof document !== "undefined" && createPortal(
          <div className="fixed inset-0 z-[90] bg-[hsl(var(--background))] flex flex-col">
            <div className="shrink-0 border-b px-4 sm:px-6 py-2.5 flex items-center justify-between gap-2 bg-[hsl(var(--card))]">
              <div className="min-w-0">
                <p className="text-xs font-semibold truncate">Import focus mode</p>
                <p className="text-[10px] text-[hsl(var(--muted-foreground))] truncate">
                  Sidebar hidden · wider workspace for editing
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className={`h-8 text-xs ${btnHover}`}
                  onClick={() => setViewMode("compact")}
                >
                  <Minimize2 className="h-3.5 w-3.5 mr-1" /> Compact
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className={`h-8 text-xs ${btnHover}`}
                  onClick={closeShipment}
                >
                  <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Close
                </Button>
              </div>
            </div>
            <div className="flex-1 overflow-auto">
              <div className="max-w-[1680px] mx-auto w-full px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
                <ShipmentDetail {...detailProps} />
              </div>
            </div>
          </div>,
          document.body,
        )}
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
      {pendingOpen && (
        <ImportOpenViewChooser
          shipment={pendingOpen}
          onChoose={confirmOpenView}
          onCancel={() => setPendingOpen(null)}
        />
      )}
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
                  <th className="px-2.5 py-1.5 font-semibold">Import</th>
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
                  const title = importDisplayName(s)
                  const hasBl = !!String(s.blNumber || "").trim()
                  return (
                    <tr
                      key={s.id}
                      className="border-b last:border-0 hover:bg-[hsl(var(--muted))]/20 cursor-pointer transition-colors"
                      onClick={() => openExisting(s)}
                    >
                      <td className="px-2.5 py-2">
                        <p className="font-mono text-[11px] font-semibold flex items-center gap-1">
                          <Hash className="h-3 w-3 text-[hsl(var(--muted-foreground))]" />
                          {title}
                        </p>
                        <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
                          {hasBl ? `ID ${s.shipmentNumber} · ` : ""}Step {step}/{IMPORT_STEP_COUNT}
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

function ImportOpenViewChooser({
  shipment,
  onChoose,
  onCancel,
}: {
  shipment: ImportShipment
  onChoose: (mode: "compact" | "full") => void
  onCancel: () => void
}) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onCancel])

  const isNew = !shipment.id || shipment.shipmentNumber === "(auto)"
  const title = isNew ? "New import" : importDisplayName(shipment)
  const idLabel = isNew ? "ID on first save" : shipment.shipmentNumber

  if (!mounted) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-label="Open import view"
    >
      <div
        className="w-full max-w-md rounded-lg border bg-[hsl(var(--background))] shadow-xl p-4 space-y-3"
        onClick={e => e.stopPropagation()}
      >
        <div>
          <p className="text-sm font-semibold">Open import</p>
          <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-0.5">
            <span className="font-mono font-medium text-[hsl(var(--foreground))]">{title}</span>
            {" · "}{idLabel}
            {shipment.supplierName ? ` · ${shipment.supplierName}` : ""}
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onChoose("compact")}
            className={`rounded-md border p-3 text-left cursor-pointer transition-all hover:border-[hsl(var(--foreground))]/40 hover:bg-[hsl(var(--muted))]/30 ${btnHover}`}
          >
            <PanelsTopLeft className="h-4 w-4 mb-1.5" />
            <p className="text-xs font-semibold">Compact view</p>
            <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-0.5 leading-snug">
              Stay in Purchase with sidebar and tabs — same as before.
            </p>
          </button>
          <button
            type="button"
            onClick={() => onChoose("full")}
            className={`rounded-md border p-3 text-left cursor-pointer transition-all hover:border-[hsl(var(--foreground))]/40 hover:bg-[hsl(var(--muted))]/30 ${btnHover}`}
          >
            <Maximize2 className="h-4 w-4 mb-1.5" />
            <p className="text-xs font-semibold">Full view</p>
            <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-0.5 leading-snug">
              Focus mode — hide sidebar, wider screen for editing steps.
            </p>
          </button>
        </div>
        <div className="flex justify-end">
          <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>
    </div>,
    document.body,
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
  viewMode = "compact",
  onViewModeChange,
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
  viewMode?: "compact" | "full"
  onViewModeChange?: (mode: "compact" | "full") => void
}) {
  const locked = draft.landedCostLocked
  const step = normalizeImportStep(draft.currentStep || 1)
  const readOnly = locked && step < 6
  const [helpOpen, setHelpOpen] = useState(false)
  const isNew = !draft.id || draft.shipmentNumber === "(auto)"
  const displayName = isNew ? "New import" : importDisplayName(draft)
  const hasBl = !!String(draft.blNumber || "").trim()
  const isFull = viewMode === "full"

  return (
    <div
      className={
        isFull
          ? "space-y-4 [&_label]:text-[11px] [&_input]:h-9 [&_input]:text-sm [&_select]:h-9 [&_select]:text-sm [&_textarea]:text-sm [&_table]:text-sm"
          : "p-3 sm:p-4 pt-3 space-y-3"
      }
    >
      <div className="flex flex-col sm:flex-row sm:items-start gap-2 justify-between">
        <div className="flex items-start gap-1.5 min-w-0">
          {!isFull && (
            <Button type="button" variant="ghost" size="sm" className={`h-7 px-1.5 shrink-0 ${btnHover}`} onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <p className={`font-mono font-semibold flex items-center gap-1 ${isFull ? "text-sm sm:text-base" : "text-xs"}`}>
                <Hash className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
                {displayName}
              </p>
              <Badge variant="outline" className="text-[9px] h-5 font-mono">
                {isNew ? "ID on first save" : `ID ${draft.shipmentNumber}`}
              </Badge>
              {hasBl && (
                <Badge variant="secondary" className="text-[9px] h-5">
                  Named by B/L
                </Badge>
              )}
              {isFull && (
                <Badge variant="outline" className="text-[9px] h-5">
                  Full view
                </Badge>
              )}
            </div>
            <p className={`text-[hsl(var(--muted-foreground))] truncate ${isFull ? "text-xs" : "text-[10px]"}`}>
              {draft.supplierName || "Untitled"} · {STATUS_LABELS[draft.status]}
              {locked ? " · cost locked" : ""}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {onViewModeChange && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={`${isFull ? "h-8 text-xs" : "h-7 text-[11px]"} ${btnHover}`}
              onClick={() => onViewModeChange(isFull ? "compact" : "full")}
            >
              {isFull ? (
                <><Minimize2 className="h-3 w-3 mr-1" /> Compact</>
              ) : (
                <><Maximize2 className="h-3 w-3 mr-1" /> Full view</>
              )}
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={`${isFull ? "h-8 text-xs" : "h-7 text-[11px]"} ${btnHover}`}
            onClick={onOpenSroLibrary}
          >
            <BookMarked className="h-3 w-3 mr-1" /> SRO library
          </Button>
          <Button
            type="button"
            variant={helpOpen ? "secondary" : "outline"}
            size="sm"
            className={`${isFull ? "h-8 text-xs" : "h-7 text-[11px]"} ${btnHover}`}
            onClick={() => setHelpOpen(v => !v)}
          >
            <HelpCircle className="h-3 w-3 mr-1" /> Help
          </Button>
          {onDelete && (
            <Button type="button" variant="outline" size="sm" className={`${isFull ? "h-8 text-xs" : "h-7 text-[11px]"} text-red-600 ${btnHover}`} onClick={onDelete}>
              <Trash2 className="h-3 w-3 mr-1" /> Delete
            </Button>
          )}
          <Button type="button" size="sm" className={`${isFull ? "h-8 text-xs" : "h-7 text-[11px]"} ${btnHover}`} disabled={saving} onClick={onSave}>
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
              className={`shrink-0 rounded font-medium border cursor-pointer transition-all duration-150 hover:shadow-sm ${
                isFull ? "px-3 py-1.5 text-xs" : "px-2 py-1 text-[10px]"
              } ${
                active
                  ? "bg-[hsl(var(--foreground))] text-[hsl(var(--background))] border-transparent"
                  : done
                    ? "bg-[hsl(var(--muted))]/40 border-transparent hover:bg-[hsl(var(--muted))]/60"
                    : "bg-transparent text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]/30"
              }`}
            >
              {s.step}. {isFull ? s.title : s.short}
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
          className={`${isFull ? "h-9 text-xs px-4" : "h-7 text-[11px]"} ${btnHover}`}
          disabled={step <= 1}
          onClick={() => onStep(step - 1)}
        >
          Previous
        </Button>
        <Button
          type="button"
          size="sm"
          className={`${isFull ? "h-9 text-xs px-4" : "h-7 text-[11px]"} ${btnHover}`}
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
            <input
              disabled={readOnly}
              value={draft.blNumber}
              onChange={e => patch({ blNumber: e.target.value })}
              className={inputCls}
              placeholder="Becomes import name when set"
            />
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
      grossWeightKg: 0,
      netWeightKg: 0,
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
          if (p.netWeightKg != null) next.weightKg = Number(p.netWeightKg) || 0
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
                <table className="w-full text-[11px] min-w-[820px]">
                  <thead>
                    <tr className="bg-[hsl(var(--muted))]/30 text-left text-[9px] text-[hsl(var(--muted-foreground))]">
                      <th className="px-1.5 py-1">Description</th>
                      <th className="px-1.5 py-1">HS</th>
                      <th className="px-1.5 py-1">Qty</th>
                      <th className="px-1.5 py-1">Actual {draft.currency}</th>
                      <th className="px-1.5 py-1">Declared</th>
                      <th className="px-1.5 py-1">Assessed</th>
                      <th className="px-1.5 py-1">Gross kg</th>
                      <th className="px-1.5 py-1">Net kg</th>
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
                          <input
                            disabled={readOnly}
                            type="number"
                            step="0.01"
                            value={item.grossWeightKg || ""}
                            onChange={e => updateItem(item.id, { grossWeightKg: Number(e.target.value) || 0 })}
                            className={inputCls + " w-16"}
                          />
                        </td>
                        <td className="px-1.5 py-1">
                          <input
                            disabled={readOnly}
                            type="number"
                            step="0.01"
                            value={item.netWeightKg || item.weightKg || ""}
                            onChange={e => updateItem(item.id, { netWeightKg: Number(e.target.value) || 0 })}
                            className={inputCls + " w-16"}
                          />
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
  const psids = useMemo(() => {
    const list = parsePsids(draft)
    return list.length > 0 ? list : [""]
  }, [draft.psid, draft.pssid])
  const [sroDraftByItem, setSroDraftByItem] = useState<Record<string, { code: string; title: string }>>({})

  function setPsids(next: string[]) {
    patch(serializePsids(next))
  }

  function updatePsid(idx: number, value: string) {
    const next = [...psids]
    next[idx] = value
    setPsids(next)
  }

  function addPsid() {
    setPsids([...psids, ""])
  }

  function removePsid(idx: number) {
    const next = psids.filter((_, i) => i !== idx)
    setPsids(next.length ? next : [""])
  }

  function setDuties(next: CustomsDutyEntry[]) {
    setDraft(d => {
      if (!d) return d
      const charges = syncDutiesIntoCharges(d.charges || [], next)
      return { ...d, customsDuties: next, charges }
    })
  }

  function addDutyForItem(itemId: string) {
    const itemDuties = duties.filter(d => d.itemId === itemId && d.category !== "cess")
    const n = itemDuties.length + 1
    const row: CustomsDutyEntry = {
      id: newId(),
      name: `Duty ${n}`,
      category: n === 1 ? "customs_duty" : "additional_customs_duty",
      amount: 0,
      currency: "PKR",
      description: "",
      itemId,
      paid: false,
      paymentRef: "",
    }
    setDuties([...duties, row])
  }

  function addCessDuty() {
    const cessDuties = duties.filter(d => d.category === "cess")
    const n = cessDuties.length + 1
    const row: CustomsDutyEntry = {
      id: newId(),
      name: `Cess ${n}`,
      category: "cess",
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
    setDuties(duties.map(d => {
      if (d.id !== id) return d
      const next = { ...d, ...p }
      // Cess rows stay shared (no item link)
      if (next.category === "cess") next.itemId = ""
      return next
    }))
  }

  function removeDuty(id: string) {
    const removed = duties.find(d => d.id === id)
    const next = duties.filter(d => d.id !== id)
    if (!removed) {
      setDuties(next)
      return
    }
    if (removed.category === "cess") {
      let i = 0
      setDuties(next.map(d => {
        if (d.category !== "cess") return d
        i += 1
        return d.name.match(/^Cess \d+$/) ? { ...d, name: `Cess ${i}` } : d
      }))
      return
    }
    if (!removed.itemId) {
      setDuties(next)
      return
    }
    let i = 0
    setDuties(next.map(d => {
      if (d.itemId !== removed.itemId || d.category === "cess") return d
      i += 1
      return d.name.match(/^Duty \d+$/) ? { ...d, name: `Duty ${i}` } : d
    }))
  }

  function setSros(next: ImportSro[]) {
    patch({ gdSros: next })
  }

  function addSroToItem(itemId: string, sro: Omit<ImportSro, "id"> | ImportSro) {
    const code = sro.code.trim()
    if (!code) return
    const exists = gdSros.some(
      s => s.itemId === itemId && s.code.toLowerCase() === code.toLowerCase(),
    )
    if (exists) return
    setSros([...gdSros, { ...sro, id: newId(), itemId, code, title: sro.title || "", description: sro.description || "" }])
  }

  function addTypedSroToItem(itemId: string) {
    const draftSro = sroDraftByItem[itemId] || { code: "", title: "" }
    const code = draftSro.code.trim()
    if (!code) return
    const row = { code, title: draftSro.title.trim(), description: "" }
    addSroToItem(itemId, row)
    onAddSroToLibrary(row)
    setSroDraftByItem(prev => ({ ...prev, [itemId]: { code: "", title: "" } }))
  }

  function removeSro(id: string) {
    setSros(gdSros.filter(s => s.id !== id))
  }

  const cessDuties = duties.filter(d => d.category === "cess")
  const orphanDuties = duties.filter(d =>
    d.category !== "cess" && (!d.itemId || !items.some(i => i.id === d.itemId)),
  )
  const orphanSros = gdSros.filter(s => !s.itemId || !items.some(i => i.id === s.itemId))

  return (
    <div className="space-y-3">
      <Section title="PSW · Goods Declaration & payment slips">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
          <Field label="GD number">
            <input disabled={readOnly} value={draft.gdNumber} onChange={e => patch({ gdNumber: e.target.value })} className={inputCls} />
          </Field>
          <Field label="GD date">
            <input disabled={readOnly} type="date" value={draft.gdDate} onChange={e => patch({ gdDate: e.target.value })} className={inputCls} />
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

        <div className="mt-2 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-medium text-[hsl(var(--muted-foreground))]">
              PSID (payment slip) — add as many as needed
            </p>
            {!readOnly && (
              <Button type="button" size="sm" variant="outline" className="h-6 text-[10px]" onClick={addPsid}>
                <Plus className="h-3 w-3 mr-1" /> Add PSID
              </Button>
            )}
          </div>
          <div className="space-y-1.5">
            {psids.map((value, idx) => (
              <div key={idx} className="flex items-end gap-1.5">
                <Field label={`PSID ${idx + 1}`} className="flex-1">
                  <input
                    disabled={readOnly}
                    value={value}
                    onChange={e => updatePsid(idx, e.target.value)}
                    className={inputCls}
                    placeholder="e.g. 10007420260430025823"
                  />
                </Field>
                {!readOnly && psids.length > 1 && (
                  <button type="button" className="h-7 text-red-600 cursor-pointer px-1" onClick={() => removePsid(idx)}>
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </Section>

      <Section title="Duties & SROs by invoice item">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
            Each invoice item can have multiple duties and multiple SROs. Duties sync into Charges.
          </p>
          {!readOnly && (
            <Button type="button" size="sm" variant="outline" className={`h-6 text-[10px] ${btnHover}`} onClick={onOpenSroLibrary}>
              <BookMarked className="h-3 w-3 mr-1" /> SRO library
            </Button>
          )}
        </div>

        {items.length === 0 ? (
          <p className="text-[10px] text-[hsl(var(--muted-foreground))] border border-dashed rounded px-2 py-2 text-center">
            Add invoice items on the Invoice step first, then enter duties and SROs here.
          </p>
        ) : (
          <div className="space-y-3">
            {items.map((item, itemIdx) => {
              const itemDuties = duties.filter(d => d.itemId === item.id && d.category !== "cess")
              const itemSros = gdSros.filter(s => s.itemId === item.id)
              const sroDraft = sroDraftByItem[item.id] || { code: "", title: "" }
              const label = item.description || item.sku || item.hsCode || `Item ${itemIdx + 1}`
              return (
                <div key={item.id} className="rounded border p-2.5 space-y-2 bg-[hsl(var(--muted))]/10">
                  <div>
                    <p className="text-[11px] font-semibold">{label}</p>
                    <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
                      HS {item.hsCode || "—"} · Qty {item.qty || 0}
                      {item.netWeightKg || item.weightKg ? ` · Net ${item.netWeightKg || item.weightKg} kg` : ""}
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Duties</p>
                      {!readOnly && (
                        <Button type="button" size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => addDutyForItem(item.id)}>
                          <Plus className="h-3 w-3 mr-1" /> Add duty
                        </Button>
                      )}
                    </div>
                    {itemDuties.length === 0 ? (
                      <p className="text-[10px] text-[hsl(var(--muted-foreground))]">No duties for this item yet.</p>
                    ) : (
                      itemDuties.map((d, idx) => (
                        <div key={d.id} className="rounded border bg-[hsl(var(--background))] p-2 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <p className="text-[11px] font-medium">{d.name || `Duty ${idx + 1}`}</p>
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
                            <Field label="Description" className="sm:col-span-4">
                              <input disabled={readOnly} value={d.description} onChange={e => updateDuty(d.id, { description: e.target.value })} className={inputCls} placeholder="Optional note" />
                            </Field>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="space-y-1.5 pt-1 border-t">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">SROs for this item</p>
                    {!readOnly && (
                      <>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                          <Field label="SRO code" className="sm:col-span-2">
                            <input
                              value={sroDraft.code}
                              onChange={e => setSroDraftByItem(prev => ({ ...prev, [item.id]: { ...sroDraft, code: e.target.value } }))}
                              className={inputCls}
                              placeholder="Type SRO…"
                            />
                          </Field>
                          <Field label="Title">
                            <input
                              value={sroDraft.title}
                              onChange={e => setSroDraftByItem(prev => ({ ...prev, [item.id]: { ...sroDraft, title: e.target.value } }))}
                              className={inputCls}
                              placeholder="Optional"
                            />
                          </Field>
                          <div className="flex items-end">
                            <Button type="button" size="sm" className={`h-7 text-[11px] w-full ${btnHover}`} onClick={() => addTypedSroToItem(item.id)}>
                              <Plus className="h-3 w-3 mr-1" /> Add SRO
                            </Button>
                          </div>
                        </div>
                        {(sroLibrary.length > 0 || QUICK_ADD_SROS.length > 0) && (
                          <div className="flex flex-wrap gap-1">
                            <span className="text-[10px] text-[hsl(var(--muted-foreground))] self-center mr-0.5">Quick add:</span>
                            {sroLibrary.map(s => (
                              <button key={s.id} type="button" onClick={() => addSroToItem(item.id, s)} className={chipHover}>
                                + {s.code}
                              </button>
                            ))}
                            {QUICK_ADD_SROS.filter(q => !sroLibrary.some(s => s.code === q.code)).map(q => (
                              <button
                                key={q.code}
                                type="button"
                                onClick={() => {
                                  addSroToItem(item.id, q)
                                  onAddSroToLibrary(q)
                                }}
                                className={`${chipHover} border-dashed`}
                              >
                                + {q.code}
                              </button>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                    {itemSros.length === 0 ? (
                      <p className="text-[10px] text-[hsl(var(--muted-foreground))]">No SROs on this item yet.</p>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {itemSros.map(s => (
                          <span key={s.id} className="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] bg-[hsl(var(--background))]">
                            <span className="font-mono font-medium">{s.code}</span>
                            {s.title ? <span className="text-[hsl(var(--muted-foreground))]">· {s.title}</span> : null}
                            {!readOnly && (
                              <button type="button" className="text-red-600 cursor-pointer" onClick={() => removeSro(s.id)}>
                                <Trash2 className="h-2.5 w-2.5" />
                              </button>
                            )}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {(orphanDuties.length > 0 || orphanSros.length > 0) && (
          <div className="mt-2 rounded border border-dashed p-2 space-y-1.5">
            <p className="text-[10px] font-semibold text-[hsl(var(--muted-foreground))]">
              Unassigned / shared (from older entries)
            </p>
            {orphanDuties.map(d => (
              <div key={d.id} className="flex flex-wrap items-center gap-2 text-[11px]">
                <span className="font-medium">{d.name}</span>
                <span>{formatPkr(Number(d.amount) || 0)}</span>
                {!readOnly && items.length > 0 && (
                  <select
                    value=""
                    onChange={e => {
                      if (e.target.value) updateDuty(d.id, { itemId: e.target.value })
                    }}
                    className={inputCls + " w-auto max-w-[200px]"}
                  >
                    <option value="">Assign to item…</option>
                    {items.map(i => (
                      <option key={i.id} value={i.id}>{i.description || i.sku || i.id}</option>
                    ))}
                  </select>
                )}
                {!readOnly && (
                  <button type="button" className="text-red-600 cursor-pointer" onClick={() => removeDuty(d.id)}>
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))}
            {orphanSros.map(s => (
              <div key={s.id} className="flex flex-wrap items-center gap-2 text-[11px]">
                <span className="font-mono font-medium">{s.code}</span>
                <span>{s.title || "—"}</span>
                {!readOnly && items.length > 0 && (
                  <select
                    value=""
                    onChange={e => {
                      if (e.target.value) {
                        setSros(gdSros.map(x => x.id === s.id ? { ...x, itemId: e.target.value } : x))
                      }
                    }}
                    className={inputCls + " w-auto max-w-[200px]"}
                  >
                    <option value="">Assign to item…</option>
                    {items.map(i => (
                      <option key={i.id} value={i.id}>{i.description || i.sku || i.id}</option>
                    ))}
                  </select>
                )}
                {!readOnly && (
                  <button type="button" className="text-red-600 cursor-pointer" onClick={() => removeSro(s.id)}>
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Cess duties (shared across all items)">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
            Add as many cess lines as needed. Each is shared and split across all invoice items in landed cost.
          </p>
          {!readOnly && (
            <Button type="button" size="sm" variant="outline" className="h-6 text-[10px]" onClick={addCessDuty}>
              <Plus className="h-3 w-3 mr-1" /> Add cess
            </Button>
          )}
        </div>
        {cessDuties.length === 0 ? (
          <p className="text-[10px] text-[hsl(var(--muted-foreground))] border border-dashed rounded px-2 py-2 text-center">
            No cess duties yet.
          </p>
        ) : (
          <div className="space-y-2">
            {cessDuties.map((d, idx) => (
              <div key={d.id} className="rounded border p-2 space-y-1.5 bg-[hsl(var(--muted))]/10">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold">{d.name || `Cess ${idx + 1}`}</p>
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
                  <Field label="Amount">
                    <input
                      disabled={readOnly}
                      type="number"
                      step="0.01"
                      value={d.amount || ""}
                      onChange={e => updateDuty(d.id, { amount: Number(e.target.value) || 0 })}
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Currency">
                    <select disabled={readOnly} value={d.currency} onChange={e => updateDuty(d.id, { currency: e.target.value })} className={inputCls}>
                      {CURRENCIES.map(cur => <option key={cur} value={cur}>{cur}</option>)}
                    </select>
                  </Field>
                  <Field label="Shared">
                    <input disabled className={inputCls} value="All items" readOnly />
                  </Field>
                  <Field label="Description" className="sm:col-span-4">
                    <input
                      disabled={readOnly}
                      value={d.description}
                      onChange={e => updateDuty(d.id, { description: e.target.value })}
                      className={inputCls}
                      placeholder="Optional note"
                    />
                  </Field>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      <ImportAttachments
        attachments={draft.attachments}
        onChange={atts => patch({ attachments: atts })}
        uploadedBy={userName}
        readOnly={readOnly}
        allowedCategories={["psw_gd", "psid_receipt", "customs_assessment", "duty_tax_challan", "other"]}
        title="PSW & customs attachments"
        hint="Upload GD, PSID receipts, assessment, challans — name each file before uploading."
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
  const allCharges = draft.charges || []
  const charges = allCharges.filter(c => !c.fromDutyId && c.category !== "gst_on_charges")
  const gstCharge = allCharges.find(c => !c.fromDutyId && c.category === "gst_on_charges")
  const items = draft.items || []
  const dutySynced = allCharges.filter(c => c.fromDutyId)
  const [uploadingProofId, setUploadingProofId] = useState<string | null>(null)

  const fx = Number(draft.fxRate) || 0
  const dutiesTotalPkr = sumChargesPkr(dutySynced, fx)
  const chargesSubtotalPkr = sumChargesPkr(charges, fx)
  const gstMode: "percent" | "amount" =
    gstCharge?.gstMode || (Number(gstCharge?.gstPercent) > 0 ? "percent" : "amount")
  const gstPercent = Number(gstCharge?.gstPercent) || 0
  const gstAmountPkr = !gstCharge
    ? 0
    : gstMode === "percent" && gstPercent > 0
      ? Math.round((chargesSubtotalPkr * gstPercent) / 100)
      : Number(gstCharge.amount) || 0
  const grandTotalPkr = chargesSubtotalPkr + gstAmountPkr + dutiesTotalPkr

  function applyGst(next: ImportCharge[]): ImportCharge[] {
    const gst = next.find(c => c.category === "gst_on_charges" && !c.fromDutyId)
    const rest = next.filter(c => c.category !== "gst_on_charges" || c.fromDutyId)
    if (!gst) return rest
    const mode = gst.gstMode || (Number(gst.gstPercent) > 0 ? "percent" : "amount")
    if (mode === "percent") {
      const percent = Number(gst.gstPercent) || 0
      if (percent <= 0) return rest
      const base = sumChargesPkr(rest.filter(c => !c.fromDutyId), fx)
      const amount = Math.round((base * percent) / 100)
      return [
        ...rest,
        {
          ...gst,
          gstMode: "percent",
          amount,
          currency: "PKR",
          isShared: true,
          description: `GST on charges (${percent}%)`,
        },
      ]
    }
    return [
      ...rest,
      {
        ...gst,
        gstMode: "amount",
        gstPercent: 0,
        currency: "PKR",
        isShared: true,
        description: gst.description || "GST on charges",
      },
    ]
  }

  function setCharges(next: ImportCharge[]) {
    setDraft(d => d ? { ...d, charges: applyGst(next) } : d)
  }

  function addCharge(partial?: Partial<ImportCharge>) {
    const cat = (partial?.category || "ocean_freight") as ChargeCategory
    if (cat === "gst_on_charges") return
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
      transportFrom: "",
      transportTo: "",
      proofUrl: "",
      proofName: "",
      taxes: [],
      ...partial,
    }
    setCharges([...allCharges, c])
  }

  function updateCharge(id: string, p: Partial<ImportCharge>) {
    setCharges(allCharges.map(c => c.id === id ? { ...c, ...p } : c))
  }

  function removeCharge(id: string) {
    setCharges(allCharges.filter(c => c.id !== id))
  }

  function addTax(chargeId: string) {
    const tax: ImportChargeTax = { id: newId(), label: "", amount: 0 }
    const row = allCharges.find(c => c.id === chargeId)
    updateCharge(chargeId, { taxes: [...(row?.taxes || []), tax] })
  }

  function updateTax(chargeId: string, taxId: string, p: Partial<ImportChargeTax>) {
    const row = allCharges.find(c => c.id === chargeId)
    if (!row) return
    updateCharge(chargeId, {
      taxes: (row.taxes || []).map(t => t.id === taxId ? { ...t, ...p } : t),
    })
  }

  function removeTax(chargeId: string, taxId: string) {
    const row = allCharges.find(c => c.id === chargeId)
    if (!row) return
    updateCharge(chargeId, { taxes: (row.taxes || []).filter(t => t.id !== taxId) })
  }

  function setGst(opts: {
    enabled: boolean
    mode?: "percent" | "amount"
    percent?: number
    amount?: number
  }) {
    const others = allCharges.filter(c => c.category !== "gst_on_charges" || c.fromDutyId)
    if (!opts.enabled) {
      setDraft(d => d ? { ...d, charges: others.filter(c => c.category !== "gst_on_charges") } : d)
      return
    }
    const existing = allCharges.find(c => c.category === "gst_on_charges" && !c.fromDutyId)
    const mode = opts.mode || existing?.gstMode || "percent"
    const percent = opts.percent != null ? opts.percent : (Number(existing?.gstPercent) || 18)
    const amount = opts.amount != null ? opts.amount : (Number(existing?.amount) || 0)
    const gstRow: ImportCharge = {
      id: existing?.id || newId(),
      category: "gst_on_charges",
      description: mode === "percent" ? `GST on charges (${percent}%)` : "GST on charges",
      amount: mode === "amount" ? amount : 0,
      currency: "PKR",
      fxRate: 0,
      isShared: true,
      itemId: "",
      allocationMethod: "",
      paid: existing?.paid || false,
      paymentRef: "",
      notes: "",
      gstMode: mode,
      gstPercent: mode === "percent" ? percent : 0,
      proofUrl: existing?.proofUrl || "",
      proofName: existing?.proofName || "",
      taxes: [],
    }
    setCharges([...others, gstRow])
  }

  async function uploadProof(chargeId: string, file: File | null) {
    if (!file) return
    setUploadingProofId(chargeId)
    try {
      const url = await uploadFile(file, "import-shipment-docs")
      updateCharge(chargeId, { proofUrl: url, proofName: file.name, paid: true })
    } finally {
      setUploadingProofId(null)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold">All landing charges</p>
          <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
            Shared split across items · direct to one item. Add named taxes per charge. PSW duties are read-only here.
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
          {dutySynced.length} customs duty line(s) from PSW — edit them on the PSW step. Total {formatPkr(dutiesTotalPkr)}.
        </div>
      )}

      {charges.length === 0 ? (
        <p className="text-[11px] text-[hsl(var(--muted-foreground))] border border-dashed rounded p-3 text-center">
          Add freight, clearing, transport, bank charges, etc.
        </p>
      ) : (
        <div className="space-y-1.5">
          {charges.map(c => {
            const isTransport = TRANSPORT_CHARGE_CATEGORIES.includes(c.category)
            const taxes = c.taxes || []
            const taxTotal = chargeTaxesPkr(c)
            return (
              <div key={c.id} className="rounded border p-2 space-y-1.5">
                <div className="grid grid-cols-2 sm:grid-cols-6 gap-1.5">
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
                      {CHARGE_CATEGORIES.filter(x => x.value !== "gst_on_charges").map(x => (
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
                  {isTransport && (
                    <>
                      <Field label="From">
                        <input
                          disabled={readOnly}
                          value={c.transportFrom || ""}
                          onChange={e => updateCharge(c.id, { transportFrom: e.target.value })}
                          className={inputCls}
                          placeholder="Origin / pickup"
                        />
                      </Field>
                      <Field label="To">
                        <input
                          disabled={readOnly}
                          value={c.transportTo || ""}
                          onChange={e => updateCharge(c.id, { transportTo: e.target.value })}
                          className={inputCls}
                          placeholder="Destination"
                        />
                      </Field>
                    </>
                  )}
                  <Field label="Description" className="sm:col-span-2">
                    <input disabled={readOnly} value={c.description} onChange={e => updateCharge(c.id, { description: e.target.value })} className={inputCls} />
                  </Field>
                  <Field label="Attachment (screenshot / PDF)" className="sm:col-span-2">
                    <div className="flex items-center gap-1.5 min-h-7">
                      {c.proofUrl ? (
                        <a href={c.proofUrl} target="_blank" rel="noreferrer" className="text-[10px] underline truncate max-w-[140px]">
                          {c.proofName || "View file"}
                        </a>
                      ) : (
                        <span className="text-[10px] text-[hsl(var(--muted-foreground))]">No file</span>
                      )}
                      {!readOnly && (
                        <>
                          <input
                            type="file"
                            id={`charge-proof-${c.id}`}
                            accept="image/*,.pdf"
                            className="hidden"
                            onChange={e => {
                              void uploadProof(c.id, e.target.files?.[0] || null)
                              e.target.value = ""
                            }}
                          />
                          <label htmlFor={`charge-proof-${c.id}`} className="cursor-pointer">
                            <span className={`${chipHover} inline-block`}>
                              {uploadingProofId === c.id ? "…" : c.proofUrl ? "Replace" : "Attach"}
                            </span>
                          </label>
                          {c.proofUrl && (
                            <button
                              type="button"
                              className="text-[10px] text-red-600 cursor-pointer"
                              onClick={() => updateCharge(c.id, { proofUrl: "", proofName: "" })}
                            >
                              Remove
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </Field>
                  <div className="flex items-end gap-2 sm:col-span-2">
                    <label className="flex items-center gap-1 text-[11px] h-7">
                      <input disabled={readOnly} type="checkbox" checked={c.paid} onChange={e => updateCharge(c.id, { paid: e.target.checked })} />
                      Paid
                    </label>
                    <span className="text-[10px] text-[hsl(var(--muted-foreground))] self-center">
                      {formatPkr(chargeAmountPkr(c, fx))}
                      {taxTotal > 0 ? (
                        <span className="ml-1">(base {formatPkr(chargeBaseAmountPkr(c, fx))})</span>
                      ) : null}
                    </span>
                    {!readOnly && (
                      <Button type="button" variant="ghost" size="sm" className="h-7 text-[11px] text-red-600 ml-auto" onClick={() => removeCharge(c.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>

                <div className="rounded border border-dashed px-2 py-1.5 space-y-1.5 bg-[hsl(var(--muted))]/10">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                      Taxes on this charge
                    </p>
                    {!readOnly && (
                      <Button type="button" size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => addTax(c.id)}>
                        <Plus className="h-3 w-3 mr-1" /> Add tax
                      </Button>
                    )}
                  </div>
                  {taxes.length === 0 ? (
                    <p className="text-[10px] text-[hsl(var(--muted-foreground))]">No separate tax — optional (e.g. sales tax, FED).</p>
                  ) : (
                    <div className="space-y-1">
                      {taxes.map((t, idx) => (
                        <div key={t.id} className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 items-end">
                          <Field label={`Tax label ${idx + 1}`} className="sm:col-span-2">
                            <input
                              disabled={readOnly}
                              value={t.label}
                              onChange={e => updateTax(c.id, t.id, { label: e.target.value })}
                              className={inputCls}
                              placeholder="e.g. Sales Tax"
                            />
                          </Field>
                          <Field label="Amount (PKR)" className="sm:col-span-2">
                            <input
                              disabled={readOnly}
                              type="number"
                              step="0.01"
                              value={t.amount || ""}
                              onChange={e => updateTax(c.id, t.id, { amount: Number(e.target.value) || 0 })}
                              className={inputCls}
                            />
                          </Field>
                          {!readOnly && (
                            <button type="button" className="h-7 text-red-600 cursor-pointer justify-self-start" onClick={() => removeTax(c.id, t.id)}>
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="rounded-md border p-2.5 space-y-2 bg-[hsl(var(--muted))]/10">
        <p className="text-[11px] font-semibold">Charges summary</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[11px]">
          <div>
            <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Charges subtotal</p>
            <p className="font-semibold">{formatPkr(chargesSubtotalPkr)}</p>
          </div>
          <div>
            <p className="text-[10px] text-[hsl(var(--muted-foreground))]">PSW duties</p>
            <p className="font-semibold">{formatPkr(dutiesTotalPkr)}</p>
          </div>
          <div>
            <p className="text-[10px] text-[hsl(var(--muted-foreground))]">GST</p>
            <p className="font-semibold">{formatPkr(gstAmountPkr)}</p>
          </div>
          <div>
            <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Grand total</p>
            <p className="font-semibold">{formatPkr(grandTotalPkr)}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-2 pt-1 border-t">
          <label className="flex items-center gap-1.5 text-[11px] h-7">
            <input
              disabled={readOnly}
              type="checkbox"
              checked={!!gstCharge}
              onChange={e => setGst({
                enabled: e.target.checked,
                mode: gstMode || "percent",
                percent: gstPercent || 18,
                amount: Number(gstCharge?.amount) || 0,
              })}
            />
            Add GST on charges
          </label>
          <Field label="GST mode">
            <select
              disabled={readOnly || !gstCharge}
              value={gstMode}
              onChange={e => setGst({
                enabled: true,
                mode: e.target.value as "percent" | "amount",
                percent: gstPercent || 18,
                amount: Number(gstCharge?.amount) || gstAmountPkr || 0,
              })}
              className={inputCls + " w-[7.5rem]"}
            >
              <option value="percent">Percentage</option>
              <option value="amount">Amount</option>
            </select>
          </Field>
          {gstMode === "percent" ? (
            <Field label="GST %">
              <input
                disabled={readOnly || !gstCharge}
                type="number"
                step="0.01"
                value={gstCharge ? gstPercent || "" : ""}
                onChange={e => setGst({ enabled: true, mode: "percent", percent: Number(e.target.value) || 0 })}
                className={inputCls + " w-20"}
                placeholder="18"
              />
            </Field>
          ) : (
            <Field label="GST amount (PKR)">
              <input
                disabled={readOnly || !gstCharge}
                type="number"
                step="0.01"
                value={gstCharge ? (Number(gstCharge.amount) || "") : ""}
                onChange={e => setGst({ enabled: true, mode: "amount", amount: Number(e.target.value) || 0 })}
                className={inputCls + " w-28"}
                placeholder="0"
              />
            </Field>
          )}
          {!!gstCharge && (
            <p className="text-[10px] text-[hsl(var(--muted-foreground))] self-center">
              GST {formatPkr(gstAmountPkr)} included in landed cost
              {gstMode === "percent" ? ` (${gstPercent}% of charges)` : " (fixed amount)"}.
            </p>
          )}
        </div>
      </div>

      <ImportAttachments
        attachments={draft.attachments}
        onChange={atts => setDraft(d => d ? { ...d, attachments: atts } : d)}
        uploadedBy={userName}
        readOnly={readOnly}
        allowedCategories={["freight_invoice", "clearing_agent_invoice", "transport_invoice", "payment_proof", "other"]}
        title="Charge invoices & payment proofs"
        hint="Name and upload freight, clearing, transport invoices and payment screenshots/PDFs."
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
