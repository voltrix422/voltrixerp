"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  getBranchInventory,
  getBranchTransferHistory,
  batchBranchInventoryTransfer,
  clearBranchTransferHistory,
  resetBranchInventory,
  removeBranchInventory,
  type Branch,
  type BranchInventory,
  type BranchInventoryTransfer,
} from "@/lib/branches"
import { downloadBranchTransferHistoryPDF } from "@/lib/generate-branch-transfer-history-pdf"
import {
  groupTransferHistoryForDisplay,
  type TransferHistoryDisplayEntry,
} from "@/lib/branch-transfer-history-display"
import {
  collectBranchProductOptions,
  inventoryMatchesProduct,
  inventoryOnHandForProduct,
  transferEntryProductQty,
  transferEntryTouchesProduct,
  transferLineMatchesProduct,
} from "@/lib/branch-product-trail"
import { getOrders, resolveOrderItemModel } from "@/lib/orders"
import { productCanonicalKeyFromText } from "@/lib/order-product-search"
import { BulkBranchTransferModal, type BulkTransferProduct } from "@/components/branches/bulk-branch-transfer-modal"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowRightLeft,
  ArrowUpRight,
  FileDown,
  Loader2,
  Pencil,
  Trash2,
} from "lucide-react"
import { useDialog } from "@/components/ui/dialog-provider"
import { useToast } from "@/components/ui/toast"
import { useAuth } from "@/components/auth-provider"
import { isErpAdmin } from "@/lib/auth"
import { deleteInventorySerialUnitsByModel } from "@/lib/inventory-serial-units"
import { InventorySerialView } from "@/components/inventory/inventory-serial-view"
import { BranchPosSoldTab } from "@/components/branches/branch-pos-sold-tab"

async function generateSingleBranchPdf(branch: Branch, inventoryRows: BranchInventory[]) {
  const [{ default: jsPDF }, autoTableModule] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ])
  const autoTable = (autoTableModule as any).default || autoTableModule
  const doc = new jsPDF("p", "mm", "a4")
  doc.setFontSize(14)
  doc.text(`Inventory Report: ${branch.name}`, 14, 16)
  doc.setFontSize(10)
  doc.text(`Branch Code: ${branch.code}`, 14, 22)
  doc.text(`Type: ${branch.type.replace("_", " ")}`, 14, 27)
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 32)
  const body = inventoryRows.map((inv) => [
    inv.productDescription || inv.itemName || inv.inventoryId || "N/A",
    String(inv.quantity),
    inv.unit || "",
    inv.assignedAt ? new Date(inv.assignedAt).toLocaleDateString() : "-",
  ])
  autoTable(doc, {
    startY: 38,
    head: [["Item Description", "Qty", "Unit", "Date"]],
    body,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [31, 172, 166] },
  })
  doc.save(`${branch.code}-inventory-${new Date().toISOString().slice(0, 10)}.pdf`)
}

function branchTypeLabel(type: Branch["type"]) {
  if (type === "main_warehouse") return "Main warehouse"
  if (type === "branch_warehouse") return "Branch warehouse"
  return type
}

type Props = {
  branch: Branch
  branches: Branch[]
  onBack: () => void
  onEdit: () => void
  onDelete: () => void
}

