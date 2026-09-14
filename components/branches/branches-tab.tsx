  "use client"
import { useState, useEffect, useMemo } from "react"
import {
  getBranches,
  saveBranch,
  deleteBranch,
  generateBranchCode,
  getBranchInventory,
  searchProductAcrossBranches,
  type Branch,
  type BranchProductLocation,
} from "@/lib/branches"
import { BranchDetailView } from "@/components/branches/branch-detail-view"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Plus, Trash2, X, Loader2, FileDown, Building2, ChevronRight, Shield, Search, Package, Copy } from "lucide-react"
import { useDialog } from "@/components/ui/dialog-provider"
import { useToast } from "@/components/ui/toast"
import { useAuth } from "@/components/auth-provider"
import { loadInventoryProductOptions, type InventoryProductOption } from "@/lib/inventory-product-options"
import { summarizeBranchProductResults } from "@/lib/branch-product-search"
import { getBranchPosAccounts } from "@/lib/pos"
import { branchPosEmail, branchPosPassword } from "@/lib/branch-pos"
import {
  downloadGrandInventoryExcel,
  downloadGrandInventoryPDF,
  resolveGrandInventoryProductFields,
  summarizeGrandInventory,
  type GrandInventoryDetailRow,
  type GrandInventoryProductSummary,
  type GrandInventorySummary,
} from "@/lib/branch-inventory-grand-export"
import { getInventoryModelLabels } from "@/lib/inventory-model-labels"
import { getManualInventoryItems } from "@/lib/manual-inventory"
import { CrmExcelExportButton } from "@/components/crm/crm-excel-export-button"

const empty = (code: string = ""): Omit<Branch, "id" | "createdAt" | "createdBy"> => ({
  name: "", code, type: "outlet", address: "", city: "", country: "", phone: "", email: "", manager: "", status: "active", notes: "",
})

function PosLoginCredentials({
  email,
  password,
  onCopy,
}: {
  email: string
  password: string
  onCopy: (text: string, label: string) => void
}) {
  return (
    <div className="min-w-0 text-[10px] leading-snug font-mono" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center gap-1 min-w-0">
        <p className="truncate flex-1" title={email}>{email}</p>
        <button
          type="button"
          onClick={() => onCopy(email, "Login ID copied")}
          className="shrink-0 p-0.5 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] cursor-pointer"
          title="Copy login ID"
        >
          <Copy className="h-3 w-3" />
        </button>
      </div>
      <div className="flex items-center gap-1 min-w-0 mt-0.5 text-[hsl(var(--muted-foreground))]">
        <p className="truncate flex-1" title={password}>{password}</p>
        <button
          type="button"
          onClick={() => onCopy(password, "Password copied")}
          className="shrink-0 p-0.5 hover:text-[hsl(var(--foreground))] cursor-pointer"
          title="Copy password"
        >
          <Copy className="h-3 w-3" />
        </button>
      </div>
    </div>
  )
}

