  "use client"
import { useState, useEffect, useMemo, useRef } from "react"
import { createPortal } from "react-dom"
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
import { Plus, Trash2, X, Loader2, FileDown, Building2, ChevronRight, Search, Package, Copy, SlidersHorizontal } from "lucide-react"
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
    <div className="min-w-0 text-[10px] leading-snug font-mono text-[#86868b]" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center gap-1 min-w-0">
        <p className="truncate flex-1 text-[#1d1d1f]" title={email}>{email}</p>
        <button
          type="button"
          onClick={() => onCopy(email, "Login ID copied")}
          className="shrink-0 p-0.5 text-[#86868b] hover:text-[#1d1d1f] cursor-pointer"
          title="Copy login ID"
        >
          <Copy className="h-3 w-3" />
        </button>
      </div>
      <div className="flex items-center gap-1 min-w-0 mt-0.5">
        <p className="truncate flex-1" title={password}>{password}</p>
        <button
          type="button"
          onClick={() => onCopy(password, "Password copied")}
          className="shrink-0 p-0.5 hover:text-[#1d1d1f] cursor-pointer"
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
}: {
  products: GrandInventoryProductSummary[]
}) {
  if (products.length === 0) {
    return (
      <p className="text-xs text-[#86868b] py-4 text-center">
        No products in stock at any branch or warehouse.
      </p>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
      {products.map((product) => (
        <div
          key={`${product.model}-${product.item}`}
          className="rounded-[16px] bg-white border border-black/[0.06] shadow-sm flex flex-col min-h-0 overflow-hidden"
        >
          <div className="px-3 py-2.5 border-b border-black/[0.06] flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-medium leading-snug text-[#1d1d1f]">
                {product.item}
              </p>
              <p className="text-[10px] font-mono text-[#86868b] mt-1 truncate">
                {product.model}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-[10px] uppercase tracking-wide text-[#86868b]">Total</p>
              <p className="text-lg font-semibold tabular-nums leading-tight text-[#1d1d1f]">
                {product.totalQty.toLocaleString()}
              </p>
              <p className="text-[10px] text-[#86868b]">{product.unit}</p>
            </div>
          </div>

          <div className="px-3 py-2 flex-1">
            <p className="text-[10px] uppercase tracking-wide text-[#86868b] mb-1.5">
              Available where · {product.locations.length}
            </p>
            <div className="space-y-1">
              {product.locations.map((loc) => (
                <div
                  key={`${product.model}-${loc.branchCode}`}
                  className="flex items-center justify-between gap-2 text-[11px] border-b border-black/[0.06] last:border-b-0 py-1"
                >
                  <span className="min-w-0 truncate text-[#86868b]">
                    {loc.branchName}{" "}
                    <span className="font-mono">({loc.branchCode})</span>
                  </span>
                  <span className="tabular-nums font-medium text-[#1d1d1f] shrink-0">
                    {loc.qty.toLocaleString()} {loc.unit}
                  </span>
                </div>
              ))}
            </div>
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
const fieldClass =
  "w-full h-9 rounded-[10px] border-0 bg-[#f2f2f7] px-3 text-[13px] text-[#1d1d1f] placeholder:text-[#86868b]/80 focus:outline-none focus:ring-2 focus:ring-[#0071e3]/25"

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
      className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1 sm:col-span-2">
          <label className="text-[10px] font-semibold tracking-tight text-[#86868b]">Branch name *</label>
          <input required value={form.name} onChange={e => set("name", e.target.value)}
            placeholder="e.g. Main Outlet"
            className={fieldClass} />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-semibold tracking-tight text-[#86868b]">Branch code *</label>
          <input required value={form.code} onChange={e => set("code", e.target.value)}
            placeholder="e.g. BR001"
            readOnly={autoGenerated}
            className={`${fieldClass} ${autoGenerated ? "opacity-70 cursor-not-allowed" : ""}`}
          />
          {autoGenerated && <p className="text-[10px] text-[#86868b]">Auto-generated</p>}
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-semibold tracking-tight text-[#86868b]">Type *</label>
          <select required value={form.type} onChange={e => set("type", e.target.value)}
            className={`${fieldClass} cursor-pointer`}>
            <option value="outlet">Outlet</option>
            <option value="store">Store</option>
            <option value="warehouse">Warehouse</option>
            <option value="branch_warehouse">Branch Warehouse</option>
            <option value="main_warehouse">Main Warehouse</option>
            <option value="office">Office</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-semibold tracking-tight text-[#86868b]">Manager</label>
          <input value={form.manager} onChange={e => set("manager", e.target.value)}
            placeholder="Manager name"
            className={fieldClass} />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-semibold tracking-tight text-[#86868b]">Status *</label>
          <select required value={form.status} onChange={e => set("status", e.target.value)}
            className={`${fieldClass} cursor-pointer`}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-semibold tracking-tight text-[#86868b]">Phone</label>
          <input value={form.phone} onChange={e => set("phone", e.target.value)}
            placeholder="+92 300 0000000"
            className={fieldClass} />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-semibold tracking-tight text-[#86868b]">Email</label>
          <input type="email" value={form.email} onChange={e => set("email", e.target.value)}
            className={fieldClass} />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-semibold tracking-tight text-[#86868b]">Location</label>
          <input value={form.city} onChange={e => set("city", e.target.value)}
            className={fieldClass} />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <label className="text-[10px] font-semibold tracking-tight text-[#86868b]">Address</label>
          <input value={form.address} onChange={e => set("address", e.target.value)}
            className={fieldClass} />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-semibold tracking-tight text-[#86868b]">Country</label>
          <input value={form.country} onChange={e => set("country", e.target.value)}
            className={fieldClass} />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <label className="text-[10px] font-semibold tracking-tight text-[#86868b]">Notes</label>
          <textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={2}
            className="w-full rounded-[10px] border-0 bg-[#f2f2f7] px-3 py-2 text-[13px] text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#0071e3]/25 resize-none" />
        </div>
      </div>
      <div className="flex flex-wrap gap-2 pt-1">
        <button
          type="submit"
          disabled={isLoading}
          className="h-9 rounded-full px-5 text-[13px] font-semibold bg-[#1d1d1f] text-white hover:bg-black disabled:opacity-50 cursor-pointer inline-flex items-center gap-1.5"
        >
          {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          {isLoading ? "Saving…" : "Save branch"}
        </button>
        <button type="button" className="h-9 rounded-full px-5 text-[13px] font-semibold text-[#1d1d1f] bg-black/[0.06] hover:bg-black/[0.1] cursor-pointer disabled:opacity-50" onClick={onCancel} disabled={isLoading}>Cancel</button>
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
  const [filterOpen, setFilterOpen] = useState(false)
  const [filterPos, setFilterPos] = useState<{ top: number; left: number } | null>(null)
  const filterBtnRef = useRef<HTMLButtonElement | null>(null)
  const filtersRef = useRef<HTMLDivElement | null>(null)
  const [productSearch, setProductSearch] = useState("")
  const [selectedProductId, setSelectedProductId] = useState("")
  const [inventoryProducts, setInventoryProducts] = useState<InventoryProductOption[]>([])
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [productResults, setProductResults] = useState<BranchProductLocation[]>([])
  const [productSearchLoading, setProductSearchLoading] = useState(false)
  const [productLookupOpen, setProductLookupOpen] = useState(false)
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

  useEffect(() => {
    if (!filterOpen) {
      setFilterPos(null)
      return
    }
    function place() {
      const btn = filterBtnRef.current
      if (!btn) return
      const r = btn.getBoundingClientRect()
      const panelW = Math.min(328, window.innerWidth - 24)
      const left = Math.min(Math.max(12, r.right - panelW), window.innerWidth - panelW - 12)
      const top = Math.min(r.bottom + 8, window.innerHeight - 24)
      setFilterPos({ top, left })
    }
    place()
    window.addEventListener("resize", place)
    window.addEventListener("scroll", place, true)
    return () => {
      window.removeEventListener("resize", place)
      window.removeEventListener("scroll", place, true)
    }
  }, [filterOpen])

  useEffect(() => {
    if (!filterOpen) return
    function onDoc(e: MouseEvent) {
      const t = e.target as Node
      if (filtersRef.current?.contains(t) || filterBtnRef.current?.contains(t)) return
      setFilterOpen(false)
    }
    document.addEventListener("mousedown", onDoc)
    return () => document.removeEventListener("mousedown", onDoc)
  }, [filterOpen])

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

  const hasActiveBranchFilters = Boolean(search.trim() || isProductFiltered)

  const productSummary = useMemo(() => {
    if (!isProductFiltered || productSearchLoading) return null
    return summarizeBranchProductResults(productResults)
  }, [productResults, isProductFiltered, productSearchLoading])

  function clearProductFilter() {
    setSelectedProductId("")
    setProductSearch("")
    setProductResults([])
    setProductLookupOpen(false)
  }

  function clearBranchFilters() {
    setSearch("")
    clearProductFilter()
  }

  function handleProductDropdownChange(value: string) {
    setSelectedProductId(value)
    setProductSearch("")
    if (value) {
      setFilterOpen(true)
      setProductLookupOpen(true)
    } else {
      setProductResults([])
      setProductLookupOpen(false)
    }
  }

  function handleProductSearchChange(value: string) {
    setProductSearch(value)
    if (value.trim()) {
      setSelectedProductId("")
      setFilterOpen(true)
      if (value.trim().length >= 2) setProductLookupOpen(true)
    }
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
    <div className="flex flex-col gap-3 min-h-0 rounded-[18px] bg-[#f5f5f7] p-3">
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-[#86868b]" />
          <p className="text-xs text-[#86868b]">Loading branches…</p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 shrink-0 justify-end">
            <button
              type="button"
              onClick={() => void handleOpenGrandInventory()}
              disabled={exportLoading || grandLoading}
              className="h-9 rounded-full px-4 text-[12px] font-semibold cursor-pointer bg-white text-[#1d1d1f] border border-black/[0.08] shadow-sm hover:bg-black/[0.03] disabled:opacity-50 inline-flex items-center gap-1.5"
            >
              {exportLoading || grandLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <FileDown className="h-3.5 w-3.5" strokeWidth={1.75} />
              )}
              Grand inventory
            </button>
            <button
              type="button"
              className="h-9 rounded-full px-4 text-[12px] font-semibold cursor-pointer bg-[#1d1d1f] hover:bg-black text-white inline-flex items-center gap-1"
              onClick={async () => {
                const code = await generateBranchCode()
                setAutoCode(code)
                setAdding(true)
                setEditId(null)
              }}
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2} />
              Add branch
            </button>
            <button
              ref={filterBtnRef}
              type="button"
              onClick={() => setFilterOpen((o) => !o)}
              className={`relative h-9 w-9 inline-flex items-center justify-center rounded-full transition-colors cursor-pointer shrink-0 ${
                filterOpen
                  ? "bg-[#1d1d1f] text-white"
                  : "text-[#86868b] hover:bg-black/[0.06] hover:text-[#1d1d1f] bg-white border border-black/[0.08]"
              }`}
              aria-label="Search and product filters"
              aria-expanded={filterOpen}
              title="Filters"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" strokeWidth={1.75} />
              {hasActiveBranchFilters && !filterOpen && (
                <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-[#007aff]" />
              )}
            </button>
          </div>

          {filterOpen &&
            filterPos &&
            typeof document !== "undefined" &&
            createPortal(
              <div
                ref={filtersRef}
                className="fixed z-[95] w-[min(19.5rem,calc(100vw-1.5rem))] max-h-[min(72vh,34rem)] overflow-y-auto scrollbar-none overscroll-contain rounded-[18px] border border-black/[0.06] bg-white/92 backdrop-blur-2xl shadow-[0_20px_60px_rgba(0,0,0,0.2)] p-3 space-y-2.5"
                style={{ top: filterPos.top, left: filterPos.left }}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[13px] font-semibold tracking-tight text-[#1d1d1f]">Filters</p>
                  <div className="flex items-center gap-2">
                    {hasActiveBranchFilters && (
                      <button type="button" onClick={clearBranchFilters} className="text-[11px] font-semibold text-[#0071e3] cursor-pointer">
                        Clear
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setFilterOpen(false)}
                      className="h-6 w-6 inline-flex items-center justify-center rounded-full bg-black/[0.06] text-[#1d1d1f] hover:bg-black/[0.1] cursor-pointer"
                      aria-label="Close filters"
                    >
                      <X className="h-3.5 w-3.5" strokeWidth={2.25} />
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-[10px] text-[#86868b]">
                  <Building2 className="h-3.5 w-3.5 shrink-0" />
                  <span className="tabular-nums">
                    <span className="font-medium text-[#1d1d1f]">{branches.length}</span> locations
                  </span>
                </div>

                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#86868b]" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search branch…"
                    className="w-full h-8 pl-8 pr-2.5 rounded-[10px] border-0 bg-[#f2f2f7] text-[12px] tracking-tight text-[#1d1d1f] placeholder:text-[#86868b] focus:outline-none focus:ring-2 focus:ring-[#0071e3]/25"
                  />
                </div>

                <div className="space-y-1.5">
                  <p className="text-[10px] font-semibold tracking-tight text-[#86868b]">Product</p>
                  <div className="relative">
                    <Package className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#86868b] pointer-events-none" />
                    <select
                      value={selectedProductId}
                      onChange={(e) => handleProductDropdownChange(e.target.value)}
                      disabled={loadingProducts}
                      className="w-full h-8 rounded-[10px] border-0 bg-[#f2f2f7] pl-8 pr-2 text-[11px] appearance-none focus:outline-none focus:ring-2 focus:ring-[#0071e3]/25 cursor-pointer text-[#1d1d1f]"
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
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#86868b]" />
                    <input
                      value={productSearch}
                      onChange={(e) => handleProductSearchChange(e.target.value)}
                      placeholder="Product or model…"
                      className="w-full h-8 pl-8 pr-2.5 rounded-[10px] border-0 bg-[#f2f2f7] text-[11px] text-[#1d1d1f] placeholder:text-[#86868b] focus:outline-none focus:ring-2 focus:ring-[#0071e3]/25"
                    />
                  </div>
                </div>

                {isProductFiltered && (
                  <div className="flex flex-wrap items-center gap-2 text-[11px]">
                    <span className="text-[#86868b] min-w-0">
                      <span className="text-[#1d1d1f] font-medium truncate inline-block max-w-full align-bottom">
                        {selectedProductOption?.displayName || productSearch.trim()}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setProductLookupOpen(true)}
                      className="text-[#0071e3] font-semibold cursor-pointer"
                    >
                      Results
                    </button>
                    <button type="button" onClick={clearProductFilter} className="text-[#86868b] hover:text-[#1d1d1f] cursor-pointer ml-auto">
                      Clear
                    </button>
                  </div>
                )}
              </div>,
              document.body,
            )}

          {branches.length === 0 && !adding && (
            <div className="flex flex-col items-center justify-center py-14 text-center gap-2 rounded-[16px] bg-white border border-black/[0.06] shadow-sm">
              <Building2 className="h-8 w-8 text-[#86868b] opacity-40" />
              <p className="text-sm font-semibold text-[#1d1d1f]">No branches yet</p>
              <p className="text-xs text-[#86868b]">Add your first branch or warehouse.</p>
            </div>
          )}

          {filteredBranches.length === 0 && branches.length > 0 && (
            <div className="rounded-[16px] bg-white border border-black/[0.06] px-4 py-8 text-center text-xs text-[#86868b] shadow-sm">
              No branches match your search.
            </div>
          )}

          {filteredBranches.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {filteredBranches.map((b) => {
                const pos = posForBranch(b.id)
                const email = pos?.email || branchPosEmail(b.code)
                const password = pos?.password || branchPosPassword(b.code)
                return (
                  <div
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
                    className="rounded-[16px] bg-white border border-black/[0.06] shadow-sm p-3.5 flex flex-col gap-2.5 cursor-pointer hover:shadow-md transition-shadow text-left min-w-0"
                  >
                    <div className="flex items-start justify-between gap-2 min-w-0">
                      <div className="min-w-0 flex-1">
                        <p className="text-[15px] font-semibold text-[#1d1d1f] truncate leading-tight">{b.name}</p>
                        <p className="text-[11px] font-mono text-[#86868b] mt-1">{b.code}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-[#86868b] mt-0.5" strokeWidth={2} />
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-[#f2f2f7] text-[#1d1d1f]">
                        {formatBranchType(b.type)}
                      </span>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${
                          b.status === "active"
                            ? "bg-[#e8f7f6] text-[#17857f]"
                            : "bg-[#f2f2f7] text-[#86868b]"
                        }`}
                      >
                        {b.status}
                      </span>
                    </div>
                    {b.manager ? (
                      <p className="text-[11px] text-[#86868b]">
                        <span className="text-[#aeaeb2]">Manager</span>{" "}
                        <span className="text-[#1d1d1f]">{b.manager}</span>
                      </p>
                    ) : null}
                    <div className="pt-1 border-t border-black/[0.06]">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-[#86868b] mb-1">POS login</p>
                      <div onClick={(e) => e.stopPropagation()}>
                        <PosLoginCredentials email={email} password={password} onCopy={copyPosCredential} />
                      </div>
                    </div>
                    <div className="flex items-center justify-end gap-1 pt-0.5" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className="h-8 w-8 inline-flex items-center justify-center rounded-full text-[#86868b] hover:bg-black/[0.06] hover:text-[#1d1d1f] cursor-pointer"
                        title="Export inventory PDF"
                        aria-label="Export inventory PDF"
                        onClick={async () => {
                          const inv = await getBranchInventory(b.id)
                          generateSingleBranchPdf(b, inv)
                        }}
                      >
                        <FileDown className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        className="h-8 w-8 inline-flex items-center justify-center rounded-full text-[#86868b] hover:bg-red-50 hover:text-red-600 cursor-pointer"
                        title="Delete branch"
                        aria-label="Delete branch"
                        onClick={() => handleDelete(b.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* Product lookup across branches */}
      {productLookupOpen &&
        isProductFiltered &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-xl p-3 sm:p-6"
            onClick={() => setProductLookupOpen(false)}
          >
            <div
              className="w-full max-w-4xl rounded-[20px] border border-black/[0.06] bg-white overflow-hidden flex flex-col shadow-[0_24px_80px_rgba(0,0,0,0.25)]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-black/[0.06] shrink-0">
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold text-[#1d1d1f] truncate">
                    {selectedProductOption?.displayName || productResults[0]?.itemName || productSearch.trim()}
                  </p>
                  <p className="text-[11px] font-mono text-[#86868b] mt-0.5 truncate">
                    {selectedProductOption?.modelKey || productResults[0]?.model || "—"}
                  </p>
                  {productSummary && !productSearchLoading && (
                    <p className="text-[11px] tabular-nums text-[#86868b] mt-1.5">
                      Total{" "}
                      <span className="text-[#1d1d1f] font-medium">
                        {productSummary.totalQty.toLocaleString()} {productSummary.unit}
                      </span>
                      <span className="mx-1.5">·</span>
                      Branches{" "}
                      <span className="text-[#1d1d1f] font-medium">
                        {productSummary.branchQty.toLocaleString()}
                      </span>
                      <span className="mx-1.5">·</span>
                      Main WH{" "}
                      <span className="text-[#1d1d1f] font-medium">
                        {productSummary.mainWarehouseQty.toLocaleString()}
                      </span>
                      <span className="mx-1.5">·</span>
                      <span className="text-[#1d1d1f] font-medium">
                        {productSummary.locationCount}
                      </span>{" "}
                      locations
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    className="h-8 px-3 rounded-full text-[11px] font-semibold text-[#0071e3] hover:bg-black/[0.05] cursor-pointer"
                    onClick={clearProductFilter}
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    className="h-8 w-8 inline-flex items-center justify-center rounded-full bg-black/[0.06] text-[#1d1d1f] hover:bg-black/[0.1] cursor-pointer"
                    title="Close"
                    aria-label="Close"
                    onClick={() => setProductLookupOpen(false)}
                  >
                    <X className="h-4 w-4" strokeWidth={2.25} />
                  </button>
                </div>
              </div>

              <div className="p-3">
                {productSearchLoading ? (
                  <div className="flex items-center justify-center gap-2 py-10 text-xs text-[#86868b]">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Searching branches…
                  </div>
                ) : productResults.length === 0 ? (
                  <p className="text-xs text-[#86868b] text-center py-10">
                    No branches have this product in stock.
                  </p>
                ) : (
                  <div className="rounded-[12px] border border-black/[0.06] overflow-hidden bg-[#f5f5f7]/40">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-black/[0.06] text-left text-[10px] uppercase tracking-wide text-[#86868b] bg-white/80">
                          <th className="px-3 py-1.5 font-medium">Branch</th>
                          <th className="px-3 py-1.5 font-medium">Code</th>
                          <th className="px-3 py-1.5 font-medium">Type</th>
                          <th className="px-3 py-1.5 font-medium text-right">Qty</th>
                        </tr>
                      </thead>
                      <tbody>
                        {productResults.map((row) => (
                          <tr
                            key={`${row.branchId}-${row.model}-${row.quantity}`}
                            className="border-b border-black/[0.06] last:border-b-0 hover:bg-white/90 cursor-pointer bg-white"
                            onClick={() => {
                              const branch = branches.find((b) => b.id === row.branchId)
                              if (branch) {
                                setProductLookupOpen(false)
                                setViewBranch(branch)
                                setEditId(null)
                              }
                            }}
                          >
                            <td className="px-3 py-1.5 text-[#1d1d1f]">{row.branchName}</td>
                            <td className="px-3 py-1.5 font-mono text-[#86868b]">{row.branchCode}</td>
                            <td className="px-3 py-1.5 text-[#86868b]">
                              {row.branchType === "main_warehouse"
                                ? "Main warehouse"
                                : formatBranchType(row.branchType as Branch["type"])}
                            </td>
                            <td className="px-3 py-1.5 text-right tabular-nums font-medium text-[#1d1d1f]">
                              {row.quantity.toLocaleString()} {row.unit}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <p className="text-[10px] text-[#86868b] mt-2">
                  Tap a row to open that branch.
                </p>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* Add modal */}
      {adding &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-xl p-4"
            onClick={() => setAdding(false)}
          >
            <div
              className="w-full max-w-lg rounded-[20px] border border-black/[0.06] bg-white overflow-hidden shadow-[0_24px_80px_rgba(0,0,0,0.25)]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-black/[0.06]">
                <p className="text-[17px] font-semibold tracking-tight text-[#1d1d1f]">Add branch</p>
                <button
                  type="button"
                  className="h-8 w-8 inline-flex items-center justify-center rounded-full bg-black/[0.06] text-[#1d1d1f] hover:bg-black/[0.1] cursor-pointer"
                  onClick={() => setAdding(false)}
                  aria-label="Close"
                >
                  <X className="h-4 w-4" strokeWidth={2.25} />
                </button>
              </div>
              <div className="p-5 max-h-[min(85vh,720px)] overflow-y-auto">
                <BranchForm initial={empty(autoCode)} onSave={handleAdd} onCancel={() => setAdding(false)} isLoading={saving} autoGenerated={!!autoCode} />
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* Edit modal */}
      {editId &&
        editingBranch &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-xl p-4"
            onClick={() => setEditId(null)}
          >
            <div
              className="w-full max-w-lg rounded-[20px] border border-black/[0.06] bg-white overflow-hidden shadow-[0_24px_80px_rgba(0,0,0,0.25)]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-black/[0.06]">
                <p className="text-[17px] font-semibold tracking-tight text-[#1d1d1f]">Edit branch</p>
                <button
                  type="button"
                  className="h-8 w-8 inline-flex items-center justify-center rounded-full bg-black/[0.06] text-[#1d1d1f] hover:bg-black/[0.1] cursor-pointer"
                  onClick={() => setEditId(null)}
                  aria-label="Close"
                >
                  <X className="h-4 w-4" strokeWidth={2.25} />
                </button>
              </div>
              <div className="p-5 max-h-[min(85vh,720px)] overflow-y-auto">
                <BranchForm
                  initial={{ name: editingBranch.name, code: editingBranch.code, type: editingBranch.type, address: editingBranch.address, city: editingBranch.city, country: editingBranch.country, phone: editingBranch.phone, email: editingBranch.email, manager: editingBranch.manager, status: editingBranch.status, notes: editingBranch.notes }}
                  onSave={data => handleEdit(editId, data)}
                  onCancel={() => setEditId(null)}
                  isLoading={saving}
                  autoGenerated={false}
                />
              </div>
            </div>
          </div>,
          document.body,
        )}

      {exportPreviewOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-xl p-2 sm:p-3"
            onClick={() => setExportPreviewOpen(false)}
          >
            <div
              className="w-[min(98vw,1400px)] h-[min(96vh,980px)] rounded-[20px] border border-black/[0.06] bg-white overflow-hidden flex flex-col shadow-[0_24px_80px_rgba(0,0,0,0.25)]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-black/[0.06] shrink-0">
                <div className="min-w-0">
                  <p className="text-[17px] font-semibold tracking-tight text-[#1d1d1f]">Grand inventory</p>
                  {grandSummary && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="rounded-full bg-[#f2f2f7] px-2.5 py-1 text-[11px] tabular-nums text-[#86868b]">
                        Products{" "}
                        <span className="font-semibold text-[#1d1d1f]">{grandSummary.productCount}</span>
                      </span>
                      <span className="rounded-full bg-[#f2f2f7] px-2.5 py-1 text-[11px] tabular-nums text-[#86868b]">
                        Total{" "}
                        <span className="font-semibold text-[#1d1d1f]">
                          {grandSummary.totalQty.toLocaleString()}
                        </span>
                      </span>
                      <span className="rounded-full bg-[#f2f2f7] px-2.5 py-1 text-[11px] tabular-nums text-[#86868b]">
                        Locations{" "}
                        <span className="font-semibold text-[#1d1d1f]">{grandSummary.locationCount}</span>
                      </span>
                      <span className="rounded-full bg-[#f2f2f7] px-2.5 py-1 text-[11px] tabular-nums text-[#86868b]">
                        Branches{" "}
                        <span className="font-semibold text-[#1d1d1f]">{grandSummary.branchCount}</span>
                      </span>
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  className="h-8 w-8 shrink-0 inline-flex items-center justify-center rounded-full bg-black/[0.06] text-[#1d1d1f] hover:bg-black/[0.1] cursor-pointer"
                  title="Close"
                  aria-label="Close"
                  onClick={() => setExportPreviewOpen(false)}
                >
                  <X className="h-4 w-4" strokeWidth={2.25} />
                </button>
              </div>

              <div className="p-4 overflow-y-auto min-h-0 flex-1 bg-[#f5f5f7]/50">
                {grandLoading ? (
                  <div className="flex items-center justify-center gap-2 py-16 text-xs text-[#86868b]">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading inventory totals…
                  </div>
                ) : exportRows.length === 0 ? (
                  <p className="text-xs text-[#86868b] text-center py-16">
                    No inventory rows found for warehouses/stores.
                  </p>
                ) : (
                  <GrandInventoryByProductList products={grandSummary?.products ?? []} />
                )}
              </div>

              <div className="px-4 py-3 border-t border-black/[0.06] bg-white flex flex-wrap justify-end gap-2 shrink-0">
                <button
                  type="button"
                  className="h-9 rounded-full px-4 text-[12px] font-semibold text-[#1d1d1f] bg-black/[0.06] hover:bg-black/[0.1] cursor-pointer"
                  onClick={() => setExportPreviewOpen(false)}
                >
                  Close
                </button>
                <CrmExcelExportButton
                  onExport={handleExportGrandExcel}
                  exporting={exportingGrandExcel}
                  disabled={exportRows.length === 0}
                  label="Export Excel"
                  className="h-9 rounded-full px-4 text-[12px] border-black/[0.08] bg-white cursor-pointer"
                />
                <button
                  type="button"
                  className="h-9 rounded-full px-4 text-[12px] font-semibold border border-black/[0.08] bg-white hover:bg-black/[0.03] cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-40"
                  onClick={() => void handleExportGrandPdf()}
                  disabled={exportRows.length === 0 || exportingGrandPdf}
                >
                  {exportingGrandPdf ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <FileDown className="h-3.5 w-3.5" />
                  )}
                  Export PDF
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}
