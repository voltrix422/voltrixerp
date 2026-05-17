"use client"

import { useCallback, useEffect, useMemo, useState, type MouseEvent } from "react"
import {
  deleteInventorySerialUnit,
  getInventorySerialUnits,
  serialNumberKey,
  type InventorySerialUnit,
} from "@/lib/inventory-serial-units"
import { getInventoryModelLabels, saveInventoryModelLabel } from "@/lib/inventory-model-labels"
import { downloadSerialUnitsExcel } from "@/lib/inventory-excel-export"
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
  ChevronDown,
  ChevronUp,
  Trash2,
  Pencil,
  Check,
} from "lucide-react"

function formatDate(iso?: string) {
  if (!iso) return "—"
  try {
    return new Date(iso).toLocaleDateString("en-PK")
  } catch {
    return iso
  }
}

function statusBadgeClass(status: string) {
  switch (status) {
    case "in_stock":
      return "bg-emerald-500/15 text-emerald-700 border-emerald-500/25 dark:text-emerald-400"
    case "reserved":
      return "bg-amber-500/15 text-amber-800 border-amber-500/25 dark:text-amber-400"
    case "dispatched":
      return "bg-sky-500/15 text-sky-800 border-sky-500/25 dark:text-sky-400"
    default:
      return "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] border-transparent"
  }
}