function GrandInventoryByProductList({
  products,
  className = "max-h-96",
}: {
  products: GrandInventoryProductSummary[]
  className?: string
}) {
  if (products.length === 0) {
    return (
      <p className="text-xs text-[hsl(var(--muted-foreground))] py-4 text-center">
        No products in stock at any branch or warehouse.
      </p>
    )
  }

  return (
    <div className={`overflow-y-auto border border-[hsl(var(--border))] divide-y divide-[hsl(var(--border))] ${className}`}>
      {products.map((product) => (
        <div key={`${product.model}-${product.item}`} className="px-3 py-2.5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm text-[hsl(var(--foreground))]">{product.item}</p>
              <p className="text-[10px] font-mono text-[hsl(var(--muted-foreground))] mt-0.5">{product.model}</p>
            </div>
            <p className="text-sm tabular-nums shrink-0">
              <span className="font-medium">{product.totalQty.toLocaleString()}</span>{" "}
              <span className="text-[hsl(var(--muted-foreground))]">{product.unit}</span>
            </p>
          </div>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[hsl(var(--muted-foreground))]">
            {product.locations.map((loc) => (
              <span key={`${product.model}-${loc.branchCode}`} className="tabular-nums">
                {loc.branchName} ({loc.branchCode}){" "}
                <span className="text-[hsl(var(--foreground))]">{loc.qty.toLocaleString()} {loc.unit}</span>
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

async function generateSingleBranchPdf(branch: Branch, inventoryRows: any[]) {
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
  
  const body = inventoryRows.map(inv => [
    inv.productDescription || inv.itemName || inv.inventoryId || "N/A",
    String(inv.quantity),
    inv.unit || "",
    inv.assignedAt ? new Date(inv.assignedAt).toLocaleDateString() : "-"
  ])

  autoTable(doc, {
    startY: 38,
    head: [["Item Description", "Qty", "Unit", "Date"]],
    body: body,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [31, 172, 166] },
  })
  
  doc.save(`${branch.code}-inventory-${new Date().toISOString().slice(0, 10)}.pdf`)
}

// â”€â”€ Branch Form â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function BranchForm({ initial, onSave, onCancel, isLoading, autoGenerated }: {
  initial: Omit<Branch, "id" | "createdAt" | "createdBy">
  onSave: (b: Omit<Branch, "id" | "createdAt" | "createdBy">) => void
  onCancel: () => void
  isLoading?: boolean
  autoGenerated?: boolean
}) {
  const [form, setForm] = useState(initial)
  const set = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }))

  return (
    <form onSubmit={e => { e.preventDefault(); onSave(form) }}
      className="border rounded-lg p-4 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1 sm:col-span-2">
          <label className="text-xs font-medium">Branch Name *</label>
          <input required value={form.name} onChange={e => set("name", e.target.value)}
            placeholder="e.g. Main Outlet"
            className="w-full h-8 rounded-md border bg-[hsl(var(--background))] px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium">Branch Code *</label>
          <input required value={form.code} onChange={e => set("code", e.target.value)}
            placeholder="e.g. BR001"
            readOnly={autoGenerated}
            className={`w-full h-8 rounded-md border bg-[hsl(var(--background))] px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))] ${autoGenerated ? "bg-[hsl(var(--muted))]/50 cursor-not-allowed" : ""}`}
          />
          {autoGenerated && <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Auto-generated</p>}
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium">Type *</label>
          <select required value={form.type} onChange={e => set("type", e.target.value)}
            className="w-full h-8 rounded-md border bg-[hsl(var(--background))] px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]">
            <option value="outlet">Outlet</option>
            <option value="store">Store</option>
            <option value="warehouse">Warehouse</option>
            <option value="branch_warehouse">Branch Warehouse</option>
            <option value="main_warehouse">Main Warehouse</option>
            <option value="office">Office</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium">Manager</label>
          <input value={form.manager} onChange={e => set("manager", e.target.value)}
            placeholder="Manager name"
            className="w-full h-8 rounded-md border bg-[hsl(var(--background))] px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium">Status *</label>
          <select required value={form.status} onChange={e => set("status", e.target.value)}
            className="w-full h-8 rounded-md border bg-[hsl(var(--background))] px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]">
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium">Phone</label>
          <input value={form.phone} onChange={e => set("phone", e.target.value)}
            placeholder="+92 300 0000000"
            className="w-full h-8 rounded-md border bg-[hsl(var(--background))] px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium">Email</label>
          <input type="email" value={form.email} onChange={e => set("email", e.target.value)}
            className="w-full h-8 rounded-md border bg-[hsl(var(--background))] px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium">Location</label>
          <input value={form.city} onChange={e => set("city", e.target.value)}
            className="w-full h-8 rounded-md border bg-[hsl(var(--background))] px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]" />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <label className="text-xs font-medium">Address</label>
          <input value={form.address} onChange={e => set("address", e.target.value)}
            className="w-full h-8 rounded-md border bg-[hsl(var(--background))] px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium">Country</label>
          <input value={form.country} onChange={e => set("country", e.target.value)}
            className="w-full h-8 rounded-md border bg-[hsl(var(--background))] px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]" />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <label className="text-xs font-medium">Notes</label>
          <textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={2}
            className="w-full rounded-md border bg-[hsl(var(--background))] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))] resize-none" />
        </div>
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" className="h-8 cursor-pointer" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
              Saving...
            </>
          ) : (
            "Save Branch"
          )}
        </Button>
        <Button type="button" variant="outline" size="sm" className="h-8 cursor-pointer" onClick={onCancel} disabled={isLoading}>Cancel</Button>
      </div>
    </form>
  )
}

