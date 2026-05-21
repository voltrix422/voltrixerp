"use client"

import { useEffect, useMemo, useState } from "react"
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
import { groupTransferHistoryForDisplay } from "@/lib/branch-transfer-history-display"
import { BulkBranchTransferModal, type BulkTransferProduct } from "@/components/branches/bulk-branch-transfer-modal"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowRightLeft,
  ArrowUpRight,
  FileDown,
  History,
  Loader2,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Trash2,
  User,
} from "lucide-react"
import { useDialog } from "@/components/ui/dialog-provider"
import { useToast } from "@/components/ui/toast"
import { useAuth } from "@/components/auth-provider"

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
  const [returningToMain, setReturningToMain] = useState(false)
  const [removingAll, setRemovingAll] = useState(false)
  const [deletingInvId, setDeletingInvId] = useState<string | null>(null)
  const { toast } = useToast()
  const { confirm } = useDialog()
  const { user } = useAuth()
  const isMainWarehouse = branch.type === "main_warehouse"

  useEffect(() => {
    setLoadingInventory(true)
    getBranchInventory(branch.id).then((data) => {
      setInventory(data)
      setLoadingInventory(false)
    })
    loadTransferHistory()
  }, [branch.id])

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
      await resetBranchInventory({ branchId: branch.id, all: false })
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
      title: "Remove all inventory",
      message: `Remove every item from ${branch.name}? Quantities return to the main warehouse.`,
      confirmLabel: "Remove all",
    })
    if (!ok) return
    setRemovingAll(true)
    try {
      await resetBranchInventory({ branchId: branch.id, all: false })
      await reloadInventory()
      await loadTransferHistory()
      toast({ type: "success", title: "Inventory cleared", message: "All items removed from this branch." })
    } catch {
      toast({ type: "error", title: "Failed", message: "Could not remove branch inventory." })
    } finally {
      setRemovingAll(false)
    }
  }

  async function handleRemoveInventoryItem(inv: BranchInventory) {
    if (isMainWarehouse) {
      toast({
        type: "error",
        title: "Main warehouse",
        message: "Remove scanned units from Inventory → Scan QR. Branch records are built from serial scans.",
      })
      return
    }
    const label = inv.productDescription || inv.itemName || inv.inventoryId
    const ok = await confirm({
      type: "confirm",
      title: "Remove from branch",
      message: `Remove ${inv.quantity} ${inv.unit} of "${label}" from ${branch.name}? Stock returns to the main warehouse.`,
      confirmLabel: "Remove",
    })
    if (!ok) return
    setDeletingInvId(inv.id)
    try {
      await removeBranchInventory(inv.id)
      await reloadInventory()
      toast({ type: "success", title: "Removed", message: `${label} removed from this branch.` })
    } catch {
      toast({ type: "error", title: "Failed", message: "Could not remove this item." })
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
          sublabel: item.model || item.productDescription,
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
        fromBranchId: isMainWarehouse ? branch.id : undefined,
        fromBranchName: branch.name,
        fromBranchCode: branch.code,
        destinationBranchCode: destination?.code,
        assignedBy: user?.name || "system",
        systemNotes: isMainWarehouse ? `Dispatched from main warehouse ${branch.code}` : undefined,
        lines: payload.lines,
      })
      await reloadInventory()
      await loadTransferHistory()
      setShowBulkTransfer(false)
      setBulkPreselectId(null)
      if (result.failed > 0) {
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

  const mainWarehouseSummary = isMainWarehouse
    ? {
        models: inventory.length,
        boxes: inventory.reduce((sum, row) => sum + (row.totalUnits ?? row.quantity ?? 0), 0),
        inStock: inventory.reduce((sum, row) => sum + (row.inStock ?? row.quantity ?? 0), 0),
      }
    : null

  return (
    <div className="flex min-h-[calc(100dvh-5rem)] w-full flex-col bg-[hsl(var(--background))]">
      <div className="sticky top-0 z-20 border-b bg-[hsl(var(--card))]/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3 px-6 py-4">
          <Button variant="ghost" className="h-10 gap-2 text-sm font-medium cursor-pointer" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
            Back to branches
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" className="h-9 cursor-pointer" onClick={onEdit}>
              <Pencil className="h-3.5 w-3.5 mr-1.5" />
              Edit branch
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-9 cursor-pointer text-[#1faca6] border-[#1faca6]"
              disabled={inventory.length === 0}
              onClick={() => generateSingleBranchPdf(branch, inventory)}
            >
              <FileDown className="h-3.5 w-3.5 mr-1.5" />
              Inventory PDF
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-9 cursor-pointer text-[#1faca6] border-[#1faca6]"
              disabled={groupedTransferHistory.length === 0}
              onClick={() => downloadBranchTransferHistoryPDF(branch, groupedTransferHistory)}
            >
              <FileDown className="h-3.5 w-3.5 mr-1.5" />
              Transfer PDF
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-9 cursor-pointer text-red-600 border-red-300 hover:bg-red-50"
              onClick={onDelete}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              Delete branch
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1400px] flex-1 px-6 py-8 space-y-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
          <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl bg-[#1faca6] text-4xl font-bold text-white shadow-lg">
            {branch.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{branch.name}</h1>
              <p className="text-lg text-[hsl(var(--muted-foreground))] mt-1">{branch.code}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant={branch.status === "active" ? "success" : "secondary"} className="text-xs px-3 py-1">
                {branch.status}
              </Badge>
              <Badge variant="info" className="text-xs px-3 py-1">
                {branchTypeLabel(branch.type)}
              </Badge>
            </div>
            {mainWarehouseSummary && mainWarehouseSummary.models > 0 && (
              <p className="text-base text-[hsl(var(--muted-foreground))]">
                <strong className="text-[hsl(var(--foreground))]">{mainWarehouseSummary.boxes}</strong> units tracked
                {" · "}
                <strong className="text-[hsl(var(--foreground))]">{mainWarehouseSummary.models}</strong> models
                {" · "}
                <strong className="text-[hsl(var(--foreground))]">{mainWarehouseSummary.inStock}</strong> in stock
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 xl:grid-cols-12">
          <aside className="xl:col-span-4 space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
              Branch details
            </h2>
            {branch.manager && (
              <div className="flex items-center gap-4 rounded-xl border bg-[hsl(var(--card))] p-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[hsl(var(--muted))]/50">
                  <User className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs uppercase text-[hsl(var(--muted-foreground))]">Manager</p>
                  <p className="text-base font-semibold">{branch.manager}</p>
                </div>
              </div>
            )}
            {branch.phone && (
              <div className="flex items-center gap-4 rounded-xl border bg-[hsl(var(--card))] p-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[hsl(var(--muted))]/50">
                  <Phone className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs uppercase text-[hsl(var(--muted-foreground))]">Phone</p>
                  <p className="text-base font-semibold">{branch.phone}</p>
                </div>
              </div>
            )}
            {branch.email && (
              <div className="flex items-center gap-4 rounded-xl border bg-[hsl(var(--card))] p-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[hsl(var(--muted))]/50">
                  <Mail className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs uppercase text-[hsl(var(--muted-foreground))]">Email</p>
                  <p className="text-base font-semibold break-all">{branch.email}</p>
                </div>
              </div>
            )}
            {(branch.address || branch.city) && (
              <div className="flex items-start gap-4 rounded-xl border bg-[hsl(var(--card))] p-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--muted))]/50">
                  <MapPin className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs uppercase text-[hsl(var(--muted-foreground))]">Address</p>
                  <p className="text-base font-medium leading-relaxed">
                    {branch.address}
                    {branch.city && `, ${branch.city}`}
                    {branch.country && `, ${branch.country}`}
                  </p>
                </div>
              </div>
            )}
            {branch.notes && (
              <div className="rounded-xl border bg-[hsl(var(--card))] p-4">
                <p className="text-xs uppercase text-[hsl(var(--muted-foreground))] mb-2">Notes</p>
                <p className="text-sm leading-relaxed">{branch.notes}</p>
              </div>
            )}
          </aside>

          <div className="xl:col-span-8 space-y-8">
            <section className="rounded-2xl border bg-[hsl(var(--card))] p-6 shadow-sm">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold">
                    {isMainWarehouse ? "Main warehouse inventory" : "Branch inventory"}
                  </h2>
                  <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
                    {isMainWarehouse
                      ? "Stock available to send to branch warehouses"
                      : "Items currently held at this location"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {isMainWarehouse ? (
                    <Button className="h-10 cursor-pointer bg-[#1faca6] hover:bg-[#17857f]" onClick={() => openBulkTransfer("dispatch")}>
                      <ArrowRightLeft className="h-4 w-4 mr-2" />
                      Send multiple
                    </Button>
                  ) : inventory.length > 0 ? (
                    <>
                      <Button variant="outline" className="h-10 cursor-pointer" onClick={() => openBulkTransfer("transfer")}>
                        <ArrowRightLeft className="h-4 w-4 mr-2" />
                        Transfer
                      </Button>
                      <Button
                        variant="outline"
                        className="h-10 cursor-pointer text-orange-700 border-orange-300"
                        disabled={returningToMain}
                        onClick={handleReturnInventoryToMain}
                      >
                        {returningToMain ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRightLeft className="h-4 w-4 mr-2" />}
                        Return to main
                      </Button>
                      <Button
                        variant="outline"
                        className="h-10 cursor-pointer text-red-600 border-red-300 hover:bg-red-50"
                        disabled={removingAll}
                        onClick={handleRemoveAllBranchInventory}
                      >
                        {removingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
                        Remove all
                      </Button>
                    </>
                  ) : null}
                </div>
              </div>

              {loadingInventory ? (
                <div className="flex justify-center py-16">
                  <Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--muted-foreground))]" />
                </div>
              ) : inventory.length === 0 ? (
                <p className="py-12 text-center text-base text-[hsl(var(--muted-foreground))]">
                  {isMainWarehouse ? "No scanned inventory yet. Use Inventory → Scan QR." : "No inventory at this branch yet."}
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {inventory.map((inv) => (
                    <div key={inv.id} className="rounded-xl border bg-[hsl(var(--background))] p-4 hover:border-[#1faca6]/40 transition-colors">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-base font-semibold leading-snug truncate">
                            {inv.itemName || inv.productDescription || inv.inventoryId}
                          </p>
                          {inv.model && (
                            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1 truncate">{inv.model}</p>
                          )}
                          {isMainWarehouse && inv.totalUnits != null && (
                            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-2">
                              {inv.inStock ?? inv.quantity}/{inv.totalUnits} in stock
                            </p>
                          )}
                          {!isMainWarehouse && inv.assignedAt && (
                            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-2">
                              Added {new Date(inv.assignedAt).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                        <Badge variant="secondary" className="text-sm px-2.5 py-1 shrink-0">
                          {inv.quantity} {inv.unit}
                        </Badge>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {!isMainWarehouse && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 text-xs cursor-pointer"
                              onClick={() => openBulkTransfer("transfer", inv.id)}
                            >
                              <ArrowRightLeft className="h-3 w-3 mr-1" />
                              Transfer
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 text-xs cursor-pointer text-red-600 border-red-200 hover:bg-red-50"
                              disabled={deletingInvId === inv.id}
                              onClick={() => handleRemoveInventoryItem(inv)}
                            >
                              {deletingInvId === inv.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Trash2 className="h-3 w-3 mr-1" />
                              )}
                              Remove
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-2xl border bg-[hsl(var(--card))] p-6 shadow-sm">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <History className="h-5 w-5 text-[#1faca6]" />
                  <div>
                    <h2 className="text-xl font-bold">Transfer history</h2>
                    <p className="text-sm text-[hsl(var(--muted-foreground))]">
                      {groupedTransferHistory.length} record{groupedTransferHistory.length === 1 ? "" : "s"}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-10 cursor-pointer"
                    disabled={groupedTransferHistory.length === 0}
                    onClick={() => downloadBranchTransferHistoryPDF(branch, groupedTransferHistory)}
                  >
                    <FileDown className="h-4 w-4 mr-2" />
                    Download PDF
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-10 cursor-pointer text-red-600 border-red-300"
                    disabled={groupedTransferHistory.length === 0 || clearingHistory}
                    onClick={handleClearTransferHistory}
                  >
                    {clearingHistory ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
                    Clear history
                  </Button>
                </div>
              </div>

              {loadingTransferHistory ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : groupedTransferHistory.length === 0 ? (
                <p className="py-10 text-center text-base text-[hsl(var(--muted-foreground))]">
                  No inventory transfers recorded for this branch yet.
                </p>
              ) : (
                <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
                  {groupedTransferHistory.map((entry) => {
                    const isOutgoing = entry.fromBranchId === branch.id
                    const isIncoming = entry.toBranchId === branch.id
                    return (
                      <div key={entry.id} className="rounded-xl border bg-[hsl(var(--background))] p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              {isOutgoing ? (
                                <ArrowUpRight className="h-4 w-4 text-orange-500 shrink-0" />
                              ) : isIncoming ? (
                                <ArrowDownLeft className="h-4 w-4 text-green-600 shrink-0" />
                              ) : (
                                <ArrowRightLeft className="h-4 w-4 shrink-0" />
                              )}
                              <p className="text-base font-semibold">{entry.productDescription}</p>
                              {entry.isBatch && <Badge variant="info" className="text-[10px]">Batch</Badge>}
                            </div>
                            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-2">
                              {isOutgoing
                                ? `To ${entry.toBranchName} (${entry.toBranchCode})`
                                : isIncoming
                                  ? `From ${entry.fromBranchName} (${entry.fromBranchCode})`
                                  : `${entry.fromBranchName} → ${entry.toBranchName}`}
                            </p>
                            {entry.isBatch && entry.lineItems.length > 0 && (
                              <ul className="mt-3 space-y-1 text-sm">
                                {entry.lineItems.map((line, idx) => (
                                  <li key={`${entry.id}-${idx}`}>
                                    {line.quantity} {line.unit} × {line.productDescription}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                          <div className="text-right shrink-0">
                            <Badge className="text-sm mb-2">
                              {entry.quantity} {entry.unit}
                            </Badge>
                            <p className="text-xs text-[hsl(var(--muted-foreground))]">
                              {new Date(entry.transferredAt).toLocaleString()}
                            </p>
                            <p className="text-xs text-[hsl(var(--muted-foreground))]">{entry.transferredBy}</p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>
          </div>
        </div>
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
        onSubmit={handleBulkTransferSubmit}
      />
    </div>
  )
}
