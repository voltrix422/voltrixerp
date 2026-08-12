"use client"

import { useCallback, useEffect, useMemo, useState, type MouseEvent, type ReactNode } from "react"
import {
  deleteInventorySerialUnit,
  deleteInventorySerialUnitsByModel,
  getInventorySerialUnits,
  serialNumberKey,
  type InventorySerialUnit,
} from "@/lib/inventory-serial-units"
import { getInventoryModelLabels, saveInventoryModelLabel } from "@/lib/inventory-model-labels"
import {
  getManualInventoryItems,
  subtractManualInventoryStock,
  subtractManualInventoryUnits,
} from "@/lib/manual-inventory"
import { getSession } from "@/lib/auth"
import {
  buildUnifiedInventoryGroups,
  filterUnifiedGroups,
  unifiedGroupInStock,
  unifiedGroupTotal,
  type UnifiedInventoryModelGroup,
} from "@/lib/unified-inventory-groups"
import { downloadUnifiedInventoryExcel } from "@/lib/inventory-excel-export"
import {
  markSerialUnitFaulty,
  moveManualQtyToFaulty,
  moveStockQtyToFaulty,
} from "@/lib/faulty-inventory"
import { InventoryModelGroup } from "@/components/inventory/inventory-model-group"
import { InventoryQrScanPanel } from "@/components/inventory/inventory-qr-scan-panel"
import { CrmExcelExportButton } from "@/components/crm/crm-excel-export-button"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { useDialog } from "@/components/ui/dialog-provider"
import { Package, Search, X, QrCode, Loader2 } from "lucide-react"

type InventorySerialViewProps = {
  /** Renders after Export Excel / Scan QR (e.g. Send multiple on branch detail). */
  toolbarEnd?: ReactNode
  /** Parent refresh when units are scanned or deleted. */
  onUnitsChanged?: () => void
  /** Tighter layout inside branch detail (no negative horizontal margin). */
  embedded?: boolean
}