// â”€â”€ Main Tab â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export function BranchesTab() {
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [viewBranch, setViewBranch] = useState<Branch | null>(null)
  const [saving, setSaving] = useState(false)
  const [autoCode, setAutoCode] = useState("")
  const [exportPreviewOpen, setExportPreviewOpen] = useState(false)
  const [exportLoading, setExportLoading] = useState(false)
  const [exportingGrandPdf, setExportingGrandPdf] = useState(false)
  const [exportingGrandExcel, setExportingGrandExcel] = useState(false)
  const [grandLoading, setGrandLoading] = useState(false)
  const [grandSummary, setGrandSummary] = useState<GrandInventorySummary | null>(null)
  const [exportRows, setExportRows] = useState<GrandInventoryDetailRow[]>([])
  const [search, setSearch] = useState("")
  const [productSearch, setProductSearch] = useState("")
  const [selectedProductId, setSelectedProductId] = useState("")
  const [inventoryProducts, setInventoryProducts] = useState<InventoryProductOption[]>([])
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [productResults, setProductResults] = useState<BranchProductLocation[]>([])
  const [productSearchLoading, setProductSearchLoading] = useState(false)
  const [posAccounts, setPosAccounts] = useState<Array<{
    branchId: string
    email: string
    password: string
    loginUrl: string
  }>>([])
  const { confirm } = useDialog()
  const { toast } = useToast()
  const { user } = useAuth()

  useEffect(() => {
    getBranches().then(b => { setBranches(b); setLoading(false) })
    const interval = setInterval(() => getBranches().then(setBranches), 30000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    void getBranchPosAccounts().then(setPosAccounts)
  }, [])

  useEffect(() => {
    loadInventoryProductOptions()
      .then(setInventoryProducts)
      .finally(() => setLoadingProducts(false))
  }, [])

  const selectedProductOption = useMemo(
    () => inventoryProducts.find((p) => p.id === selectedProductId),
    [inventoryProducts, selectedProductId],
  )

  const filteredInventoryProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase()
    if (!q || selectedProductId) return inventoryProducts
    return inventoryProducts.filter(
      (p) =>
        p.displayName.toLowerCase().includes(q) ||
        p.modelKey.toLowerCase().includes(q) ||
        p.matchTerms.some((term) => term.toLowerCase().includes(q)),
    )
  }, [inventoryProducts, productSearch, selectedProductId])

  const isProductFiltered = !!selectedProductOption || productSearch.trim().length >= 2

  const productSummary = useMemo(() => {
    if (!isProductFiltered || productSearchLoading) return null
    return summarizeBranchProductResults(productResults)
  }, [productResults, isProductFiltered, productSearchLoading])

  function clearProductFilter() {
    setSelectedProductId("")
    setProductSearch("")
    setProductResults([])
  }

  function handleProductDropdownChange(value: string) {
    setSelectedProductId(value)
    setProductSearch("")
  }

  function handleProductSearchChange(value: string) {
    setProductSearch(value)
    if (value.trim()) setSelectedProductId("")
  }

  useEffect(() => {
    if (selectedProductOption) {
      setProductSearchLoading(true)
      searchProductAcrossBranches(selectedProductOption.matchTerms)
        .then(setProductResults)
        .finally(() => setProductSearchLoading(false))
      return
    }

    const q = productSearch.trim()
    if (q.length < 2) {
      setProductResults([])
      setProductSearchLoading(false)
      return
    }

    setProductSearchLoading(true)
    const timer = window.setTimeout(() => {
      searchProductAcrossBranches(q)
        .then(setProductResults)
        .finally(() => setProductSearchLoading(false))
    }, 300)

    return () => window.clearTimeout(timer)
  }, [selectedProductOption, productSearch])

  async function handleAdd(data: Omit<Branch, "id" | "createdAt" | "createdBy">) {
    setSaving(true)
    const b: Branch = {
      ...data,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      createdBy: user?.name || "system",
    }
    try {
      const saved = await saveBranch(b)
      setBranches((prev) => [...prev, saved])
      setAdding(false)
      setAutoCode("")
      toast({
        type: "success",
        title: "Branch Created",
        message: `${saved.name} has been added successfully.`,
        duration: 3000,
      })
    } catch (error) {
      toast({
        type: "error",
        title: "Error",
        message: error instanceof Error ? error.message : "Failed to create branch. Please try again.",
        duration: 5000,
      })
    } finally {
      setSaving(false)
    }
  }

  async function handleEdit(id: string, data: Omit<Branch, "id" | "createdAt" | "createdBy">) {
    setSaving(true)
    const existing = branches.find(b => b.id === id)
    const b: Branch = { ...data, id, createdAt: existing?.createdAt || new Date().toISOString(), createdBy: existing?.createdBy || user?.name || "system" }
    try {
      const saved = await saveBranch(b)
      setBranches((prev) => prev.map((x) => (x.id === id ? saved : x)))
      setEditId(null)
      setViewBranch(saved)
      toast({
        type: "success",
        title: "Branch Updated",
        message: `${saved.name} has been updated successfully.`,
        duration: 3000,
      })
    } catch (error) {
      toast({
        type: "error",
        title: "Error",
        message: error instanceof Error ? error.message : "Failed to update branch. Please try again.",
        duration: 5000,
      })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    const ok = await confirm({
      type: "confirm",
      title: "Delete Branch",
      message: "This branch will be permanently removed.",
      confirmLabel: "Delete",
    })
    if (!ok) return
    await deleteBranch(id)
    setBranches(prev => prev.filter(b => b.id !== id))
    setViewBranch(null)
  }

  async function buildInventoryExportRows(): Promise<GrandInventoryDetailRow[]> {
    const targetBranches = branches.filter(b =>
      ["main_warehouse", "branch_warehouse", "warehouse", "store"].includes(b.type)
    )
    const labels = await getInventoryModelLabels().catch(() => [])
    const manualItems = await getManualInventoryItems().catch(() => [])
    const labelMap = Object.fromEntries(
      labels.map((label) => [label.model.trim(), label.displayName.trim()]).filter(([model, name]) => model && name),
    )
    for (const manual of manualItems) {
      const model = manual.model?.trim()
      const name = manual.name?.trim()
      if (model && name) labelMap[model] = name
    }
    const rows = await Promise.all(
      targetBranches.map(async b => {
        const items = await getBranchInventory(b.id)
        return items
          .filter((item) => (item.quantity || 0) > 0)
          .map(item => {
            const { item: productName, model } = resolveGrandInventoryProductFields(item, labelMap)
            return {
              branchName: b.name,
              branchCode: b.code,
              branchType: b.type,
              item: productName,
              model,
              qty: item.quantity,
              unit: item.unit || "pcs",
              transferredAt: item.assignedAt ? new Date(item.assignedAt).toLocaleDateString() : "-",
            }
          })
      })
    )
    return rows.flat()
  }

  async function refreshGrandInventory() {
    setGrandLoading(true)
    try {
      const rows = await buildInventoryExportRows()
      setExportRows(rows)
      setGrandSummary(summarizeGrandInventory(rows))
      return rows
    } finally {
      setGrandLoading(false)
    }
  }

  async function handleOpenGrandInventory() {
    setExportLoading(true)
    try {
      await refreshGrandInventory()
      setExportPreviewOpen(true)
    } finally {
      setExportLoading(false)
    }
  }

  async function handleExportGrandPdf() {
    setExportingGrandPdf(true)
    try {
      const rows = exportRows.length ? exportRows : await refreshGrandInventory()
      const summary = grandSummary ?? summarizeGrandInventory(rows)
      await downloadGrandInventoryPDF(rows, summary)
    } finally {
      setExportingGrandPdf(false)
    }
  }

  function handleExportGrandExcel() {
    setExportingGrandExcel(true)
    try {
      const summary = grandSummary ?? summarizeGrandInventory(exportRows)
      downloadGrandInventoryExcel(exportRows, summary, user?.name)
    } finally {
      setExportingGrandExcel(false)
    }
  }

  const editingBranch = branches.find(b => b.id === editId)

  function posForBranch(branchId: string) {
    return posAccounts.find((a) => a.branchId === branchId)
  }

  async function copyPosCredential(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text)
      toast({ type: "success", title: label })
    } catch {
      toast({ type: "error", title: "Copy failed", message: "Could not copy to clipboard." })
    }
  }

  if (viewBranch && !editId) {
    return (
      <BranchDetailView
        branch={viewBranch}
        branches={branches}
        onBack={() => setViewBranch(null)}
        onEdit={() => {
          setEditId(viewBranch.id)
          setViewBranch(null)
        }}
        onDelete={() => handleDelete(viewBranch.id)}
      />
    )
  }

  function formatBranchType(type: Branch["type"]) {
    if (type === "main_warehouse") return "Main warehouse"
    if (type === "branch_warehouse") return "Branch warehouse"
    return type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, " ")
  }

  const filteredBranches = branches.filter((b) => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return (
      b.name.toLowerCase().includes(q) ||
      b.code.toLowerCase().includes(q) ||
      formatBranchType(b.type).toLowerCase().includes(q) ||
      (b.manager || "").toLowerCase().includes(q)
    )
  })

  return (
    <div className="flex flex-col gap-3 min-h-0">
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-[hsl(var(--muted-foreground))]" />
          <p className="text-xs text-[hsl(var(--muted-foreground))]">Loading branches…</p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 shrink-0">
            <div className="flex items-center gap-2 text-[11px] text-[hsl(var(--muted-foreground))] shrink-0">
              <Building2 className="h-3.5 w-3.5 text-[#1faca6]" />
              <span className="font-semibold text-[hsl(var(--foreground))]">Branches & warehouses</span>
              <span className="text-[hsl(var(--border))]">·</span>
              <span className="tabular-nums">
                <span className="font-semibold text-[hsl(var(--foreground))]">{branches.length}</span> locations
              </span>
            </div>
            <div className="relative flex-1 min-w-[140px] max-w-[200px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search branch…"
                className="w-full h-8 rounded-md border bg-[hsl(var(--background))] pl-8 pr-3 text-xs focus:outline-none focus:ring-1 focus:ring-[#1faca6]/40"
              />
            </div>
            <div className="flex flex-wrap items-center gap-1.5 ml-auto">
              <Button size="sm" variant="outline" className="h-8 px-2.5 text-xs cursor-pointer border" asChild>
                <Link href="/warranty-center">
                  <Shield className="h-3.5 w-3.5 mr-1" />
                  Warranty
                </Link>
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 px-2.5 text-xs cursor-pointer border"
                onClick={() => void handleOpenGrandInventory()}
                disabled={exportLoading || grandLoading}
              >
                {exportLoading || grandLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                ) : (
                  <FileDown className="h-3.5 w-3.5 mr-1" />
                )}
                Grand inventory
              </Button>
              <Button
                size="sm"
                className="h-8 px-2.5 text-xs cursor-pointer bg-[#1faca6] hover:bg-[#17857f] text-white"
                onClick={async () => {
                  const code = await generateBranchCode()
                  setAutoCode(code)
                  setAdding(true)
                  setEditId(null)
                }}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add branch
              </Button>
            </div>
          </div>

          <div className="rounded-lg border bg-[hsl(var(--muted))]/10 p-3 space-y-3 shrink-0">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative sm:w-72 shrink-0">
                <Package className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#1faca6] pointer-events-none" />
                <select
                  value={selectedProductId}
                  onChange={(e) => handleProductDropdownChange(e.target.value)}
                  disabled={loadingProducts}
                  className="w-full h-9 rounded-md border bg-[hsl(var(--background))] pl-10 pr-8 text-sm appearance-none focus:outline-none focus:ring-1 focus:ring-[#1faca6]/50 cursor-pointer"
                >
                  <option value="">
                    {loadingProducts ? "Loading inventory…" : "All products"}
                  </option>
                  {filteredInventoryProducts.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.displayName} ({product.inStock} in stock)
                    </option>
                  ))}
                </select>
              </div>
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
                <input
                  value={productSearch}
                  onChange={(e) => handleProductSearchChange(e.target.value)}
                  placeholder="Or type product / model to search across branches…"
                  className="w-full h-9 rounded-md border bg-[hsl(var(--background))] pl-9 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#1faca6]/50"
                />
              </div>
            </div>

            {isProductFiltered && productSummary && !productSearchLoading && (
              <div className="rounded-md border bg-[hsl(var(--background))] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <p className="text-sm font-semibold">
                    {selectedProductOption?.displayName || productSearch.trim()}
                  </p>
                  <button
                    type="button"
                    onClick={clearProductFilter}
                    className="text-[11px] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] cursor-pointer"
                  >
                    Clear product
                  </button>
                </div>
                <div className="flex flex-wrap items-end gap-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Total available</p>
                    <p className="text-2xl font-bold text-[#1faca6] tabular-nums">
                      {productSummary.totalQty}{" "}
                      <span className="text-sm font-medium">{productSummary.unit}</span>
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--muted-foreground))]">At branches</p>
                    <p className="text-lg font-semibold tabular-nums">
                      {productSummary.branchQty} {productSummary.unit}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Main warehouse</p>
                    <p className="text-lg font-semibold tabular-nums">
                      {productSummary.mainWarehouseQty} {productSummary.unit}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Locations</p>
                    <p className="text-lg font-semibold tabular-nums">{productSummary.locationCount}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <p className="text-[10px] text-[hsl(var(--muted-foreground))] px-0.5 -mt-1">
            {isProductFiltered
              ? "Shows where this product is held across branches and warehouses"
              : "Click a row to open inventory"}
          </p>

          {isProductFiltered && (
            <div className="rounded-lg border overflow-hidden shrink-0">
              <div className="flex items-center justify-between gap-2 px-3 py-2 border-b bg-[hsl(var(--muted))]/10">
                <p className="text-xs font-semibold">
                  Available where
                </p>
                <span className="text-[11px] text-[hsl(var(--muted-foreground))] tabular-nums">
                  {productSearchLoading ? "Searching…" : `${productResults.length} location${productResults.length === 1 ? "" : "s"}`}
                </span>
              </div>
              {productSearchLoading ? (
                <div className="flex items-center justify-center gap-2 py-8 text-xs text-[hsl(var(--muted-foreground))]">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Searching branches…
                </div>
              ) : productResults.length === 0 ? (
                <div className="px-4 py-8 text-center text-xs text-[hsl(var(--muted-foreground))]">
                  No branches have this product in stock.
                </div>
              ) : (
                <div className="max-h-56 overflow-y-auto divide-y">
                  {productResults.map((row) => (
                    <button
                      key={`${row.branchId}-${row.model}-${row.quantity}`}
                      type="button"
                      onClick={() => {
                        const branch = branches.find((b) => b.id === row.branchId)
                        if (branch) {
                          setViewBranch(branch)
                          setEditId(null)
                        }
                      }}
                      className="w-full text-left px-3 py-2.5 hover:bg-[hsl(var(--muted))]/20 transition-colors"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{row.itemName}</p>
                          <p className="text-[11px] font-mono text-[hsl(var(--muted-foreground))] truncate mt-0.5">
                            {row.model}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold text-[#1faca6] tabular-nums">
                            {row.quantity} {row.unit}
                          </p>
                          <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-0.5">
                            {row.branchName} ({row.branchCode})
                            {row.branchType === "main_warehouse" && " · Main warehouse"}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {branches.length === 0 && !adding && (
            <div className="flex flex-col items-center justify-center py-14 text-center gap-2 rounded-lg border border-dashed">
              <Building2 className="h-8 w-8 text-[hsl(var(--muted-foreground))] opacity-30" />
              <p className="text-sm font-medium">No branches yet</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))">Add your first branch or warehouse.</p>
            </div>
          )}

          {filteredBranches.length === 0 && branches.length > 0 && (
            <div className="rounded-lg border px-4 py-8 text-center text-xs text-[hsl(var(--muted-foreground))]">
              No branches match your search.
            </div>
          )}

          {filteredBranches.length > 0 && (
            <>
              {/* Mobile list */}
              <div className="sm:hidden border border-[hsl(var(--border))] divide-y divide-[hsl(var(--border))]">
                {filteredBranches.map((b) => {
                  const pos = posForBranch(b.id)
                  const email = pos?.email || branchPosEmail(b.code)
                  const password = pos?.password || branchPosPassword(b.code)
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => {
                        setViewBranch(b)
                        setEditId(null)
                      }}
                      className="w-full text-left px-3 py-2.5 hover:bg-[hsl(var(--muted))]/15 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm truncate">{b.name}</p>
                          <p className="text-[11px] font-mono text-[hsl(var(--muted-foreground))] mt-0.5">
                            {b.code} · {formatBranchType(b.type)} · {b.status}
                          </p>
                          {b.manager && (
                            <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-1">{b.manager}</p>
                          )}
                          <div className="mt-1.5" onClick={(e) => e.stopPropagation()}>
                            <PosLoginCredentials email={email} password={password} onCopy={copyPosCredential} />
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 shrink-0 text-[hsl(var(--muted-foreground))] mt-0.5" />
                      </div>
                    </button>
                  )
                })}
              </div>

              {/* Desktop table */}
              <div className="hidden sm:block overflow-x-auto border border-[hsl(var(--border))]">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[hsl(var(--border))] text-left text-[10px] uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                      <th className="px-3 py-2 font-medium">Name</th>
                      <th className="px-3 py-2 font-medium">Code</th>
                      <th className="px-3 py-2 font-medium">Type</th>
                      <th className="px-3 py-2 font-medium">Manager</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                      <th className="px-3 py-2 font-medium">POS login</th>
                      <th className="px-3 py-2 font-medium text-right w-[72px]">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBranches.map((b) => {
                      const pos = posForBranch(b.id)
                      const email = pos?.email || branchPosEmail(b.code)
                      const password = pos?.password || branchPosPassword(b.code)
                      return (
                        <tr
                          key={b.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => {
                            setViewBranch(b)
                            setEditId(null)
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault()
                              setViewBranch(b)
                              setEditId(null)
                            }
                          }}
                          className="border-b border-[hsl(var(--border))] last:border-b-0 hover:bg-[hsl(var(--muted))]/10 cursor-pointer"
                        >
                          <td className="px-3 py-2 text-sm truncate max-w-[180px]">{b.name}</td>
                          <td className="px-3 py-2 font-mono text-[hsl(var(--muted-foreground))]">{b.code}</td>
                          <td className="px-3 py-2 text-[hsl(var(--muted-foreground))]">{formatBranchType(b.type)}</td>
                          <td className="px-3 py-2 text-[hsl(var(--muted-foreground))] truncate max-w-[120px]">
                            {b.manager || "—"}
                          </td>
                          <td className="px-3 py-2 capitalize text-[hsl(var(--muted-foreground))]">{b.status}</td>
                          <td className="px-3 py-2">
                            <PosLoginCredentials email={email} password={password} onCopy={copyPosCredential} />
                          </td>
                          <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-0.5">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                                title="Export inventory PDF"
                                onClick={async () => {
                                  const inv = await getBranchInventory(b.id)
                                  generateSingleBranchPdf(b, inv)
                                }}
                              >
                                <FileDown className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-[hsl(var(--muted-foreground))] hover:text-red-600"
                                title="Delete branch"
                                onClick={() => handleDelete(b.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}

      {/* Add modal */}
      {adding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setAdding(false)}>
          <div className="w-full max-w-lg rounded-lg border bg-[hsl(var(--card))] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <p className="text-sm font-semibold">Add Branch</p>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setAdding(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-5">
              <BranchForm initial={empty(autoCode)} onSave={handleAdd} onCancel={() => setAdding(false)} isLoading={saving} autoGenerated={!!autoCode} />
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editId && editingBranch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setEditId(null)}>
          <div className="w-full max-w-lg rounded-lg border bg-[hsl(var(--card))] p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Edit Branch</p>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditId(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <BranchForm
              initial={{ name: editingBranch.name, code: editingBranch.code, type: editingBranch.type, address: editingBranch.address, city: editingBranch.city, country: editingBranch.country, phone: editingBranch.phone, email: editingBranch.email, manager: editingBranch.manager, status: editingBranch.status, notes: editingBranch.notes }}
              onSave={data => handleEdit(editId, data)}
              onCancel={() => setEditId(null)}
              isLoading={saving}
              autoGenerated={false}
            />
          </div>
        </div>
      )}

      {exportPreviewOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-6"
          onClick={() => setExportPreviewOpen(false)}
        >
          <div
            className="w-full max-w-6xl h-[min(92vh,900px)] rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden flex flex-col shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-[hsl(var(--border))] shrink-0">
              <div className="min-w-0">
                <p className="text-sm font-semibold">Grand inventory — by product</p>
                <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-0.5">
                  Total available now, then where stock is held at each branch
                </p>
                {grandSummary && (
                  <p className="text-[11px] tabular-nums text-[hsl(var(--muted-foreground))] mt-1.5">
                    Products <span className="text-[hsl(var(--foreground))] font-medium">{grandSummary.productCount}</span>
                    <span className="mx-1.5 text-[hsl(var(--border))]">·</span>
                    Total available{" "}
                    <span className="text-[hsl(var(--foreground))] font-medium">
                      {grandSummary.totalQty.toLocaleString()}
                    </span>
                    <span className="mx-1.5 text-[hsl(var(--border))]">·</span>
                    Locations{" "}
                    <span className="text-[hsl(var(--foreground))] font-medium">{grandSummary.locationCount}</span>
                    <span className="mx-1.5 text-[hsl(var(--border))]">·</span>
                    Branches{" "}
                    <span className="text-[hsl(var(--foreground))] font-medium">{grandSummary.branchCount}</span>
                  </p>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                title="Close"
                aria-label="Close"
                onClick={() => setExportPreviewOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="p-4 overflow-y-auto min-h-0 flex-1">
              {grandLoading ? (
                <div className="flex items-center justify-center gap-2 py-16 text-xs text-[hsl(var(--muted-foreground))]">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading inventory totals…
                </div>
              ) : exportRows.length === 0 ? (
                <p className="text-xs text-[hsl(var(--muted-foreground))] text-center py-16">
                  No inventory rows found for warehouses/stores.
                </p>
              ) : (
                <GrandInventoryByProductList
                  products={grandSummary?.products ?? []}
                  className="max-h-none h-full"
                />
              )}
            </div>

            <div className="px-4 py-3 border-t border-[hsl(var(--border))] flex flex-wrap justify-end gap-2 shrink-0">
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs cursor-pointer"
                onClick={() => setExportPreviewOpen(false)}
              >
                Close
              </Button>
              <CrmExcelExportButton
                onExport={handleExportGrandExcel}
                exporting={exportingGrandExcel}
                disabled={exportRows.length === 0}
                label="Export Excel"
              />
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs cursor-pointer"
                onClick={() => void handleExportGrandPdf()}
                disabled={exportRows.length === 0 || exportingGrandPdf}
              >
                {exportingGrandPdf ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                ) : (
                  <FileDown className="h-3.5 w-3.5 mr-1" />
                )}
                Export PDF
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
