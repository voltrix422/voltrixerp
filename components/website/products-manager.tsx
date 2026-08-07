"use client"

import { useEffect, useRef, useState } from "react"
import {
  Loader2, Plus, Trash2, Upload, X, ImageIcon,
  Globe, EyeOff, RefreshCw, Star, Check, GripVertical, Megaphone
} from "lucide-react"
import ProductBrochureField from "@/components/website/product-brochure-field"
import ProductUserManualField from "@/components/website/product-user-manual-field"
import {
  MAIN_CATEGORIES,
  INVERTER_SUBCATEGORIES,
  resolveStoredCategory,
  splitStoredCategory,
} from "@/lib/product-categories"
import { uploadFile } from "@/lib/upload"
import type { ProductSpecRow } from "@/lib/product-specs"
import { getProductDisplayName } from "@/lib/product-display-name"

type Spec = ProductSpecRow
type StockVal = "in" | "low" | "out"

type Product = {
  id: string
  created_at: string
  name: string
  model?: string
  category: string
  description: string
  full_desc: string
  specification: string
  price: number | string
  /** Higher “was” price for cut-price / sale UI on the storefront */
  compareAtPrice?: number | string | null
  warranty: string
  stock: number | string
  specs: Spec[]
  images: string[]
  published: boolean
  unit: string
  quoteMode: boolean
  brochureUrl?: string
  brochureName?: string
  userManualUrl?: string
  userManualName?: string
  specSheetUrl?: string
  order?: number
}

const STOCK_OPTIONS = [
  { value: "in",  label: "In Stock",     cls: "text-emerald-600 bg-emerald-50 border-emerald-100" },
  { value: "low", label: "Low Stock",    cls: "text-amber-600 bg-amber-50 border-amber-100" },
  { value: "out", label: "Out of Stock", cls: "text-neutral-500 bg-neutral-100 border-neutral-200" },
]

type PendingImage = { file: File; preview: string }

const EMPTY = {
  name: "", model: "", category: "Energy Storage Battery", mainCategory: "Energy Storage Battery", subCategory: "",
  description: "", full_desc: "",
  specification: "", price: "", compareAtPrice: "", warranty: "", stock: "in",
  specs: [] as Spec[], images: [] as string[], published: false, unit: "pcs", quoteMode: false,
  brochureUrl: "", brochureName: "", userManualUrl: "", userManualName: "", specSheetUrl: "",
}