export function InventorySerialView({ toolbarEnd, onUnitsChanged, embedded }: InventorySerialViewProps = {}) {
  const { toast } = useToast()
  const { confirm: confirmDialog } = useDialog()
  const [units, setUnits] = useState<InventorySerialUnit[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [exportingExcel, setExportingExcel] = useState(false)
  const [showQrModal, setShowQrModal] = useState(false)
  const [expandedModels, setExpandedModels] = useState<Record<string, boolean>>({})
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deletingModel, setDeletingModel] = useState<string | null>(null)
  const [modelLabels, setModelLabels] = useState<Record<string, string>>({})
  const [inventoryGroups, setInventoryGroups] = useState<UnifiedInventoryModelGroup[]>([])
  const [editingModel, setEditingModel] = useState<string | null>(null)
  const [editingName, setEditingName] = useState("")
  const [savingModelLabel, setSavingModelLabel] = useState(false)
  const [adjustingManual, setAdjustingManual] = useState<{ id: string; mode: "stock" | "units" } | null>(null)
  const [markingFaultyId, setMarkingFaultyId] = useState<string | null>(null)
  const [movingToFaulty, setMovingToFaulty] = useState(false)

  const loadUnits = useCallback(async () => {
    setLoading(true)
    try {
      const [rows, labels, manualItems, stockRes] = await Promise.all([
        getInventorySerialUnits(),
        getInventoryModelLabels().catch(() => []),
        getManualInventoryItems().catch(() => []),
        fetch("/api/db/inventory-stock", { cache: "no-store" }).catch(() => null),
      ])
      const stockRows = stockRes?.ok ? await stockRes.json() : []

      const warehouseUnits = rows.filter(
        (u) => u.status === "in_stock" || u.status === "at_branch",
      )
      setUnits(warehouseUnits)
      const map: Record<string, string> = {}
      for (const label of labels) {
        if (label.model && label.displayName) map[label.model] = label.displayName
      }
      for (const unit of rows) {
        const m = unit.model?.trim()
        if (!m || map[m]) continue
        const name = unit.productName?.trim()
        if (name && name !== m) map[m] = name
      }
      for (const manual of manualItems) {
        if (manual.model && manual.name) map[manual.model] = manual.name
      }
      setModelLabels(map)

      const uniqueBySn = new Map<string, InventorySerialUnit>()
      for (const unit of warehouseUnits) {
        const key = serialNumberKey(unit.serialNumber)
        if (!key) continue
        if (!uniqueBySn.has(key)) uniqueBySn.set(key, unit)
      }
      setInventoryGroups(
        buildUnifiedInventoryGroups(
          Array.from(uniqueBySn.values()),
          manualItems,
          Array.isArray(stockRows) ? stockRows : [],
          map,
        ),
      )
    } catch {
      toast({ title: "Error", message: "Could not load inventory.", type: "error" })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void loadUnits()
  }, [loadUnits])

  function getDisplayName(modelKey: string) {
    return modelLabels[modelKey]?.trim() || ""
  }

  function startEditModelName(modelKey: string, e: MouseEvent) {
    e.stopPropagation()
    setEditingModel(modelKey)
    setEditingName(getDisplayName(modelKey))
  }

  async function saveModelName(modelKey: string) {
    setSavingModelLabel(true)
    try {
      const name = editingName.trim()
      await saveInventoryModelLabel(modelKey, name)
      setModelLabels((prev) => {
        const next = { ...prev }
        if (name) next[modelKey] = name
        else delete next[modelKey]
        return next
      })
      if (name) {
        setUnits((prev) =>
          prev.map((u) => (u.model === modelKey ? { ...u, productName: name } : u)),
        )
      }
      setEditingModel(null)
      toast({
        title: "Saved",
        message: name ? `Name set for ${modelKey}` : `Name cleared for ${modelKey}`,
        type: "success",
      })
    } catch (err) {
      toast({
        title: "Error",
        message: err instanceof Error ? err.message : "Could not save name.",
        type: "error",
      })
    } finally {
      setSavingModelLabel(false)
    }
  }

  const filteredGroups = useMemo(
    () => filterUnifiedGroups(inventoryGroups, search),
    [inventoryGroups, search],
  )

  useEffect(() => {
    const q = search.trim()
    if (!q) return
    setExpandedModels((prev) => {
      const next = { ...prev }
      for (const group of filteredGroups) next[group.modelKey] = true
      return next
    })
  }, [search, filteredGroups])

  const totalBoxes = useMemo(
    () => filteredGroups.reduce((sum, g) => sum + unifiedGroupTotal(g), 0),
    [filteredGroups],
  )
  const inStockCount = useMemo(
    () => filteredGroups.reduce((sum, g) => sum + unifiedGroupInStock(g), 0),
    [filteredGroups],
  )
  const modelCount = filteredGroups.length
  const serialTrackedGroups = useMemo(
    () => filteredGroups.filter((group) => group.units.length > 0),
    [filteredGroups],
  )
  const nonSerialGroups = useMemo(
    () => filteredGroups.filter((group) => group.units.length === 0),
    [filteredGroups],
  )

  function exportExcel() {
    setExportingExcel(true)
    try {
      const rowCount = downloadUnifiedInventoryExcel(filteredGroups, getSession()?.name)
      toast({
        title: "Download started",
        message: `${rowCount} row(s) exported.`,
        type: "success",
      })
    } catch {
      toast({ title: "Error", message: "Could not export.", type: "error" })
    } finally {
      setExportingExcel(false)
    }
  }

  function handleScanSaved() {
    void loadUnits().then(() => onUnitsChanged?.())
    setShowQrModal(false)
  }

  async function handleDeleteUnit(unit: InventorySerialUnit) {
    const label = unit.serialNumber || unit.model || "this unit"
    const statusNote =
      unit.status && unit.status !== "in_stock"
        ? ` Current status: ${unit.status.replace(/_/g, " ")}.`
        : ""
    const ok = await confirmDialog({
      type: "confirm",
      title: "Delete serial number?",
      message: `Deleting SN ${label} is permanent.${statusNote}`,
      confirmLabel: "Delete SN",
      cancelLabel: "Cancel",
    })
    if (!ok) return

    setDeletingId(unit.id)
    try {
      await deleteInventorySerialUnit(unit.id)
      await loadUnits()
      onUnitsChanged?.()
      toast({
        title: "Removed",
        message: `SN ${unit.serialNumber} deleted from inventory.`,
        type: "success",
      })
    } catch (err) {
      toast({
        title: "Error",
        message: err instanceof Error ? err.message : "Could not delete unit.",
        type: "error",
      })
    } finally {
      setDeletingId(null)
    }
  }

  async function handleDeleteModel(group: UnifiedInventoryModelGroup) {
    const modelKey = group.modelKey
    const unitCount = group.units.length
    const display = getDisplayName(modelKey) || group.displayName || modelKey
    const ok = await confirmDialog({
      type: "confirm",
      title: "Delete product/model?",
      message:
        unitCount > 0
          ? `Deleting "${display}" will also delete all related serial numbers and quantities (${unitCount} SN). This cannot be undone.`
          : `Deleting "${display}" will remove this product/model row and related quantity. This cannot be undone.`,
      confirmLabel: "Delete product",
      cancelLabel: "Cancel",
    })
    if (!ok) return

    setDeletingModel(modelKey)
    try {
      const deleted = await deleteInventorySerialUnitsByModel(modelKey)
      await loadUnits()
      setModelLabels((prev) => {
        const next = { ...prev }
        delete next[modelKey]
        return next
      })
      onUnitsChanged?.()
      toast({
        title: "Model removed",
        message:
          unitCount > 0
            ? `${deleted} unit(s) deleted for ${modelKey}.`
            : `${modelKey} removed from inventory.`,
        type: "success",
      })
      return true
    } catch (err) {
      toast({
        title: "Error",
        message: err instanceof Error ? err.message : "Could not delete model.",
        type: "error",
      })
      return false
    } finally {
      setDeletingModel(null)
    }
  }

  if (loading && units.length === 0) {
    return (
      <div className="flex items-center justify-center h-56 text-base text-[hsl(var(--muted-foreground))]">
        <Loader2 className="h-6 w-6 animate-spin mr-2.5" />
        Loading inventory…
      </div>
    )
  }

  async function handleSubtractManualStock(manualId: string, qty: number): Promise<boolean> {
    setAdjustingManual({ id: manualId, mode: "stock" })
    try {
      const user = getSession()?.name || "Inventory"
      await subtractManualInventoryStock({ manualId, qty, subtractedBy: user })
      await loadUnits()
      onUnitsChanged?.()
      toast({ title: "Stock updated", message: `${qty} subtracted from available stock.`, type: "success" })
      return true
    } catch (err) {
      toast({
        title: "Could not subtract stock",
        message: err instanceof Error ? err.message : undefined,
        type: "error",
      })
      return false
    } finally {
      setAdjustingManual(null)
    }
  }

  async function handleSubtractManualUnits(manualId: string, qty: number): Promise<boolean> {
    setAdjustingManual({ id: manualId, mode: "units" })
    try {
      const user = getSession()?.name || "Inventory"
      await subtractManualInventoryUnits({ manualId, qty, subtractedBy: user })
      await loadUnits()
      onUnitsChanged?.()
      toast({ title: "Units updated", message: `${qty} subtracted from total units.`, type: "success" })
      return true
    } catch (err) {
      toast({
        title: "Could not subtract units",
        message: err instanceof Error ? err.message : undefined,
        type: "error",
      })
      return false
    } finally {
      setAdjustingManual(null)
    }
  }

  async function handleMarkSerialFaulty(unit: InventorySerialUnit): Promise<boolean> {
    const ok = await confirmDialog({
      type: "confirm",
      title: "Mark as faulty / damaged?",
      message: `Move SN ${unit.serialNumber} out of main inventory into faulty/damaged stock.`,
      confirmLabel: "Mark faulty",
      cancelLabel: "Cancel",
    })
    if (!ok) return false

    setMarkingFaultyId(unit.id)
    try {
      await markSerialUnitFaulty({
        unitId: unit.id,
        actor: getSession()?.name || "Inventory",
      })
      await loadUnits()
      onUnitsChanged?.()
      toast({
        title: "Moved to faulty",
        message: `${unit.serialNumber} is now in faulty/damaged inventory.`,
        type: "success",
      })
      return true
    } catch (err) {
      toast({
        title: "Could not mark faulty",
        message: err instanceof Error ? err.message : undefined,
        type: "error",
      })
      return false
    } finally {
      setMarkingFaultyId(null)
    }
  }

  async function handleMoveQtyToFaulty(input: {
    manualId?: string
    stockId?: string
    qty: number
  }): Promise<boolean> {
    setMovingToFaulty(true)
    try {
      const actor = getSession()?.name || "Inventory"
      if (input.manualId) {
        await moveManualQtyToFaulty({ manualId: input.manualId, qty: input.qty, actor })
      } else if (input.stockId) {
        await moveStockQtyToFaulty({ stockId: input.stockId, qty: input.qty, actor })
      } else {
        throw new Error("No inventory source selected")
      }
      await loadUnits()
      onUnitsChanged?.()
      toast({
        title: "Moved to faulty",
        message: `${input.qty} unit(s) moved to faulty/damaged inventory.`,
        type: "success",
      })
      return true
    } catch (err) {
      toast({
        title: "Could not move to faulty",
        message: err instanceof Error ? err.message : undefined,
        type: "error",
      })
      return false
    } finally {
      setMovingToFaulty(false)
    }
  }

  function renderGroupTable(title: string, groups: UnifiedInventoryModelGroup[]) {
    return (
      <div className="rounded-lg border overflow-hidden bg-[hsl(var(--background))]">
        <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-b">
          <p className="text-xs sm:text-sm font-semibold text-[hsl(var(--foreground))] leading-snug">{title}</p>
          <span className="text-[11px] text-[hsl(var(--muted-foreground))] shrink-0">{groups.length} models</span>
        </div>
        <div className="hidden sm:grid sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_88px_88px_minmax(100px,1fr)] gap-3 px-3 py-2 border-b text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
          <span>Model / product</span>
          <span>Model code</span>
          <span className="text-right">Stock</span>
          <span className="text-right">Units</span>
          <span className="text-right text-[10px] font-normal normal-case tracking-normal text-[#1faca6]/90">
            Click for prices · − stock · U− units
          </span>
        </div>
        <div className="divide-y">
          {groups.map((group) => (
            <InventoryModelGroup
              key={group.modelKey}
              modelKey={group.modelKey}
              modelUnits={group.units}
              stockOnly={group.stockOnly}
              expanded={expandedModels[group.modelKey] === true}
              onToggle={() =>
                setExpandedModels((prev) => ({ ...prev, [group.modelKey]: !prev[group.modelKey] }))
              }
              customName={getDisplayName(group.modelKey) || group.displayName}
              isEditing={editingModel === group.modelKey}
              editingName={editingName}
              savingModelLabel={savingModelLabel}
              deletingId={deletingId}
              deletingModel={deletingModel === group.modelKey}
              onEditingNameChange={setEditingName}
              onStartEdit={(e) => startEditModelName(group.modelKey, e)}
              onSaveName={() => void saveModelName(group.modelKey)}
              onCancelEdit={() => setEditingModel(null)}
              onDeleteUnit={(unit) => void handleDeleteUnit(unit)}
              onDeleteModel={() => handleDeleteModel(group)}
              onSubtractManualStock={handleSubtractManualStock}
              onSubtractManualUnits={handleSubtractManualUnits}
              onMarkSerialFaulty={handleMarkSerialFaulty}
              onMoveQtyToFaulty={handleMoveQtyToFaulty}
              adjustingManual={adjustingManual}
              markingFaultyId={markingFaultyId}
              movingToFaulty={movingToFaulty}
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className={`flex flex-col gap-3 min-h-0 ${embedded ? "" : "sm:h-[calc(100vh-11rem)]"}`}>
      <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center rounded-lg border px-3 py-2.5 sm:py-2 shrink-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-[hsl(var(--muted-foreground))]">
          <span className="tabular-nums">
            <span className="font-semibold text-[hsl(var(--foreground))]">{totalBoxes}</span> boxes
          </span>
          <span className="text-[hsl(var(--border))] hidden xs:inline">·</span>
          <span className="tabular-nums">
            <span className="font-semibold text-[hsl(var(--foreground))]">{modelCount}</span> models
          </span>
          <span className="text-[hsl(var(--border))]">·</span>
          <span className="tabular-nums">
            <span className="font-semibold text-[#1faca6]">{inStockCount}</span> in stock
          </span>
        </div>
        <div className="relative w-full sm:flex-1 sm:min-w-[160px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search model, SN…"
            className="w-full h-9 sm:h-8 rounded-md border bg-[hsl(var(--background))] pl-8 pr-3 text-sm sm:text-xs focus:outline-none focus:ring-1 focus:ring-[#1faca6]/40"
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <CrmExcelExportButton
            onExport={exportExcel}
            exporting={exportingExcel}
            disabled={modelCount === 0 || loading}
            className="h-9 sm:h-8 flex-1 sm:flex-none px-2.5 text-xs gap-1.5 cursor-pointer justify-center"
          />
          <Button
            className="h-9 sm:h-8 flex-1 sm:flex-none px-2.5 text-xs bg-[#1faca6] hover:bg-[#17857f] text-white gap-1.5"
            onClick={() => setShowQrModal(true)}
          >
            <QrCode className="h-3.5 w-3.5" />
            Scan QR
          </Button>
          {toolbarEnd}
        </div>
      </div>

      {modelCount === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center text-[hsl(var(--muted-foreground))] rounded-lg border border-dashed">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[hsl(var(--muted))]/30 mb-3">
            <Package className="h-7 w-7 opacity-40" />
          </div>
          <p className="text-base font-medium text-[hsl(var(--foreground))]">No inventory yet</p>
          <p className="text-sm mt-1.5 max-w-sm">Scan QR to add boxes to the warehouse.</p>
          <Button
            className="mt-5 h-10 px-5 text-sm bg-[#1faca6] hover:bg-[#17857f] text-white gap-2"
            onClick={() => setShowQrModal(true)}
          >
            <QrCode className="h-4 w-4" />
            Scan QR
          </Button>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-0.5">
          {serialTrackedGroups.length > 0 && renderGroupTable("Inventory with SN numbers", serialTrackedGroups)}
          {nonSerialGroups.length > 0 && renderGroupTable("Inventory without SN numbers", nonSerialGroups)}
        </div>
      )}

      {showQrModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={() => setShowQrModal(false)}
        >
          <div
            className="w-full max-w-2xl max-h-[92vh] rounded-lg border bg-[hsl(var(--card))] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
              <div>
                <p className="text-sm font-semibold flex items-center gap-2">
                  <QrCode className="h-4 w-4 text-[#1faca6]" />
                  Bulk QR receiving
                </p>
                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
                  Scan each box, then complete scan to save.
                </p>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowQrModal(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <InventoryQrScanPanel
                existingSerialNumbers={units.map((u) => u.serialNumber)}
                onSaved={handleScanSaved}
                compact
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
