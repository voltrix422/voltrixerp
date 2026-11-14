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
import { branchProductKey } from "@/lib/branch-product-trail"
import { BulkBranchTransferModal, type BulkTransferProduct } from "@/components/branches/bulk-branch-transfer-modal"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowRightLeft,
  ArrowUpRight,
  Eraser,
  FileDown,
  Loader2,
  Package,
  Pencil,
  Trash2,
  Undo2,
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
          const key = branchProductKey(model, item.description)
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

  const subtitleBits = [
    branch.code,
    branch.status === "active" ? null : branch.status,
    branchTypeLabel(branch.type).replace(/ warehouse$/i, ""),
  ].filter(Boolean)

  const contactLine = [branch.manager, branch.phone].filter(Boolean).join(" · ")
  const addressLine = [branch.address, branch.city].filter(Boolean).join(", ")

  return (
    <div className="flex min-h-[calc(100dvh-5rem)] w-full flex-col bg-[#f5f5f7] dark:bg-[hsl(var(--background))]">
      <div className="sticky top-0 z-20 border-b border-black/[0.06] bg-[#f5f5f7]/90 backdrop-blur-xl dark:border-white/10 dark:bg-[hsl(var(--background))]/90">
        <div className="mx-auto flex max-w-[1100px] items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black/[0.06] text-[#1d1d1f] hover:bg-black/[0.1] cursor-pointer dark:bg-white/10 dark:text-white"
              aria-label="Back"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px] bg-[#1a9f9a] text-[17px] font-semibold text-white shadow-sm">
              {branch.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-[17px] font-semibold tracking-tight text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">
                {branch.name}
              </h1>
              <p className="truncate text-[12px] text-[#86868b]">
                {subtitleBits.join(" · ")}
                {branch.status === "active" ? (
                  <span className="ml-1.5 inline-block h-1.5 w-1.5 translate-y-[-1px] rounded-full bg-[#34c759]" />
                ) : null}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              onClick={onEdit}
              className="flex h-8 w-8 items-center justify-center rounded-full text-[#1d1d1f]/70 hover:bg-black/[0.06] cursor-pointer dark:text-white/70 dark:hover:bg-white/10"
              title="Edit"
              aria-label="Edit"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              disabled={inventory.length === 0}
              onClick={() => generateSingleBranchPdf(branch, inventory)}
              className="flex h-8 w-8 items-center justify-center rounded-full text-[#1d1d1f]/70 hover:bg-black/[0.06] disabled:opacity-30 cursor-pointer dark:text-white/70 dark:hover:bg-white/10"
              title="PDF"
              aria-label="Inventory PDF"
            >
              <Package className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              disabled={groupedTransferHistory.length === 0}
              onClick={() => downloadBranchTransferHistoryPDF(branch, groupedTransferHistory)}
              className="flex h-8 w-8 items-center justify-center rounded-full text-[#1d1d1f]/70 hover:bg-black/[0.06] disabled:opacity-30 cursor-pointer dark:text-white/70 dark:hover:bg-white/10"
              title="Transfer PDF"
              aria-label="Transfer history PDF"
            >
              <FileDown className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="flex h-8 w-8 items-center justify-center rounded-full text-[#ff3b30]/80 hover:bg-[#ff3b30]/10 cursor-pointer"
              title="Delete"
              aria-label="Delete branch"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        {(contactLine || addressLine) && (
          <div className="mx-auto max-w-[1100px] px-4 pb-3 sm:px-6 sm:pl-[4.75rem]">
            {contactLine ? (
              <p className="truncate text-[12px] text-[#86868b]">{contactLine}</p>
            ) : null}
            {addressLine ? (
              <p className="truncate text-[11px] text-[#aeaeb2]">{addressLine}</p>
            ) : null}
          </div>
        )}
      </div>

      <div className="mx-auto w-full max-w-[1100px] flex-1 px-4 py-4 sm:px-6">
        {branch.notes ? (
          <p className="mb-3 text-[12px] text-[#86868b]">{branch.notes}</p>
        ) : null}

        {!isMainWarehouse && (
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <select
              className="h-8 min-w-[10rem] max-w-full flex-1 rounded-full border-0 bg-white px-3 text-[12px] text-[#1d1d1f] shadow-sm ring-1 ring-black/[0.06] dark:bg-[hsl(var(--card))] dark:text-[hsl(var(--foreground))] dark:ring-white/10"
              value={productFilter}
              onChange={(e) => setProductFilter(e.target.value)}
              aria-label="Product filter"
            >
              <option value="">All</option>
              {productOptions.map((opt) => (
                <option key={opt.key} value={opt.key}>
                  {opt.label}
                </option>
              ))}
            </select>
            {activeTab === "history" && (
              <select
                className="h-8 w-[6.5rem] rounded-full border-0 bg-white px-3 text-[12px] shadow-sm ring-1 ring-black/[0.06] dark:bg-[hsl(var(--card))] dark:ring-white/10"
                value={directionFilter}
                onChange={(e) => setDirectionFilter(e.target.value as "all" | "in" | "out")}
                aria-label="Direction filter"
              >
                <option value="all">In + Out</option>
                <option value="in">In</option>
                <option value="out">Out</option>
              </select>
            )}
            {(productFilter || directionFilter !== "all") && (
              <button
                type="button"
                className="h-8 px-2 text-[12px] text-[#007aff] cursor-pointer"
                onClick={() => {
                  setProductFilter("")
                  setDirectionFilter("all")
                }}
              >
                Clear
              </button>
            )}
            {productTrail ? (
              <p className="w-full text-[11px] tabular-nums text-[#86868b]">
                <span className="font-medium text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">{productTrail.onHand}</span> on hand
                <span className="mx-1.5 text-[#d2d2d7]">·</span>
                <span className="text-[#34c759]">{productTrail.transferIn}</span> in
                <span className="mx-1.5 text-[#d2d2d7]">·</span>
                <span className="text-[#ff9500]">{productTrail.transferOut}</span> out
                <span className="mx-1.5 text-[#d2d2d7]">·</span>
                <span className="text-[#007aff]">{productTrail.posSold}</span> POS
              </p>
            ) : activeTab === "history" ? (
              <p className="w-full text-[11px] tabular-nums text-[#86868b]">
                <span className="text-[#34c759]">{transferTotals.inQty}</span> in
                <span className="mx-1.5 text-[#d2d2d7]">·</span>
                <span className="text-[#ff9500]">{transferTotals.outQty}</span> out
                <span className="mx-1.5 text-[#d2d2d7]">·</span>
                {transferTotals.moves} moves
              </p>
            ) : null}
          </div>
        )}

        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="inline-flex rounded-full bg-black/[0.06] p-0.5 dark:bg-white/10">
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
                className={`rounded-full px-3.5 py-1.5 text-[12px] font-medium cursor-pointer transition-colors ${
                  activeTab === tab
                    ? "bg-white text-[#1d1d1f] shadow-sm dark:bg-[hsl(var(--card))] dark:text-[hsl(var(--foreground))]"
                    : "text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-white"
                }`}
              >
                {tab === "inventory"
                  ? "Stock"
                  : tab === "history"
                    ? `History${groupedTransferHistory.length > 0 ? ` ${groupedTransferHistory.length}` : ""}`
                    : "POS"}
              </button>
            ))}
          </div>

          {activeTab === "inventory" && !isMainWarehouse && inventory.length > 0 && (
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => openBulkTransfer("transfer")}
                className="flex h-8 w-8 items-center justify-center rounded-full text-[#1d1d1f]/70 hover:bg-black/[0.06] cursor-pointer dark:text-white/70"
                title="Transfer"
                aria-label="Transfer"
              >
                <ArrowRightLeft className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                disabled={returningToMain}
                onClick={handleReturnInventoryToMain}
                className="flex h-8 w-8 items-center justify-center rounded-full text-[#ff9500] hover:bg-[#ff9500]/10 disabled:opacity-40 cursor-pointer"
                title="Return to main"
                aria-label="Return to main"
              >
                {returningToMain ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Undo2 className="h-3.5 w-3.5" />}
              </button>
              <button
                type="button"
                disabled={removingAll}
                onClick={handleRemoveAllBranchInventory}
                className="flex h-8 w-8 items-center justify-center rounded-full text-[#ff3b30] hover:bg-[#ff3b30]/10 disabled:opacity-40 cursor-pointer"
                title="Delete all"
                aria-label="Delete all"
              >
                {removingAll ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              </button>
            </div>
          )}

          {activeTab === "history" && (
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                disabled={groupedTransferHistory.length === 0}
                onClick={() => downloadBranchTransferHistoryPDF(branch, groupedTransferHistory)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-[#1d1d1f]/70 hover:bg-black/[0.06] disabled:opacity-30 cursor-pointer dark:text-white/70"
                title="Download PDFs"
                aria-label="Download all transfer PDFs"
              >
                <FileDown className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                disabled={groupedTransferHistory.length === 0 || clearingHistory}
                onClick={handleClearTransferHistory}
                className="flex h-8 w-8 items-center justify-center rounded-full text-[#ff3b30] hover:bg-[#ff3b30]/10 disabled:opacity-30 cursor-pointer"
                title="Clear history"
                aria-label="Clear transfer history"
              >
                {clearingHistory ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eraser className="h-3.5 w-3.5" />}
              </button>
            </div>
          )}
        </div>

        {activeTab === "inventory" && isMainWarehouse && (
          <div className="mt-1">
            <InventorySerialView
              embedded
              onUnitsChanged={() => void reloadInventory()}
              toolbarEnd={
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 rounded-full text-xs cursor-pointer border-[#1a9f9a] text-[#1a9f9a] hover:bg-[#1a9f9a]/10"
                  onClick={() => openBulkTransfer("dispatch")}
                >
                  <ArrowRightLeft className="h-3 w-3 mr-1" />
                  Send
                </Button>
              }
            />
          </div>
        )}

        {activeTab === "inventory" && !isMainWarehouse && (
          <div className="overflow-hidden rounded-[16px] bg-white shadow-sm ring-1 ring-black/[0.04] dark:bg-[hsl(var(--card))] dark:ring-white/10">
            {loadingInventory ? (
              <div className="flex justify-center py-14">
                <Loader2 className="h-5 w-5 animate-spin text-[#aeaeb2]" />
              </div>
            ) : filteredInventory.length === 0 ? (
              <p className="py-14 text-center text-[13px] text-[#86868b]">
                {productFilter ? "Nothing for this product" : "No stock yet"}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-black/[0.06] text-left text-[11px] text-[#86868b] dark:border-white/10">
                      <th className="px-4 py-2.5 font-medium">Item</th>
                      <th className="px-4 py-2.5 font-medium text-right">Qty</th>
                      <th className="hidden px-4 py-2.5 font-medium sm:table-cell">Added</th>
                      <th className="px-4 py-2.5 font-medium text-right w-16" />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInventory.map((inv) => (
                        <tr key={inv.id} className="border-b border-black/[0.04] last:border-0 hover:bg-black/[0.02] dark:border-white/[0.06] dark:hover:bg-white/[0.03]">
                          <td className="px-4 py-3 max-w-[280px]">
                            <p className="truncate font-medium tracking-tight text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">
                              {inv.itemName || inv.productDescription || inv.model || "—"}
                            </p>
                            {inv.model && (inv.itemName || inv.productDescription) ? (
                              <p className="truncate text-[11px] text-[#aeaeb2]">{inv.model}</p>
                            ) : null}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums font-semibold text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">
                            {inv.quantity}
                            <span className="ml-1 text-[11px] font-normal text-[#aeaeb2]">{inv.unit || "pcs"}</span>
                          </td>
                          <td className="hidden px-4 py-3 text-[12px] text-[#86868b] sm:table-cell">
                            {inv.assignedAt ? new Date(inv.assignedAt).toLocaleDateString() : "—"}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-0.5">
                              {inv.quantity > 0 && (
                                <button
                                  type="button"
                                  className="flex h-7 w-7 items-center justify-center rounded-full text-[#86868b] hover:bg-black/[0.06] hover:text-[#1d1d1f] cursor-pointer"
                                  title="Transfer"
                                  aria-label="Transfer"
                                  onClick={() => openBulkTransfer("transfer", inv.id)}
                                >
                                  <ArrowRightLeft className="h-3.5 w-3.5" />
                                </button>
                              )}
                              <button
                                type="button"
                                className="flex h-7 w-7 items-center justify-center rounded-full text-[#ff3b30]/70 hover:bg-[#ff3b30]/10 cursor-pointer disabled:opacity-40"
                                title="Delete"
                                aria-label="Delete"
                                disabled={deletingInvId === inv.id}
                                onClick={() => handleRemoveInventoryItem(inv)}
                              >
                                {deletingInvId === inv.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Trash2 className="h-3.5 w-3.5" />
                                )}
                              </button>
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
          <div className="overflow-hidden rounded-[16px] bg-white shadow-sm ring-1 ring-black/[0.04] dark:bg-[hsl(var(--card))] dark:ring-white/10">
            {loadingTransferHistory ? (
              <div className="flex justify-center py-14">
                <Loader2 className="h-5 w-5 animate-spin text-[#aeaeb2]" />
              </div>
            ) : groupedTransferHistory.length === 0 ? (
              <p className="py-14 text-center text-[13px] text-[#86868b]">No transfers yet</p>
            ) : filteredTransferRows.length === 0 ? (
              <p className="py-14 text-center text-[13px] text-[#86868b]">No matches</p>
            ) : (
              <div className="overflow-x-auto max-h-[min(70vh,560px)] overflow-y-auto">
                <table className="w-full text-[13px]">
                  <thead className="sticky top-0 z-10 bg-white dark:bg-[hsl(var(--card))]">
                    <tr className="border-b border-black/[0.06] text-left text-[11px] text-[#86868b] dark:border-white/10">
                      <th className="px-4 py-2.5 w-8" />
                      <th className="px-4 py-2.5 font-medium">Item</th>
                      <th className="px-4 py-2.5 font-medium">Route</th>
                      <th className="px-4 py-2.5 font-medium text-right">Qty</th>
                      <th className="px-4 py-2.5 font-medium">Date</th>
                      <th className="hidden px-4 py-2.5 font-medium sm:table-cell">By</th>
                      <th className="px-4 py-2.5 w-12" />
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
                              className="h-6 w-6 p-0 cursor-pointer text-[#1faca6] border-[#1faca6]"
                              disabled={downloadingTransferPdfId === entry.id}
                              title="Download PDF for this transfer only"
                              aria-label="Download PDF"
                              onClick={() => void handleDownloadTransferPdf(entry)}
                            >
                              {downloadingTransferPdfId === entry.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <FileDown className="h-3 w-3" />
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