export default function ProductsManager() {
  const [products, setProducts]       = useState<Product[]>([])
  const [loading, setLoading]         = useState(true)
  const [selected, setSelected]       = useState<Product | null>(null)
  const [form, setForm]               = useState<typeof EMPTY>(EMPTY)
  const [pendingImgs, setPendingImgs] = useState<PendingImage[]>([])
  const [saving, setSaving]           = useState(false)
  const [saveError, setSaveError]     = useState("")
  const [saveOk, setSaveOk]           = useState(false)
  const [isNew, setIsNew]             = useState(false)
  const [search, setSearch]           = useState("")
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [productToDelete, setProductToDelete] = useState<Product | null>(null)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [bannerEnabled, setBannerEnabled] = useState(false)
  const [bannerProductId, setBannerProductId] = useState<string>("")
  const [bannerSaving, setBannerSaving] = useState(false)
  const [bannerOk, setBannerOk] = useState(false)
  const fileRef                       = useRef<HTMLInputElement>(null)
  const dragIdx                       = useRef<number | null>(null)

  const fetchAll = async () => {
    setLoading(true)
    try {
      const [productsRes, bannerRes] = await Promise.all([
        fetch('/api/products'),
        fetch('/api/site/banner'),
      ])
      const data = await productsRes.json()
      const sorted = (data || []).sort((a: any, b: any) => (a.order || 0) - (b.order || 0))
      setProducts(sorted)

      if (bannerRes.ok) {
        const banner = await bannerRes.json()
        setBannerEnabled(Boolean(banner.enabled))
        setBannerProductId(banner.productId ? String(banner.productId) : "")
      }
    } catch (error) {
      console.error('Error fetching products:', error)
      setProducts([])
    }
    setLoading(false)
  }

  useEffect(() => { fetchAll() }, [])

  const pick = (p: Product) => {
    setSelected(p)
    // Convert stock number to string for form
    let stockStr = "in"
    if (typeof p.stock === "number") {
      stockStr = p.stock > 0 ? "in" : p.stock === 0 ? "low" : "out"
    } else {
      stockStr = String(p.stock)
    }
    
    const { main, sub } = splitStoredCategory(p.category || "")
    const { title, model } = getProductDisplayName({
      name: p.name || "",
      model: p.model,
    })
    setForm({
      name: title, model: model || p.model || "", category: p.category || main,
      mainCategory: main, subCategory: sub,
      description: p.description || "", full_desc: p.full_desc || "",
      specification: p.specification || "", price: String(p.price ?? ""),
      compareAtPrice: String(p.compareAtPrice ?? ""),
      warranty: p.warranty || "", stock: stockStr,
      specs: Array.isArray(p.specs) ? p.specs : [],
      images: Array.isArray(p.images) ? p.images : [],
      published: p.published || false, unit: p.unit || "pcs", quoteMode: p.quoteMode || false,
      brochureUrl: p.brochureUrl || "",
      brochureName: p.brochureName || "",
      userManualUrl: p.userManualUrl || "",
      userManualName: p.userManualName || "",
      specSheetUrl: p.specSheetUrl || "",
    })
    setPendingImgs([])
    setIsNew(false)
    setSaveError(""); setSaveOk(false)
  }

  const startNew = () => {
    setSelected(null); setForm(EMPTY); setPendingImgs([])
    setIsNew(true); setSaveError(""); setSaveOk(false)
  }

  // ── pending image pick ─────────────────────────────────
  const addPending = (files: FileList) => {
    const imgs = Array.from(files).map(f => ({ file: f, preview: URL.createObjectURL(f) }))
    setPendingImgs(p => [...p, ...imgs])
    if (fileRef.current) fileRef.current.value = ""
  }

  const removePending = (i: number) => {
    setPendingImgs(p => { URL.revokeObjectURL(p[i].preview); return p.filter((_, j) => j !== i) })
  }

  // ── drag reorder pending ───────────────────────────────
  const onDragStart = (i: number) => { dragIdx.current = i }
  const onDrop = (i: number) => {
    const from = dragIdx.current
    if (from === null || from === i) return
    setPendingImgs(p => { const a = [...p]; const [x] = a.splice(from, 1); a.splice(i, 0, x); return a })
    dragIdx.current = null
  }

  // ── drag reorder saved images ──────────────────────────
  const savedDragIdx = useRef<number | null>(null)
  const onSavedDragStart = (i: number) => { savedDragIdx.current = i }
  const onSavedDrop = (i: number) => {
    const from = savedDragIdx.current
    if (from === null || from === i) return
    const imgs = [...form.images]
    const [x] = imgs.splice(from, 1)
    imgs.splice(i, 0, x)
    setForm(f => ({ ...f, images: imgs }))
    savedDragIdx.current = null
  }

  // ── upload to storage ──────────────────────────────────
  const uploadToStorage = async (files: PendingImage[]): Promise<string[]> => {
    const formData = new FormData()
    files.forEach(({ file }) => formData.append('files', file))
    formData.append('folder', 'products')

    const res = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    })

    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new Error(data?.error || 'Upload failed')
    }

    const urls = Array.isArray(data?.urls) ? data.urls : []
    if (urls.length !== files.length) {
      throw new Error("Some images were not uploaded. Please try again.")
    }
    return urls
  }

  // ── save ───────────────────────────────────────────────
  const save = async (publishOverride?: boolean, closeAfter = false) => {
    if (!form.name.trim()) { setSaveError("Product name is required."); return }
    setSaving(true); setSaveError(""); setSaveOk(false)

    try {
      // Upload pending images first
      let newUrls: string[] = []
      if (pendingImgs.length > 0) {
        newUrls = await uploadToStorage(pendingImgs)
        if (newUrls.length === 0) {
          throw new Error("Image upload failed. Product was not saved.")
        }
      }

      const allImages = [...form.images, ...newUrls]
      const published = publishOverride !== undefined ? publishOverride : form.published

      const category = resolveStoredCategory(form.mainCategory, form.subCategory)
      const payload = {
        name: form.name.trim(),
        model: form.model.trim(),
        category, description: form.description,
        full_desc: form.full_desc, specification: form.specification,
        price: form.price || 0,
        compareAtPrice: form.compareAtPrice ? Number(form.compareAtPrice) || form.compareAtPrice : "",
        warranty: form.warranty,
        stock: form.stock === "in" ? 1 : form.stock === "low" ? 0 : -1,
        specs: form.specs, images: allImages, published, unit: form.unit, quoteMode: form.quoteMode,
        brochureUrl: form.brochureUrl, brochureName: form.brochureName,
        userManualUrl: form.userManualUrl, userManualName: form.userManualName,
        specSheetUrl: form.specSheetUrl,
        terms: "",
        termsUseCustom: false,
        termsTemplateId: "",
        termsFile: "",
      }

      const parseApiError = async (res: Response, fallback: string) => {
        const data = await res.json().catch(() => ({}))
        return String(data?.error || data?.message || fallback)
      }

      if (isNew) {
        const res = await fetch('/api/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, created_by: "admin" }),
        })
        
        if (!res.ok) throw new Error(await parseApiError(res, 'Failed to create product'))
        
        const p = await res.json()
        setProducts(prev => [p, ...prev])
        
        if (closeAfter) {
          // Close the form and show the product in sidebar
          setSelected(null)
          setIsNew(false)
          setForm(EMPTY)
          setPendingImgs([])
        } else {
          setSelected(p)
          setForm(f => ({ ...f, images: allImages, published }))
          setPendingImgs([])
          setIsNew(false)
        }
      } else if (selected) {
        const res = await fetch('/api/products', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, id: selected.id }),
        })
        
        if (!res.ok) throw new Error(await parseApiError(res, 'Failed to update product'))
        
        const updated = await res.json()
        setProducts(prev => prev.map(x => x.id === selected.id ? updated : x))
        
        if (closeAfter) {
          // Close the form
          setSelected(null)
          setForm(EMPTY)
          setPendingImgs([])
        } else {
          setSelected(updated)
          setForm(f => ({ ...f, images: allImages, published }))
          setPendingImgs([])
        }
      }

      setSaveOk(true)
      setTimeout(() => setSaveOk(false), 3000)
    } catch (error: any) {
      setSaveError(error.message || 'Failed to save product')
    } finally {
      setSaving(false)
    }
  }

  // ── delete product ─────────────────────────────────────
  const deleteProduct = (product: Product) => {
    setProductToDelete(product)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = async () => {
    if (!productToDelete) return
    try {
      await fetch(`/api/products?id=${productToDelete.id}`, { method: 'DELETE' })
      setProducts(prev => prev.filter(x => x.id !== productToDelete.id))
      if (selected?.id === productToDelete.id) { setSelected(null); setIsNew(false) }
    } catch (error) {
      console.error('Error deleting product:', error)
    }
    setDeleteDialogOpen(false)
    setProductToDelete(null)
  }

  // ── remove saved image ─────────────────────────────────
  const removeSavedImage = (i: number) => {
    setForm(f => ({ ...f, images: f.images.filter((_, j) => j !== i) }))
  }

  // ── spec helpers ───────────────────────────────────────
  const addSpec = () => setForm(f => ({ ...f, specs: [...f.specs, { label: "", value: "", imageUrl: "" }] }))
  const delSpec = (i: number) => setForm(f => ({ ...f, specs: f.specs.filter((_, j) => j !== i) }))
  const setSpec = (i: number, k: keyof Spec, v: string) =>
    setForm(f => ({ ...f, specs: f.specs.map((s, j) => j === i ? { ...s, [k]: v } : s) }))

  const uploadSpecAsset = async (file: File, onUrl: (url: string) => void) => {
    try {
      const url = await uploadFile(file, "products")
      onUrl(url)
    } catch {
      setSaveError("Spec image upload failed.")
    }
  }

  const filtered = products.filter(p =>
    (p.name || "").toLowerCase().includes(search.toLowerCase()) ||
    (p.model || "").toLowerCase().includes(search.toLowerCase()) ||
    (p.category || "").toLowerCase().includes(search.toLowerCase())
  )

  const handleDragStart = (index: number) => {
    setDraggedIndex(index)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = (dropIndex: number) => {
    if (draggedIndex === null || draggedIndex === dropIndex) return
    
    const newProducts = [...products]
    const [draggedItem] = newProducts.splice(draggedIndex, 1)
    newProducts.splice(dropIndex, 0, draggedItem)
    
    setProducts(newProducts)
    setDraggedIndex(null)
    
    // Save new order to API
    fetch('/api/products?action=reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productIds: newProducts.map(p => p.id) })
    }).catch(err => console.error('Error saving order:', err))
  }

  const saveBanner = async () => {
    if (bannerEnabled && !bannerProductId) {
      setSaveError("Select a product for the homepage popup banner.")
      return
    }
    setBannerSaving(true)
    setBannerOk(false)
    try {
      const res = await fetch('/api/site/banner', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: bannerEnabled,
          productId: bannerProductId || null,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(String(data?.error || 'Failed to save banner settings'))
      }
      setBannerOk(true)
      setTimeout(() => setBannerOk(false), 3000)
    } catch (error: unknown) {
      setSaveError(error instanceof Error ? error.message : 'Failed to save banner settings')
    } finally {
      setBannerSaving(false)
    }
  }

  const setProductAsBanner = (productId: string) => {
    setBannerProductId(productId)
    setBannerEnabled(true)
  }

  const allImages = [...form.images, ...pendingImgs.map(p => p.preview)]

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Homepage popup banner settings */}
      <div className="shrink-0 border-b bg-gradient-to-r from-teal-50/80 via-white to-emerald-50/50 px-4 py-3">
        <div className="flex flex-wrap items-center gap-3 max-w-5xl">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1a9f9a]/10 text-[#1a9f9a] shrink-0">
              <Megaphone className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold">Homepage popup banner</p>
              <p className="text-[11px] text-muted-foreground truncate">
                Big product popup on the main website — image, specs, pricing & spec sheet
              </p>
            </div>
          </div>

          <label className="inline-flex items-center gap-2 text-xs font-medium cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={bannerEnabled}
              onChange={e => setBannerEnabled(e.target.checked)}
              className="rounded border-neutral-300 text-[#1a9f9a] focus:ring-[#1a9f9a]"
            />
            Enable popup
          </label>

          <select
            value={bannerProductId}
            onChange={e => setBannerProductId(e.target.value)}
            className="h-8 min-w-[180px] flex-1 max-w-xs rounded-lg border bg-white px-3 text-xs outline-none focus:border-[#1a9f9a]"
          >
            <option value="">Select product…</option>
            {products.filter(p => p.published).map(p => {
              const display = getProductDisplayName({ name: p.name, model: p.model })
              return (
                <option key={p.id} value={p.id}>
                  {display.title}{display.model ? ` · ${display.model}` : ""}
                </option>
              )
            })}
          </select>

          {selected && selected.published && bannerProductId !== selected.id && (
            <button
              type="button"
              onClick={() => setProductAsBanner(selected.id)}
              className="text-[11px] font-medium text-[#1a9f9a] hover:underline shrink-0"
            >
              Use selected product
            </button>
          )}

          <button
            type="button"
            onClick={saveBanner}
            disabled={bannerSaving}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60 shrink-0"
            style={{ backgroundColor: "#1a9f9a" }}
          >
            {bannerSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            Save banner
          </button>

          {bannerOk && (
            <span className="text-[11px] font-medium text-emerald-600 shrink-0">Banner saved</span>
          )}
        </div>
      </div>

    <div className="flex flex-1 overflow-hidden">

      {/* ── Sidebar ── */}
      <div className="w-72 shrink-0 border-r flex flex-col overflow-hidden">
        <div className="px-3 py-3 border-b space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Products <span className="text-muted-foreground font-normal">({products.length})</span></p>
            <div className="flex items-center gap-1">
              <button onClick={fetchAll} className="p-1.5 rounded-lg hover:bg-accent transition-colors">
                <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
              <button onClick={startNew} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-white" style={{ backgroundColor: "#1a9f9a" }}>
                <Plus className="w-3.5 h-3.5" /> New
              </button>
            </div>
          </div>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
            className="w-full h-8 px-3 rounded-lg border text-xs outline-none focus:border-[#1a9f9a]" />
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : filtered.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground">No products found</div>
        ) : (
          <div className="flex-1 overflow-y-auto divide-y">
            {filtered.map((p, index) => {
              const display = getProductDisplayName({ name: p.name, model: p.model })
              return (
              <button
                key={p.id}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={handleDragOver}
                onDrop={() => handleDrop(index)}
                onClick={() => pick(p)}
                className={`w-full text-left px-3 py-2.5 hover:bg-accent transition-colors flex items-center gap-3 ${selected?.id === p.id ? "bg-accent" : ""} ${draggedIndex === index ? "opacity-50" : ""} cursor-grab active:cursor-grabbing`}
              >
                <GripVertical className="w-4 h-4 text-neutral-300 shrink-0" />
                <div className="w-10 h-10 rounded-lg border bg-neutral-50 shrink-0 overflow-hidden flex items-center justify-center">
                  {p.images?.[0]
                    ? <img src={p.images[0]} alt="" className="w-full h-full object-contain p-1" onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }} />
                    : <ImageIcon className="w-4 h-4 text-muted-foreground opacity-30" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{display.title}</p>
                  {display.model ? (
                    <p className="text-[11px] font-mono text-muted-foreground truncate">{display.model}</p>
                  ) : null}
                  <p className="text-xs text-muted-foreground">{p.category}</p>
                </div>
                {p.published
                  ? <Globe className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  : <EyeOff className="w-3.5 h-3.5 text-muted-foreground opacity-40 shrink-0" />}
                {bannerEnabled && bannerProductId === p.id && (
                  <span title="Homepage popup banner">
                    <Megaphone className="w-3.5 h-3.5 text-[#1a9f9a] shrink-0" />
                  </span>
                )}
              </button>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Editor ── */}
      <div className="flex-1 overflow-y-auto">
        {!selected && !isNew ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <ImageIcon className="w-10 h-10 opacity-20" />
            <p className="text-sm">Select a product or create a new one</p>
          </div>
        ) : (
          <div className="p-6 space-y-5 max-w-3xl">

            {/* Header */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <h2 className="text-base font-semibold">
                {isNew ? "New Product" : form.name || "Edit Product"}
                {form.model ? (
                  <span className="block text-xs font-mono font-normal text-muted-foreground mt-0.5">
                    {form.model}
                  </span>
                ) : null}
              </h2>
              <div className="flex items-center gap-2">
                <button onClick={() => { setSelected(null); setIsNew(false); setForm(EMPTY); setPendingImgs([]) }}
                  className="p-2 rounded-lg hover:bg-accent text-muted-foreground transition-colors">
                  <X className="w-4 h-4" />
                </button>
                {selected && (
                  <button onClick={() => deleteProduct(selected)} className="p-2 rounded-lg hover:bg-red-50 text-red-500 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <button onClick={() => save(false, false)} disabled={saving}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border hover:bg-accent disabled:opacity-60">
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  Save
                </button>
                <button onClick={() => save(true, true)} disabled={saving}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60"
                  style={{ backgroundColor: "#1a9f9a" }}>
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Globe className="w-3.5 h-3.5" />}
                  Save & Close
                </button>
              </div>
            </div>

            {/* Banners */}
            {saving && (
              <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-600 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin shrink-0" /> Saving and uploading images…
              </div>
            )}
            {saveError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 flex items-start gap-2">
                <X className="w-4 h-4 shrink-0 mt-0.5" />
                <div><p className="font-medium">Could not save</p><p className="text-xs mt-0.5">{saveError}</p></div>
              </div>
            )}
            {saveOk && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 flex items-center gap-2">
                <Check className="w-4 h-4 shrink-0" />
                {form.published ? "Product saved and published to website." : "Product saved as draft."}
              </div>
            )}

            {/* Images */}
            <div className="rounded-xl border p-5 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Images</p>
                <button onClick={() => fileRef.current?.click()}
                  className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border hover:bg-accent transition-colors">
                  <Upload className="w-3 h-3" /> Upload
                </button>
                <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
                  onChange={e => e.target.files && addPending(e.target.files)} />
              </div>

              {allImages.length === 0 ? (
                <div onClick={() => fileRef.current?.click()}
                  className="border-2 border-dashed rounded-xl p-10 text-center cursor-pointer hover:bg-accent transition-colors">
                  <Upload className="w-7 h-7 mx-auto text-muted-foreground opacity-30 mb-2" />
                  <p className="text-xs text-muted-foreground">Click to select images — drag to reorder</p>
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-3">
                  {/* Saved images */}
                  {form.images.map((url, i) => (
                    <div key={`saved-${i}`}
                      draggable onDragStart={() => onSavedDragStart(i)}
                      onDragOver={e => e.preventDefault()} onDrop={() => onSavedDrop(i)}
                      className="relative group rounded-xl overflow-hidden border aspect-square bg-neutral-50 cursor-grab active:cursor-grabbing">
                      <img src={url} alt="" className="w-full h-full object-contain p-2" />
                      <span className="absolute top-1 left-1 w-5 h-5 rounded-full bg-black/50 text-white text-[10px] font-bold flex items-center justify-center">{i + 1}</span>
                      {i === 0 && <span className="absolute bottom-1 left-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full text-white" style={{ backgroundColor: "#1a9f9a" }}>Primary</span>}
                      <button onClick={() => removeSavedImage(i)}
                        className="absolute top-1 right-1 p-1 rounded-full bg-white/90 text-red-500 opacity-0 group-hover:opacity-100 shadow-sm">
                        <Trash2 className="w-3 h-3" />
                      </button>
                      <div className="absolute bottom-1 right-1 opacity-0 group-hover:opacity-60">
                        <GripVertical className="w-3.5 h-3.5 text-white drop-shadow" />
                      </div>
                    </div>
                  ))}
                  {/* Pending images */}
                  {pendingImgs.map((img, i) => (
                    <div key={`pending-${i}`}
                      draggable onDragStart={() => onDragStart(i)}
                      onDragOver={e => e.preventDefault()} onDrop={() => onDrop(i)}
                      className="relative group rounded-xl overflow-hidden border aspect-square bg-neutral-50 cursor-grab active:cursor-grabbing ring-2 ring-[#1a9f9a]/30">
                      <img src={img.preview} alt="" className="w-full h-full object-contain p-2" />
                      <span className="absolute top-1 left-1 w-5 h-5 rounded-full bg-black/50 text-white text-[10px] font-bold flex items-center justify-center">{form.images.length + i + 1}</span>
                      <span className="absolute bottom-1 left-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-500 text-white">New</span>
                      <button onClick={() => removePending(i)}
                        className="absolute top-1 right-1 p-1 rounded-full bg-white/90 text-red-500 opacity-0 group-hover:opacity-100 shadow-sm">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  <button onClick={() => fileRef.current?.click()}
                    className="aspect-square rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1 hover:bg-accent transition-colors">
                    <Plus className="w-5 h-5 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground">Add</span>
                  </button>
                </div>
              )}
            </div>

            {/* Basic Info */}
            <div className="rounded-xl border p-5 space-y-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Basic Info</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5 col-span-2">
                  <label className="text-xs font-medium text-muted-foreground">Product Name *</label>
                  <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full h-9 px-3 rounded-lg border text-sm outline-none focus:border-[#1a9f9a]"
                    placeholder="e.g. 5 KWh Energy Storage Battery" />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <label className="text-xs font-medium text-muted-foreground">Model / SKU</label>
                  <input
                    value={form.model}
                    onChange={e => setForm(f => ({ ...f, model: e.target.value }))}
                    className="w-full h-9 px-3 rounded-lg border text-sm font-mono outline-none focus:border-[#1a9f9a]"
                    placeholder="e.g. HS-BG5000W-A6"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Shown below the product name on the public product page.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Main category</label>
                  <select
                    value={form.mainCategory}
                    onChange={e => setForm(f => ({
                      ...f,
                      mainCategory: e.target.value,
                      subCategory: e.target.value === "Inverter" ? f.subCategory : "",
                    }))}
                    className="w-full h-9 px-3 rounded-lg border text-sm outline-none focus:border-[#1a9f9a]"
                  >
                    {MAIN_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                {form.mainCategory === "Inverter" && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Inverter line (optional)</label>
                    <select
                      value={form.subCategory}
                      onChange={e => setForm(f => ({ ...f, subCategory: e.target.value }))}
                      className="w-full h-9 px-3 rounded-lg border text-sm outline-none focus:border-[#1a9f9a]"
                    >
                      <option value="">General — shows under Inverter</option>
                      {INVERTER_SUBCATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                )}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Stock Status</label>
                  <select value={form.stock} onChange={e => setForm(f => ({ ...f, stock: e.target.value }))}
                    className="w-full h-9 px-3 rounded-lg border text-sm outline-none focus:border-[#1a9f9a] bg-white">
                    {STOCK_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Pricing</label>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setForm(f => ({ ...f, quoteMode: !f.quoteMode }))}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                        form.quoteMode 
                          ? 'bg-[#1a9f9a] text-white border-[#1a9f9a]' 
                          : 'bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-50'
                      }`}
                    >
                      {form.quoteMode ? <Check className="w-4 h-4" /> : null}
                      {form.quoteMode ? 'Quote Button Enabled' : 'Add Quote Button'}
                    </button>
                  </div>
                  {form.quoteMode && (
                    <p className="text-xs text-muted-foreground mt-1">Quote button will be shown instead of price on product page</p>
                  )}
                  {!form.quoteMode && (
                    <div className="mt-2 space-y-2">
                      <div>
                        <p className="text-[10px] text-muted-foreground mb-1">Sale price (Rs.)</p>
                        <input value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                          className="w-full h-9 px-3 rounded-lg border text-sm outline-none focus:border-[#1a9f9a]" placeholder="e.g. 63000" />
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground mb-1">Cut / was price (Rs.) — optional</p>
                        <input
                          value={form.compareAtPrice}
                          onChange={e => setForm(f => ({ ...f, compareAtPrice: e.target.value }))}
                          className="w-full h-9 px-3 rounded-lg border text-sm outline-none focus:border-[#1a9f9a]"
                          placeholder="e.g. 680000 (shown crossed out)"
                        />
                        <p className="text-[10px] text-muted-foreground mt-1">
                          If higher than sale price, storefront shows ~~was~~ → sale.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Warranty</label>
                  <input value={form.warranty} onChange={e => setForm(f => ({ ...f, warranty: e.target.value }))}
                    className="w-full h-9 px-3 rounded-lg border text-sm outline-none focus:border-[#1a9f9a]" placeholder="e.g. 5 years" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Short Description</label>
                <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full h-9 px-3 rounded-lg border text-sm outline-none focus:border-[#1a9f9a]" placeholder="One-line summary" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Full Description</label>
                <textarea rows={4} value={form.full_desc} onChange={e => setForm(f => ({ ...f, full_desc: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border text-sm outline-none focus:border-[#1a9f9a] resize-none" placeholder="Detailed description for product page" />
              </div>
            </div>

            <ProductBrochureField
              value={{
                brochureUrl: form.brochureUrl,
                brochureName: form.brochureName,
              }}
              onChange={(brochureValue) => setForm((current) => ({ ...current, ...brochureValue }))}
            />

            <ProductUserManualField
              value={{
                userManualUrl: form.userManualUrl,
                userManualName: form.userManualName,
              }}
              onChange={(userManualValue) => setForm((current) => ({ ...current, ...userManualValue }))}
            />

            {/* Specs */}
            <div className="rounded-xl border p-5 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Specifications</p>
                <button type="button" onClick={addSpec} className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg border hover:bg-accent">
                  <Plus className="w-3 h-3" /> Add row
                </button>
              </div>

              <div className="space-y-2 rounded-lg border border-dashed p-3 bg-neutral-50/80">
                <p className="text-xs font-medium text-muted-foreground">Full specification sheet image</p>
                <p className="text-[10px] text-muted-foreground">Shown in the specs popup on the website and included in the PDF download.</p>
                {form.specSheetUrl ? (
                  <div className="flex items-start gap-3">
                    <div className="relative w-28 h-28 rounded-lg overflow-hidden border bg-white shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={form.specSheetUrl} alt="Spec sheet" className="w-full h-full object-contain" />
                    </div>
                    <button
                      type="button"
                      onClick={() => setForm(f => ({ ...f, specSheetUrl: "" }))}
                      className="text-xs text-red-500 hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium cursor-pointer hover:bg-white">
                    <Upload className="w-3.5 h-3.5" />
                    Upload spec sheet
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={e => {
                        const file = e.target.files?.[0]
                        if (file) uploadSpecAsset(file, url => setForm(f => ({ ...f, specSheetUrl: url })))
                        e.target.value = ""
                      }}
                    />
                  </label>
                )}
              </div>

              {form.specs.length === 0
                ? <p className="text-xs text-muted-foreground">No spec rows yet — click Add row for label/value pairs.</p>
                : <div className="space-y-3">
                    {form.specs.map((s, i) => (
                      <div key={i} className="rounded-lg border p-3 space-y-2 bg-white">
                        <div className="flex items-center gap-2">
                          <input value={s.label} onChange={e => setSpec(i, "label", e.target.value)}
                            className="flex-1 h-8 px-3 rounded-lg border text-xs outline-none focus:border-[#1a9f9a]" placeholder="Label" />
                          <input value={s.value} onChange={e => setSpec(i, "value", e.target.value)}
                            className="flex-1 h-8 px-3 rounded-lg border text-xs outline-none focus:border-[#1a9f9a]" placeholder="Value" />
                          <button type="button" onClick={() => delSpec(i)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          {s.imageUrl ? (
                            <>
                              <div className="relative w-16 h-16 rounded border overflow-hidden">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={s.imageUrl} alt="" className="w-full h-full object-cover" />
                              </div>
                              <button
                                type="button"
                                onClick={() => setSpec(i, "imageUrl", "")}
                                className="text-[10px] text-red-500"
                              >
                                Remove image
                              </button>
                            </>
                          ) : (
                            <label className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded border cursor-pointer hover:bg-neutral-50">
                              <ImageIcon className="w-3 h-3" /> Row image
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={e => {
                                  const file = e.target.files?.[0]
                                  if (file) uploadSpecAsset(file, url => setSpec(i, "imageUrl", url))
                                  e.target.value = ""
                                }}
                              />
                            </label>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>}
            </div>

            {/* Bottom bar */}
            <div className="flex items-center justify-between gap-3 pt-2 pb-8">
              <button onClick={() => { setSelected(null); setIsNew(false); setForm(EMPTY); setPendingImgs([]) }}
                className="px-4 py-2 rounded-lg text-sm font-medium border hover:bg-accent">
                Close
              </button>
              <div className="flex items-center gap-3">
                {selected && (
                  <button onClick={() => deleteProduct(selected)}
                    className="px-4 py-2 rounded-lg text-sm font-medium text-red-500 border border-red-100 hover:bg-red-50">
                    Delete product
                  </button>
                )}
                <button onClick={() => save(false, false)} disabled={saving}
                  className="px-4 py-2 rounded-lg text-sm font-medium border hover:bg-accent disabled:opacity-60">
                  Save
                </button>
                <button onClick={() => save(true, true)} disabled={saving}
                  className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60"
                  style={{ backgroundColor: "#1a9f9a" }}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
                  Save & Close
                </button>
              </div>
            </div>

          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      {deleteDialogOpen && productToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-neutral-900 mb-2">Delete Product</h3>
            <p className="text-sm text-neutral-600 mb-4">
              Are you sure you want to delete <span className="font-medium text-neutral-900">"{productToDelete.name}"</span>? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setDeleteDialogOpen(false); setProductToDelete(null) }}
                className="px-4 py-2 rounded-lg text-sm font-medium text-neutral-600 border border-neutral-200 hover:bg-neutral-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-500 hover:bg-red-600"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </div>
  )
}
