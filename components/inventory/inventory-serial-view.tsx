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
import { deleteManualInventoryItem, getManualInventoryItems } from "@/lib/manual-inventory"
import {
  buildUnifiedInventoryGroups,
  filterUnifiedGroups,
  unifiedGroupInStock,
  unifiedGroupTotal,
  type UnifiedInventoryModelGroup,
} from "@/lib/unified-inventory-groups"
import { downloadSerialUnitsExcel } from "@/lib/inventory-excel-export"
import { InventoryModelGroup } from "@/components/inventory/inventory-model-group"
import { InventoryQrScanPanel } from "@/components/inventory/inventory-qr-scan-panel"
import { CrmExcelExportButton } from "@/components/crm/crm-excel-export-button"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import {
  Package,
  Search,
  X,
  QrCode,
  Loader2,
  Boxes,
  Layers3,
  CircleCheck,
} from "lucide-react"

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
  const [manualItemsCache, setManualItemsCache] = useState<any[]>([])
  const [stockRowsCache, setStockRowsCache] = useState<any[]>([])
  const [editingModel, setEditingModel] = useState<string | null>(null)
  const [editingName, setEditingName] = useState("")
  const [savingModelLabel, setSavingModelLabel] = useState(false)

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

      setUnits(rows)
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
      for (const unit of rows) {
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
      setManualItemsCache(Array.isArray(manualItems) ? manualItems : [])
      setStockRowsCache(Array.isArray(stockRows) ? stockRows : [])
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

  const uniqueUnits = useMemo(() => {
    const byKey = new Map<string, InventorySerialUnit>()
    for (const unit of units) {
      const key = serialNumberKey(unit.serialNumber)
      if (!key) continue
      if (!byKey.has(key)) byKey.set(key, unit)
    }
    return Array.from(byKey.values())
  }, [units])

  const filteredUnits = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return uniqueUnits
    return uniqueUnits.filter(
      (u) =>
        u.serialNumber.toLowerCase().includes(q) ||
        (u.model || "").toLowerCase().includes(q) ||
        (u.productName || "").toLowerCase().includes(q) ||
        (u.specs || "").toLowerCase().includes(q) ||
        (u.notes || "").toLowerCase().includes(q),
    )
  }, [uniqueUnits, search])

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

  function exportExcel() {
    setExportingExcel(true)
    try {
      downloadSerialUnitsExcel(filteredUnits)
      toast({
        title: "Download started",
        message: `${filteredUnits.length} unit(s) exported.`,
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
        ? `\n\nThis unit is currently “${unit.status.replace(/_/g, " ")}”.`
        : ""
    if (!confirm(`Remove SN ${label} from inventory? This cannot be undone.${statusNote}`)) return

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
    if (
      !confirm(
        unitCount > 0
          ? `Delete all ${unitCount} serial unit(s) for “${display}” (${modelKey})?\n\nThis removes every serial number for this model.`
          : `Delete inventory model “${display}” (${modelKey})?\n\nThis removes this product/model row.`,
      )
    ) {
      return
    }

    setDeletingModel(modelKey)
    try {
      let deleted = 0
      if (unitCount > 0) {
        deleted = await deleteInventorySerialUnitsByModel(modelKey)
      } else if (group.stockOnly?.isManual) {
        const manual = manualItemsCache.find((m) => String(m?.model || "").trim() === modelKey.trim())
        if (!manual?.id) throw new Error("Manual inventory record not found.")
        await deleteManualInventoryItem(manual.id)
        deleted = Number(manual.qty || 0)
      } else {
        const stockRow = stockRowsCache.find(
          (row) =>
            String(row?.description || row?.name || "")
              .trim()
              .toLowerCase() === modelKey.trim().toLowerCase(),
        )
        if (!stockRow?.id) throw new Error("Stock record not found.")
        const res = await fetch("/api/db/inventory-stock", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "delete", data: { itemId: stockRow.id } }),
        })
        if (!res.ok) throw new Error("Could not delete stock record.")
        deleted = Number(stockRow.availableQty ?? stockRow.receivedQty ?? 0) || 0
      }
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

  const statItems = [
    { label: "Boxes", value: totalBoxes, icon: Boxes },
    { label: "Models", value: modelCount, icon: Layers3 },
    { label: "In stock", value: inStockCount, icon: CircleCheck },
  ]

  return (
    <div className={embedded ? "space-y-4" : "space-y-5"}>
      <div
        className={`rounded-xl border bg-[hsl(var(--card))] p-4 sm:p-5 ${embedded ? "" : "shadow-sm"}`}
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          {statItems.map((s) => {
            const Icon = s.icon
            return (
              <div
                key={s.label}
                className="flex items-center gap-3 rounded-lg border bg-[hsl(var(--background))] px-4 py-3.5"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#1faca6]/10 text-[#1faca6]">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-2xl font-semibold tabular-nums text-[#1faca6] leading-none">{s.value}</p>
                  <p className="text-xs font-medium uppercase tracking-wide text-[hsl(var(--muted-foreground))] mt-1">
                    {s.label}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-lg">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--muted-foreground))]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search model, SN…"
              className="w-full h-10 rounded-lg border bg-[hsl(var(--background))] pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#1faca6]/40"
            />
          </div>
          <CrmExcelExportButton
            onExport={exportExcel}
            exporting={exportingExcel}
            disabled={filteredUnits.length === 0}
            className="h-10 px-4 text-sm gap-2 cursor-pointer shrink-0"
          />
          <Button
            className="h-10 px-4 text-sm bg-[#1faca6] hover:bg-[#17857f] text-white gap-2 shrink-0"
            onClick={() => setShowQrModal(true)}
          >
            <QrCode className="h-4 w-4" />
            Scan QR
          </Button>
          {toolbarEnd}
        </div>
      </div>

      {modelCount === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center text-[hsl(var(--muted-foreground))] rounded-xl border border-dashed bg-[hsl(var(--card))]/50">
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
        <div className="rounded-xl border overflow-hidden bg-[hsl(var(--card))] shadow-sm">
          <div className="hidden sm:grid sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_88px_88px_64px_64px] gap-3 px-4 py-3 border-b bg-[hsl(var(--muted))]/20 text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
            <span>Model / product</span>
            <span>Model code</span>
            <span className="text-right">Stock</span>
            <span className="text-right">Units</span>
            <span className="text-right text-[10px] font-normal normal-case tracking-normal text-[#1faca6]/90">
              Click for prices
            </span>
            <span className="text-right">Delete</span>
          </div>
          <div className="divide-y">
          {filteredGroups.map((group) => (
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
            />
          ))}
          </div>
        </div>
      )}

      {showQrModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={() => setShowQrModal(false)}
        >
          <div
            className="w-full max-w-2xl max-h-[92vh] rounded-xl border bg-[hsl(var(--card))] shadow-2xl flex flex-col overflow-hidden"
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