function InventoryModelGroup({
  modelKey,
  modelUnits,
  expanded,
  onToggle,
  customName,
  isEditing,
  editingName,
  savingModelLabel,
  deletingId,
  onEditingNameChange,
  onStartEdit,
  onSaveName,
  onCancelEdit,
  onDeleteUnit,
}: {
  modelKey: string
  modelUnits: InventorySerialUnit[]
  expanded: boolean
  onToggle: () => void
  customName: string
  isEditing: boolean
  editingName: string
  savingModelLabel: boolean
  deletingId: string | null
  onEditingNameChange: (value: string) => void
  onStartEdit: (e: MouseEvent) => void
  onSaveName: () => void
  onCancelEdit: () => void
  onDeleteUnit: (unit: InventorySerialUnit) => void
}) {
  const count = modelUnits.length
  const inStock = modelUnits.filter((u) => u.status === "in_stock").length

  return (
    <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-sm overflow-hidden">
      <div className="flex items-stretch border-b border-[hsl(var(--border))]/80">
        <button
          type="button"
          className="flex-1 min-w-0 flex items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-[hsl(var(--muted))]/25"
          onClick={onToggle}
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#1faca6]/12 text-[#1faca6]">
            <Package className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            {isEditing ? (
              <div className="flex flex-wrap items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <input
                  value={editingName}
                  onChange={(e) => onEditingNameChange(e.target.value)}
                  placeholder="e.g. 12 KWH Battery"
                  autoFocus
                  className="h-8 min-w-[160px] flex-1 max-w-md rounded-lg border bg-[hsl(var(--background))] px-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#1faca6]/40"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") onSaveName()
                    if (e.key === "Escape") onCancelEdit()
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  className="h-8 gap-1 bg-[#1faca6] hover:bg-[#17857f] text-white text-xs"
                  disabled={savingModelLabel}
                  onClick={onSaveName}
                >
                  {savingModelLabel ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      Save
                    </>
                  )}
                </Button>
                <Button type="button" size="sm" variant="ghost" className="h-8 text-xs" onClick={onCancelEdit}>
                  Cancel
                </Button>
              </div>
            ) : (
              <div className="flex items-start gap-1.5 min-w-0">
                <p className="text-base font-semibold text-[hsl(var(--foreground))] leading-snug break-words">
                  {customName || modelKey}
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 shrink-0 text-[hsl(var(--muted-foreground))] hover:text-[#1faca6]"
                  onClick={onStartEdit}
                  title="Edit display name"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
            <p className="text-[11px] text-[hsl(var(--muted-foreground))] flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span className="font-medium uppercase tracking-wider text-[10px] opacity-80">Model</span>
              <code className="font-mono text-xs text-[hsl(var(--foreground))]/90 break-all">{modelKey}</code>
              {customName ? (
                <>
                  <span className="opacity-40">·</span>
                  <span className="text-[10px] tabular-nums">
                    {inStock}/{count} in stock
                  </span>
                </>
              ) : null}
            </p>
            {!customName && !isEditing ? (
              <button type="button" className="text-[11px] text-[#1faca6] hover:underline" onClick={onStartEdit}>
                Add a friendly name
              </button>
            ) : null}
          </div>
        </button>
        <div className="flex flex-col items-end justify-center gap-1.5 px-3 py-3 border-l border-[hsl(var(--border))]/60 bg-[hsl(var(--muted))]/15 shrink-0">
          <span className="inline-flex rounded-full bg-[#1faca6] px-2.5 py-0.5 text-[11px] font-semibold text-white tabular-nums">
            {count} {count === 1 ? "pc" : "pcs"}
          </span>
          <button
            type="button"
            className="p-1.5 rounded-md text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]/60 hover:text-[hsl(var(--foreground))]"
            onClick={onToggle}
            aria-expanded={expanded}
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[hsl(var(--muted))]/25 border-b border-[hsl(var(--border))]/60">
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                  Serial number
                </th>
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                  Item ref
                </th>
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))] whitespace-nowrap">
                  Received
                </th>
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                  Status
                </th>
                <th className="px-4 py-2.5 w-14" />
              </tr>
            </thead>
            <tbody>
              {modelUnits.map((unit, idx) => (
                <tr
                  key={unit.id}
                  className={`border-b border-[hsl(var(--border))]/40 last:border-0 transition-colors hover:bg-[#1faca6]/[0.04] ${
                    idx % 2 === 1 ? "bg-[hsl(var(--muted))]/[0.12]" : ""
                  }`}
                >
                  <td className="px-4 py-3">
                    <span className="font-mono text-[13px] font-medium tracking-tight break-all">
                      {unit.serialNumber}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-[12px] text-[hsl(var(--muted-foreground))]">
                    {unit.specs || "—"}
                  </td>
                  <td className="px-4 py-3 text-[hsl(var(--muted-foreground))] whitespace-nowrap tabular-nums">
                    {formatDate(unit.scannedAt)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize ${statusBadgeClass(unit.status)}`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          unit.status === "in_stock"
                            ? "bg-emerald-500"
                            : unit.status === "reserved"
                              ? "bg-amber-500"
                              : "bg-[hsl(var(--muted-foreground))]"
                        }`}
                      />
                      {unit.status.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-[hsl(var(--muted-foreground))] hover:text-red-600 hover:bg-red-500/10"
                      disabled={deletingId === unit.id}
                      onClick={() => onDeleteUnit(unit)}
                      title="Remove from inventory"
                    >
                      {deletingId === unit.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export function InventorySerialView() {
  const { toast } = useToast()
  const [units, setUnits] = useState<InventorySerialUnit[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [exportingExcel, setExportingExcel] = useState(false)
  const [showQrModal, setShowQrModal] = useState(false)
  const [expandedModels, setExpandedModels] = useState<Record<string, boolean>>({})
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [modelLabels, setModelLabels] = useState<Record<string, string>>({})
  const [editingModel, setEditingModel] = useState<string | null>(null)
  const [editingName, setEditingName] = useState("")
  const [savingModelLabel, setSavingModelLabel] = useState(false)

  const loadUnits = useCallback(async () => {
    setLoading(true)
    try {
      const [rows, labels] = await Promise.all([
        getInventorySerialUnits(),
        getInventoryModelLabels().catch(() => []),
      ])
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
      setModelLabels(map)
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

  const groupedByModel = useMemo(() => {
    const map = new Map<string, InventorySerialUnit[]>()
    for (const unit of filteredUnits) {
      const key = unit.model?.trim() || "Unknown model"
      const list = map.get(key) ?? []
      list.push(unit)
      map.set(key, list)
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [filteredUnits])

  const totalBoxes = filteredUnits.length
  const inStockCount = filteredUnits.filter((u) => u.status === "in_stock").length

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
    void loadUnits()
    setShowQrModal(false)
  }

  async function handleDeleteUnit(unit: InventorySerialUnit) {
    const label = unit.serialNumber || unit.model || "this unit"
    if (!confirm(`Remove SN ${label} from inventory? This cannot be undone.`)) return

    setDeletingId(unit.id)
    try {
      await deleteInventorySerialUnit(unit.id)
      setUnits((prev) => prev.filter((u) => u.id !== unit.id))
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

  if (loading && units.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-[hsl(var(--muted-foreground))]">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Loading inventory…
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3 -mx-6 px-6">
        <div className="flex flex-wrap items-center gap-3 text-xs text-[hsl(var(--muted-foreground))]">
          <span>
            <strong className="text-[hsl(var(--foreground))]">{totalBoxes}</strong> box
            {totalBoxes !== 1 ? "es" : ""}
          </span>
          <span>·</span>
          <span>
            <strong className="text-[hsl(var(--foreground))]">{groupedByModel.length}</strong> model
            {groupedByModel.length !== 1 ? "s" : ""}
          </span>
          <span>·</span>
          <span>
            <strong className="text-[hsl(var(--foreground))]">{inStockCount}</strong> in stock
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-56">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search model, SN…"
              className="w-full h-8 rounded-md border bg-[hsl(var(--background))] pl-9 pr-3 text-xs focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
            />
          </div>
          <CrmExcelExportButton
            onExport={exportExcel}
            exporting={exportingExcel}
            disabled={filteredUnits.length === 0}
          />
          <Button
            size="sm"
            className="h-8 text-xs bg-[#1faca6] hover:bg-[#17857f] text-white gap-1.5"
            onClick={() => setShowQrModal(true)}
          >
            <QrCode className="h-3.5 w-3.5" />
            Scan QR
          </Button>
        </div>
      </div>

      {totalBoxes === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center text-[hsl(var(--muted-foreground))] border border-dashed rounded-lg">
          <Package className="h-10 w-10 opacity-30 mb-3" />
          <p className="text-sm font-medium text-[hsl(var(--foreground))]">No inventory yet</p>
          <p className="text-xs mt-1 max-w-sm">Tap Scan QR to receive boxes into the warehouse.</p>
          <Button
            size="sm"
            className="mt-4 h-8 text-xs bg-[#1faca6] hover:bg-[#17857f] text-white"
            onClick={() => setShowQrModal(true)}
          >
            <QrCode className="h-3.5 w-3.5 mr-1.5" />
            Scan QR
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {groupedByModel.map(([modelKey, modelUnits]) => (
            <InventoryModelGroup
              key={modelKey}
              modelKey={modelKey}
              modelUnits={modelUnits}
              expanded={expandedModels[modelKey] !== false}
              onToggle={() => setExpandedModels((prev) => ({ ...prev, [modelKey]: !(prev[modelKey] !== false) }))}
              customName={getDisplayName(modelKey)}
              isEditing={editingModel === modelKey}
              editingName={editingName}
              savingModelLabel={savingModelLabel}
              deletingId={deletingId}
              onEditingNameChange={setEditingName}
              onStartEdit={(e) => startEditModelName(modelKey, e)}
              onSaveName={() => void saveModelName(modelKey)}
              onCancelEdit={() => setEditingModel(null)}
              onDeleteUnit={(unit) => void handleDeleteUnit(unit)}
            />
          ))}
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