export function BranchDetailView({ branch, branches, onBack, onEdit, onDelete }: Props) {
  const [inventory, setInventory] = useState<BranchInventory[]>([])
  const [loadingInventory, setLoadingInventory] = useState(true)
  const [showBulkTransfer, setShowBulkTransfer] = useState(false)
  const [bulkTransferMode, setBulkTransferMode] = useState<"dispatch" | "transfer">("dispatch")
  const [bulkPreselectId, setBulkPreselectId] = useState<string | null>(null)
  const [bulkSubmitting, setBulkSubmitting] = useState(false)
  const [transferHistory, setTransferHistory] = useState<BranchInventoryTransfer[]>([])
  const [loadingTransferHistory, setLoadingTransferHistory] = useState(true)
  const [clearingHistory, setClearingHistory] = useState(false)
  const [downloadingTransferPdfId, setDownloadingTransferPdfId] = useState<string | null>(null)
  const [returningToMain, setReturningToMain] = useState(false)
  const [removingAll, setRemovingAll] = useState(false)
  const [deletingInvId, setDeletingInvId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<"inventory" | "history" | "pos">("inventory")
  const [productFilter, setProductFilter] = useState("")
  const [directionFilter, setDirectionFilter] = useState<"all" | "in" | "out">("all")
  const [posNetByKey, setPosNetByKey] = useState<Record<string, number>>({})
  const [posProductOptions, setPosProductOptions] = useState<Array<{ key: string; label: string }>>([])
  const { toast } = useToast()
  const { confirm } = useDialog()
  const { user } = useAuth()
  const isSuperAdmin = isErpAdmin(user?.role)
  const isMainWarehouse = branch.type === "main_warehouse"

  useEffect(() => {
    setProductFilter("")
    setDirectionFilter("all")
    setPosNetByKey({})
    setPosProductOptions([])
  }, [branch.id])

  useEffect(() => {
    setLoadingInventory(true)
    getBranchInventory(branch.id).then((data) => {
      setInventory(data)
      setLoadingInventory(false)
    })
    loadTransferHistory()
  }, [branch.id])

  const loadPosSummary = useCallback(async () => {
    if (isMainWarehouse) {
      setPosNetByKey({})
      setPosProductOptions([])
      return
    }
    try {
      const orders = await getOrders({ branchId: branch.id, source: "branch_pos" })
      const map: Record<string, number> = {}
      const labels = new Map<string, string>()
      for (const order of orders) {
        if (String(order.source || "").toLowerCase() !== "branch_pos") continue
        for (const item of order.items || []) {
          const qty = Number(item.qty) || 0
          const returnedQty = (order.returnLines || [])
            .filter((r) => r.orderItemId === item.id)
            .reduce((s, r) => s + (Number(r.qty) || 0), 0)
          const gross =
            order.returnMerchandiseApplied && returnedQty > 0 ? qty + returnedQty : qty
          const net = Math.max(0, gross - returnedQty)
          if (net <= 0 && returnedQty <= 0) continue
          const model = resolveOrderItemModel(item) || item.model || ""
          const key = productCanonicalKeyFromText(`${model} ${item.description}`)
          map[key] = (map[key] || 0) + net
          if (!labels.has(key)) labels.set(key, model || item.description || key)
        }
        for (const ret of order.returnLines || []) {
          if ((order.items || []).some((it) => it.id === ret.orderItemId)) continue
          // Fully removed returned lines already counted as sold then returned → net 0; skip
        }
      }
      setPosNetByKey(map)
      setPosProductOptions(
        [...labels.entries()].map(([key, label]) => ({ key, label })),
      )
    } catch {
      setPosNetByKey({})
      setPosProductOptions([])
    }
  }, [branch.id, isMainWarehouse])

  useEffect(() => {
    void loadPosSummary()
  }, [loadPosSummary])

  async function loadTransferHistory() {
    setLoadingTransferHistory(true)
    try {
      setTransferHistory(await getBranchTransferHistory(branch.id))
    } catch {
      setTransferHistory([])
    } finally {
      setLoadingTransferHistory(false)
    }
  }

  async function reloadInventory() {
    setInventory(await getBranchInventory(branch.id))
  }

  async function handleClearTransferHistory() {
    const ok = await confirm({
      type: "confirm",
      title: "Clear transfer history",
      message: `Remove all transfer history records for ${branch.name}? This cannot be undone.`,
      confirmLabel: "Clear history",
    })
    if (!ok) return
    setClearingHistory(true)
    try {
      await clearBranchTransferHistory(branch.id)
      await loadTransferHistory()
      toast({ type: "success", title: "History cleared", message: "Transfer history removed for this branch." })
    } catch {
      toast({ type: "error", title: "Failed", message: "Could not clear transfer history." })
    } finally {
      setClearingHistory(false)
    }
  }

  async function handleReturnInventoryToMain() {
    const ok = await confirm({
      type: "confirm",
      title: "Return all inventory to main",
      message: `Move all stock from ${branch.name} back to the main warehouse and clear transfer history?`,
      confirmLabel: "Return to main",
    })
    if (!ok) return
    setReturningToMain(true)
    try {
      await resetBranchInventory({ branchId: branch.id, returnToMain: true, clearHistory: true })
      await reloadInventory()
      await loadTransferHistory()
      toast({ type: "success", title: "Inventory returned", message: "Stock is back in the main warehouse." })
    } catch {
      toast({ type: "error", title: "Failed", message: "Could not return inventory to main." })
    } finally {
      setReturningToMain(false)
    }
  }

  async function handleRemoveAllBranchInventory() {
    const ok = await confirm({
      type: "confirm",
      title: "Delete all inventory",
      message: `Permanently delete every item from ${branch.name}? Stock will not return to the main warehouse.`,
      confirmLabel: "Delete all",
    })
    if (!ok) return
    setRemovingAll(true)
    try {
      await resetBranchInventory({ branchId: branch.id, returnToMain: false, clearHistory: false })
      await reloadInventory()
      toast({ type: "success", title: "Inventory deleted", message: "All items permanently removed from this branch." })
    } catch {
      toast({ type: "error", title: "Failed", message: "Could not remove branch inventory." })
    } finally {
      setRemovingAll(false)
    }
  }

  async function handleRemoveInventoryItem(inv: BranchInventory) {
    const label = inv.itemName || inv.productDescription || inv.model || inv.inventoryId
    const modelKey = inv.model || (inv.id.startsWith("wh:") ? inv.id.slice(3) : null)
    const ok = await confirm({
      type: "confirm",
      title: isMainWarehouse ? "Delete from inventory" : "Delete from branch",
      message: isMainWarehouse && modelKey
        ? `Delete all ${inv.totalUnits ?? inv.quantity} scanned unit(s) for "${label}"? This cannot be undone.`
        : `Permanently delete ${inv.quantity} ${inv.unit} of "${label}" from ${branch.name}? Stock will not return to the main warehouse.`,
      confirmLabel: "Delete",
    })
    if (!ok) return
    setDeletingInvId(inv.id)
    try {
      if (isMainWarehouse && modelKey) {
        const deleted = await deleteInventorySerialUnitsByModel(modelKey)
        await reloadInventory()
        toast({
          type: "success",
          title: "Deleted",
          message: `${deleted} unit(s) removed for ${label}.`,
        })
      } else {
        await removeBranchInventory(inv.id)
        await reloadInventory()
        toast({ type: "success", title: "Deleted", message: `${label} permanently removed.` })
      }
    } catch {
      toast({ type: "error", title: "Failed", message: "Could not delete this item." })
    } finally {
      setDeletingInvId(null)
    }
  }

  const bulkTransferProducts: BulkTransferProduct[] = isMainWarehouse
    ? inventory.map((item) => {
        const canSend = (item.inStock ?? item.quantity) > 0
        const stockId =
          item.inventoryId && !item.inventoryId.startsWith("wh:") ? item.inventoryId : undefined
        return {
          id: item.id,
          label: item.itemName || item.productDescription || item.model || "Item",
          sublabel: [item.model, item.isManual ? "Manual" : null].filter(Boolean).join(" · "),
          model: item.model,
          productName: item.itemName,
          maxQty: item.inStock ?? item.quantity,
          unit: item.unit || "pcs",
          inventoryId: stockId,
          selectable: canSend,
          unselectableReason: canSend ? undefined : "No units in stock",
        }
      })
    : inventory
        .filter((item) => item.quantity > 0)
        .map((item) => ({
          id: item.id,
          label: item.productDescription || item.inventoryId,
          sublabel: `${item.quantity} ${item.unit} available`,
          maxQty: item.quantity,
          unit: item.unit || "pcs",
          fromBranchInventoryId: item.id,
          selectable: true,
        }))

  function openBulkTransfer(mode: "dispatch" | "transfer", preselectId?: string) {
    setBulkTransferMode(mode)
    setBulkPreselectId(preselectId ?? null)
    setShowBulkTransfer(true)
  }

  async function handleBulkTransferSubmit(payload: {
    toBranchId: string
    lines: Array<{
      inventoryId?: string
      fromBranchInventoryId?: string
      quantity: number
      unit?: string
      userNote?: string
    }>
  }) {
    const destination = branches.find((b) => b.id === payload.toBranchId)
    setBulkSubmitting(true)
    try {
      const result = await batchBranchInventoryTransfer({
        mode: bulkTransferMode,
        toBranchId: payload.toBranchId,
        // Always set source branch id so outbound bulk transfers appear in that branch's history
        fromBranchId: branch.id,
        fromBranchName: branch.name,
        fromBranchCode: branch.code,
        destinationBranchCode: destination?.code,
        assignedBy: user?.name || "system",
        requesterRole: user?.role,
        systemNotes: isMainWarehouse ? `Dispatched from main warehouse ${branch.code}` : undefined,
        lines: payload.lines,
      })
      setShowBulkTransfer(false)
      setBulkPreselectId(null)

      if (result.pendingApproval) {
        toast({
          type: "success",
          title: "Submitted for approval",
          message: "A super admin must approve before stock moves and the transfer note is generated.",
        })
        return
      }

      await reloadInventory()
      await loadTransferHistory()
      if ((result.failed ?? 0) > 0) {
        toast({
          type: "error",
          title: "Partial transfer",
          message: `${result.succeeded} saved, ${result.failed} failed.`,
        })
      } else {
        toast({
          type: "success",
          title: bulkTransferMode === "dispatch" ? "Inventory sent" : "Transfer complete",
          message: `${result.succeeded} transfer(s) saved.`,
        })
      }
    } catch {
      toast({ type: "error", title: "Transfer failed", message: "Could not save transfers." })
    } finally {
      setBulkSubmitting(false)
    }
  }

  const groupedTransferHistory = useMemo(
    () => groupTransferHistoryForDisplay(transferHistory),
    [transferHistory],
  )

  function transferDirection(entry: TransferHistoryDisplayEntry): "in" | "out" | "other" {
    const isOutgoing =
      entry.fromBranchId === branch.id ||
      (!entry.fromBranchId &&
        (entry.fromBranchCode === branch.code || entry.fromBranchName === branch.name))
    if (isOutgoing) return "out"
    const isIncoming =
      entry.toBranchId === branch.id ||
      entry.toBranchCode === branch.code ||
      entry.toBranchName === branch.name
    if (isIncoming) return "in"
    return "other"
  }

  const productOptions = useMemo(
    () =>
      collectBranchProductOptions({
        inventory,
        transfers: groupedTransferHistory,
        posLabels: posProductOptions,
      }),
    [inventory, groupedTransferHistory, posProductOptions],
  )

  const filteredInventory = useMemo(() => {
    if (!productFilter) return inventory
    return inventory.filter((inv) => inventoryMatchesProduct(inv, productFilter))
  }, [inventory, productFilter])

  const filteredTransferRows = useMemo(() => {
    return groupedTransferHistory
      .map((entry) => {
        const dir = transferDirection(entry)
        const productQty = transferEntryProductQty(entry, productFilter)
        return { entry, dir, productQty }
      })
      .filter(({ entry, dir, productQty }) => {
        if (productFilter && !transferEntryTouchesProduct(entry, productFilter)) return false
        if (directionFilter === "in" && dir !== "in") return false
        if (directionFilter === "out" && dir !== "out") return false
        if (productFilter && productQty <= 0) return false
        return true
      })
  }, [groupedTransferHistory, productFilter, directionFilter, branch.id, branch.code, branch.name])

  /** In/out for selected product (or all), ignoring direction filter — used by summary cards. */
  const productTransferTotals = useMemo(() => {
    let inQty = 0
    let outQty = 0
    let moves = 0
    for (const entry of groupedTransferHistory) {
      const qty = transferEntryProductQty(entry, productFilter)
      if (productFilter && qty <= 0) continue
      const dir = transferDirection(entry)
      if (dir === "in") inQty += qty
      else if (dir === "out") outQty += qty
      else continue
      moves += 1
    }
    return { inQty, outQty, net: inQty - outQty, moves }
  }, [groupedTransferHistory, productFilter, branch.id, branch.code, branch.name])

  const transferTotals = useMemo(() => {
    let inQty = 0
    let outQty = 0
    for (const row of filteredTransferRows) {
      if (row.dir === "in") inQty += row.productQty
      if (row.dir === "out") outQty += row.productQty
    }
    return { inQty, outQty, net: inQty - outQty, moves: filteredTransferRows.length }
  }, [filteredTransferRows])

  const productTrail = useMemo(() => {
    if (!productFilter) return null
    const onHand = inventoryOnHandForProduct(inventory, productFilter)
    const posSold = posNetByKey[productFilter] || 0
    const label =
      productOptions.find((o) => o.key === productFilter)?.label || productFilter
    return {
      label,
      onHand,
      transferIn: productTransferTotals.inQty,
      transferOut: productTransferTotals.outQty,
      transferNet: productTransferTotals.net,
      posSold,
      expected: productTransferTotals.net - posSold,
    }
  }, [productFilter, inventory, posNetByKey, productOptions, productTransferTotals])

  async function handleDownloadTransferPdf(entry: TransferHistoryDisplayEntry) {
    setDownloadingTransferPdfId(entry.id)
    try {
      await downloadBranchTransferHistoryPDF(branch, groupedTransferHistory, { singleEntry: entry })
      toast({ type: "success", title: "PDF downloaded", message: "Transfer slip saved." })
    } catch {
      toast({ type: "error", title: "Failed", message: "Could not generate transfer PDF." })
    } finally {
      setDownloadingTransferPdfId(null)
    }
  }

  const detailBits: string[] = []
  if (branch.manager) detailBits.push(`Mgr: ${branch.manager}`)
  if (branch.phone) detailBits.push(branch.phone)
  if (branch.email) detailBits.push(branch.email)
  if (branch.address || branch.city) {
    detailBits.push([branch.address, branch.city, branch.country].filter(Boolean).join(", "))
  }

  return (
    <div className="flex min-h-[calc(100dvh-5rem)] w-full flex-col bg-[hsl(var(--background))]">
      <div className="sticky top-0 z-20 border-b bg-[hsl(var(--card))]/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-start justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Button variant="ghost" className="h-8 gap-1.5 px-2 text-xs font-medium cursor-pointer" onClick={onBack}>
              <ArrowLeft className="h-3.5 w-3.5" />
              Back
            </Button>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#1faca6] text-lg font-bold text-white">
              {branch.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg font-semibold truncate">{branch.name}</h1>
                <span className="text-xs text-[hsl(var(--muted-foreground))]">{branch.code}</span>
                <Badge variant={branch.status === "active" ? "success" : "secondary"} className="text-[10px] px-1.5 py-0">
                  {branch.status}
                </Badge>
                <Badge variant="info" className="text-[10px] px-1.5 py-0">
                  {branchTypeLabel(branch.type)}
                </Badge>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2 ml-auto">
            {detailBits.length > 0 && (
              <div className="hidden sm:block max-w-md text-right text-[11px] leading-snug text-[hsl(var(--muted-foreground))]">
                {detailBits.map((bit, i) => (
                  <span key={i}>
                    {i > 0 && <span className="mx-1.5 text-[hsl(var(--border))]">|</span>}
                    {bit}
                  </span>
                ))}
              </div>
            )}
            <div className="flex flex-wrap items-center justify-end gap-1">
              <Button size="sm" variant="outline" className="h-7 px-2 text-[11px] cursor-pointer" onClick={onEdit}>
                <Pencil className="h-3 w-3 mr-1" />
                Edit
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 text-[11px] cursor-pointer text-[#1faca6] border-[#1faca6]"
                disabled={inventory.length === 0}
                onClick={() => generateSingleBranchPdf(branch, inventory)}
              >
                <FileDown className="h-3 w-3 mr-1" />
                Inv. PDF
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 text-[11px] cursor-pointer text-[#1faca6] border-[#1faca6]"
                disabled={groupedTransferHistory.length === 0}
                onClick={() => downloadBranchTransferHistoryPDF(branch, groupedTransferHistory)}
              >
                <FileDown className="h-3 w-3 mr-1" />
                Xfer PDF
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 text-[11px] cursor-pointer text-red-600 border-red-300 hover:bg-red-50"
                onClick={onDelete}
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Delete
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-4 sm:px-6">
        {branch.notes && (
          <p className="mb-3 text-xs text-[hsl(var(--muted-foreground))] border-b pb-2">
            <span className="font-medium text-[hsl(var(--foreground))]">Notes: </span>
            {branch.notes}
          </p>
        )}

        {!isMainWarehouse && (
          <div className="mb-3 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <select
                className="h-7 min-w-[12rem] max-w-full flex-1 rounded border bg-transparent px-2 text-xs"
                value={productFilter}
                onChange={(e) => setProductFilter(e.target.value)}
                aria-label="Product filter"
              >
                <option value="">All products</option>
                {productOptions.map((opt) => (
                  <option key={opt.key} value={opt.key}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {activeTab === "history" && (
                <select
                  className="h-7 w-[7.5rem] rounded border bg-transparent px-2 text-xs"
                  value={directionFilter}
                  onChange={(e) => setDirectionFilter(e.target.value as "all" | "in" | "out")}
                  aria-label="Direction filter"
                >
                  <option value="all">In + Out</option>
                  <option value="in">In only</option>
                  <option value="out">Out only</option>
                </select>
              )}
              {(productFilter || directionFilter !== "all") && (
                <button
                  type="button"
                  className="h-7 px-1.5 text-[11px] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] cursor-pointer"
                  onClick={() => {
                    setProductFilter("")
                    setDirectionFilter("all")
                  }}
                >
                  Clear
                </button>
              )}
            </div>

            {productTrail ? (
              <p className="text-[11px] tabular-nums text-[hsl(var(--muted-foreground))] leading-relaxed">
                <span className="text-[hsl(var(--foreground))] font-medium">{productTrail.label}</span>
                <span className="mx-1.5 text-[hsl(var(--border))]">·</span>
                On hand <span className="text-[hsl(var(--foreground))] font-medium">{productTrail.onHand}</span>
                <span className="mx-1.5 text-[hsl(var(--border))]">·</span>
                In <span className="text-emerald-700 font-medium">{productTrail.transferIn}</span>
                <span className="mx-1.5 text-[hsl(var(--border))]">·</span>
                Out <span className="text-orange-700 font-medium">{productTrail.transferOut}</span>
                <span className="mx-1.5 text-[hsl(var(--border))]">·</span>
                Net <span className="text-[hsl(var(--foreground))] font-medium">{productTrail.transferNet}</span>
                <span className="mx-1.5 text-[hsl(var(--border))]">·</span>
                POS <span className="text-blue-700 font-medium">{productTrail.posSold}</span>
                <span className="mx-1.5 text-[hsl(var(--border))]">·</span>
                Check <span className="text-[hsl(var(--foreground))] font-medium">{productTrail.expected}</span>
                <span className="text-[hsl(var(--muted-foreground))]"> (vs {productTrail.onHand})</span>
              </p>
            ) : activeTab === "history" ? (
              <p className="text-[11px] tabular-nums text-[hsl(var(--muted-foreground))]">
                In <span className="text-emerald-700 font-medium">{transferTotals.inQty}</span>
                <span className="mx-1.5 text-[hsl(var(--border))]">·</span>
                Out <span className="text-orange-700 font-medium">{transferTotals.outQty}</span>
                <span className="mx-1.5 text-[hsl(var(--border))]">·</span>
                Net <span className="text-[hsl(var(--foreground))] font-medium">{transferTotals.net}</span>
                <span className="mx-1.5 text-[hsl(var(--border))]">·</span>
                {transferTotals.moves} moves
              </p>
            ) : null}
          </div>
        )}

        <div className="flex items-center justify-between gap-2 border-b">
          <div className="flex items-center gap-1">
            {(
              (isMainWarehouse
                ? (["inventory", "history"] as const)
                : (["inventory", "history", "pos"] as const)) as ReadonlyArray<
                "inventory" | "history" | "pos"
              >
            ).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`relative px-3 py-2 text-xs font-medium cursor-pointer ${
                  activeTab === tab
                    ? "text-[hsl(var(--foreground))]"
                    : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                }`}
              >
                {tab === "inventory"
                  ? "Inventory"
                  : tab === "history"
                    ? "Transfer history"
                    : "POS sold"}
                {tab === "history" && groupedTransferHistory.length > 0 && (
                  <span className="ml-1 text-[10px] text-[hsl(var(--muted-foreground))]">
                    (
                    {productFilter || directionFilter !== "all"
                      ? `${filteredTransferRows.length}/${groupedTransferHistory.length}`
                      : groupedTransferHistory.length}
                    )
                  </span>
                )}
                {activeTab === tab && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1faca6]" />}
              </button>
            ))}
          </div>

          {activeTab === "inventory" && !isMainWarehouse && (
            <div className="flex flex-wrap gap-1.5 pb-1">
              {inventory.length > 0 ? (
                <>
                  <Button size="sm" variant="outline" className="h-7 text-xs cursor-pointer" onClick={() => openBulkTransfer("transfer")}>
                    Transfer
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs cursor-pointer text-orange-700"
                    disabled={returningToMain}
                    onClick={handleReturnInventoryToMain}
                  >
                    {returningToMain ? <Loader2 className="h-3 w-3 animate-spin" /> : "Return to main"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs cursor-pointer text-red-600"
                    disabled={removingAll}
                    onClick={handleRemoveAllBranchInventory}
                  >
                    {removingAll ? <Loader2 className="h-3 w-3 animate-spin" /> : "Delete all"}
                  </Button>
                </>
              ) : null}
            </div>
          )}

          {activeTab === "history" && (
            <div className="flex flex-wrap gap-1.5 pb-1">
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs cursor-pointer"
                disabled={groupedTransferHistory.length === 0}
                onClick={() => downloadBranchTransferHistoryPDF(branch, groupedTransferHistory)}
              >
                <FileDown className="h-3 w-3 mr-1" />
                All PDF
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs cursor-pointer text-red-600"
                disabled={groupedTransferHistory.length === 0 || clearingHistory}
                onClick={handleClearTransferHistory}
              >
                {clearingHistory ? <Loader2 className="h-3 w-3 animate-spin" /> : "Clear"}
              </Button>
            </div>
          )}
        </div>

        {activeTab === "inventory" && isMainWarehouse && (
          <div className="mt-3">
            <InventorySerialView
              embedded
              onUnitsChanged={() => void reloadInventory()}
              toolbarEnd={
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs cursor-pointer border-[#1faca6] text-[#1faca6] hover:bg-[#1faca6]/10"
                  onClick={() => openBulkTransfer("dispatch")}
                >
                  <ArrowRightLeft className="h-3 w-3 mr-1" />
                  Send multiple
                </Button>
              }
            />
          </div>
        )}

        {activeTab === "inventory" && !isMainWarehouse && (
          <div className="mt-3 rounded-lg border bg-[hsl(var(--card))] overflow-hidden">
            {loadingInventory ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--muted-foreground))]" />
              </div>
            ) : filteredInventory.length === 0 ? (
              <p className="py-8 text-center text-sm text-[hsl(var(--muted-foreground))]">
                {productFilter
                  ? "No on-hand stock for this product at this branch."
                  : "No inventory at this branch yet."}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-[hsl(var(--muted))]/30 text-left text-[10px] uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                      <th className="px-3 py-2 font-medium">Product</th>
                      <th className="px-3 py-2 font-medium">Model</th>
                      <th className="px-3 py-2 font-medium text-right">Qty</th>
                      <th className="px-3 py-2 font-medium">Unit</th>
                      <th className="px-3 py-2 font-medium">Added</th>
                      <th className="px-3 py-2 font-medium text-right w-[140px]">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInventory.map((inv) => (
                        <tr key={inv.id} className="border-b last:border-0 hover:bg-[hsl(var(--muted))]/10">
                          <td className="px-3 py-2 font-medium max-w-[200px] truncate">
                            {inv.itemName || inv.productDescription || "—"}
                          </td>
                          <td className="px-3 py-2 text-[hsl(var(--muted-foreground))] max-w-[120px] truncate">
                            {inv.model || "—"}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums font-medium">{inv.quantity}</td>
                          <td className="px-3 py-2">{inv.unit || "pcs"}</td>
                          <td className="px-3 py-2 text-[hsl(var(--muted-foreground))]">
                            {inv.assignedAt ? new Date(inv.assignedAt).toLocaleDateString() : "—"}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex justify-end gap-1">
                              {inv.quantity > 0 && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-6 px-2 text-[10px] cursor-pointer"
                                  onClick={() => openBulkTransfer("transfer", inv.id)}
                                >
                                  Transfer
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-6 px-2 text-[10px] cursor-pointer text-red-600 border-red-200 hover:bg-red-50"
                                disabled={deletingInvId === inv.id}
                                onClick={() => handleRemoveInventoryItem(inv)}
                              >
                                {deletingInvId === inv.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <>
                                    <Trash2 className="h-3 w-3 mr-0.5" />
                                    Delete
                                  </>
                                )}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === "history" && (
          <div className="mt-3 rounded-lg border bg-[hsl(var(--card))] overflow-hidden">
            {loadingTransferHistory ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : groupedTransferHistory.length === 0 ? (
              <p className="py-8 text-center text-sm text-[hsl(var(--muted-foreground))]">
                No inventory transfers recorded for this branch yet.
              </p>
            ) : filteredTransferRows.length === 0 ? (
              <p className="py-8 text-center text-sm text-[hsl(var(--muted-foreground))]">
                No transfers match the current product / direction filter.
              </p>
            ) : (
              <div className="overflow-x-auto max-h-[min(70vh,560px)] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 z-10 bg-[hsl(var(--card))]">
                    <tr className="border-b bg-[hsl(var(--muted))]/30 text-left text-[10px] uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                      <th className="px-3 py-2 w-8" />
                      <th className="px-3 py-2 font-medium">Product</th>
                      <th className="px-3 py-2 font-medium">Route</th>
                      <th className="px-3 py-2 font-medium text-right">Qty</th>
                      <th className="px-3 py-2 font-medium">Date</th>
                      <th className="px-3 py-2 font-medium">By</th>
                      <th className="px-3 py-2 font-medium text-right w-[72px]">PDF</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTransferRows.map(({ entry, dir, productQty }) => {
                      const route =
                        dir === "out"
                          ? `→ ${entry.toBranchName} (${entry.toBranchCode})`
                          : dir === "in"
                            ? `← ${entry.fromBranchName} (${entry.fromBranchCode})`
                            : `${entry.fromBranchCode} → ${entry.toBranchCode}`
                      const matchingLines =
                        productFilter && entry.lineItems.length > 0
                          ? entry.lineItems.filter((l) =>
                              transferLineMatchesProduct(l.productDescription, productFilter),
                            )
                          : entry.lineItems
                      const productCell = productFilter
                        ? matchingLines.length > 0
                          ? matchingLines
                              .map((l) => `${l.quantity} ${l.unit} × ${l.productDescription}`)
                              .join("; ")
                          : entry.productDescription
                        : entry.isBatch && entry.lineItems.length > 0
                          ? entry.lineItems
                              .map((l) => `${l.quantity} ${l.unit} × ${l.productDescription}`)
                              .join("; ")
                          : entry.productDescription
                      const displayQty = productFilter ? productQty : entry.quantity
                      const displayUnit =
                        productFilter && matchingLines.length === 1
                          ? matchingLines[0].unit
                          : entry.unit
                      return (
                        <tr key={entry.id} className="border-b last:border-0 hover:bg-[hsl(var(--muted))]/10 align-top">
                          <td className="px-3 py-2">
                            {dir === "out" ? (
                              <ArrowUpRight className="h-3.5 w-3.5 text-orange-500" />
                            ) : dir === "in" ? (
                              <ArrowDownLeft className="h-3.5 w-3.5 text-green-600" />
                            ) : (
                              <ArrowRightLeft className="h-3.5 w-3.5" />
                            )}
                          </td>
                          <td className="px-3 py-2 max-w-[240px]">
                            <span className="font-medium line-clamp-2">{productCell}</span>
                            {entry.isBatch && (
                              <Badge variant="info" className="mt-1 text-[9px] px-1 py-0">
                                Batch
                                {productFilter ? ` · ${displayQty} of this product` : ""}
                              </Badge>
                            )}
                          </td>
                          <td className="px-3 py-2 text-[hsl(var(--muted-foreground))] whitespace-nowrap">{route}</td>
                          <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                            {displayQty} {displayUnit}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-[hsl(var(--muted-foreground))]">
                            {new Date(entry.transferredAt).toLocaleString(undefined, {
                              dateStyle: "short",
                              timeStyle: "short",
                            })}
                          </td>
                          <td className="px-3 py-2 text-[hsl(var(--muted-foreground))] max-w-[100px] truncate">
                            {entry.transferredBy}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 px-2 text-[10px] cursor-pointer text-[#1faca6] border-[#1faca6]"
                              disabled={downloadingTransferPdfId === entry.id}
                              title="Download PDF for this transfer only"
                              onClick={() => void handleDownloadTransferPdf(entry)}
                            >
                              {downloadingTransferPdfId === entry.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <>
                                  <FileDown className="h-3 w-3 mr-0.5" />
                                  PDF
                                </>
                              )}
                            </Button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === "pos" && !isMainWarehouse && (
          <BranchPosSoldTab
            branchId={branch.id}
            branchName={branch.name}
            productFilter={productFilter}
            onProductFilterChange={setProductFilter}
            hideLocalProductFilter
          />
        )}
      </div>

      <BulkBranchTransferModal
        open={showBulkTransfer}
        onClose={() => {
          setShowBulkTransfer(false)
          setBulkPreselectId(null)
        }}
        title={bulkTransferMode === "dispatch" ? "Send multiple products to branch" : "Transfer multiple products"}
        mode={bulkTransferMode}
        products={bulkTransferProducts}
        branches={branches}
        currentBranchId={branch.id}
        preselectedProductId={bulkPreselectId}
        submitting={bulkSubmitting}
        destinationFilter={
          bulkTransferMode === "dispatch" ? (b) => b.type === "branch_warehouse" || b.type === "warehouse" : undefined
        }
        requiresApproval={!isSuperAdmin}
        onSubmit={handleBulkTransferSubmit}
      />
    </div>
  )
}
