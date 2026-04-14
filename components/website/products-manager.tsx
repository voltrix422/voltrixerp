"use client"

import { useEffect, useRef, useState } from "react"
import { supabase } from "@/lib/supabase"
import {
  Loader2, Plus, Trash2, Upload, X, ImageIcon,
  Globe, EyeOff, RefreshCw, Star, Check, GripVertical
} from "lucide-react"

type Spec = { label: string; value: string }
type StockVal = "in" | "low" | "out"

type Product = {
  id: string
  created_at: string
  name: string
  category: string
  description: string
  full_desc: string
  specification: string
  price: number | string
  warranty: string
  stock: number | string
  specs: Spec[]
  images: string[]
  published: boolean
  unit: string
}

const CATEGORIES = ["Residential", "Industrial", "EV", "BMS"]
const STOCK_OPTIONS = [
  { value: "in",  label: "In Stock",     cls: "text-emerald-600 bg-emerald-50 border-emerald-100" },
  { value: "low", label: "Low Stock",    cls: "text-amber-600 bg-amber-50 border-amber-100" },
  { value: "out", label: "Out of Stock", cls: "text-neutral-500 bg-neutral-100 border-neutral-200" },
]

type PendingImage = { file: File; preview: string }

const EMPTY = {
  name: "", category: "Residential", description: "", full_desc: "",
  specification: "", price: "", warranty: "", stock: "in",
  specs: [] as Spec[], images: [] as string[], published: false, unit: "pcs",
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
  const fileRef                       = useRef<HTMLInputElement>(null)
  const dragIdx                       = useRef<number | null>(null)

  const fetchAll = async () => {
    setLoading(true)
    const { data } = await supabase.from("products").select("*").order("created_at", { ascending: false })
    setProducts((data as Product[]) || [])
    setLoading(false)
  }

  useEffect(() => { fetchAll() }, [])

  const pick = (p: Product) => {
    setSelected(p)
    setForm({
      name: p.name || "", category: p.category || "Residential",
      description: p.description || "", full_desc: p.full_desc || "",
      specification: p.specification || "", price: String(p.price ?? ""),
      warranty: p.warranty || "", stock: String(p.stock ?? "in"),
      specs: Array.isArray(p.specs) ? p.specs : [],
      images: Array.isArray(p.images) ? p.images : [],
      published: p.published || false, unit: p.unit || "pcs",
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
    const urls: string[] = []
    for (let i = 0; i < files.length; i++) {
      const { file } = files[i]
      const ext  = file.name.split(".").pop()
      const path = `products/${Date.now()}-${i}.${ext}`
      const { error } = await supabase.storage.from("product-images").upload(path, file)
      if (error) continue
      const { data: { publicUrl } } = supabase.storage.from("product-images").getPublicUrl(path)
      urls.push(publicUrl)
    }
    return urls
  }

  // ── save ───────────────────────────────────────────────
  const save = async (publishOverride?: boolean) => {
    if (!form.name.trim()) { setSaveError("Product name is required."); return }
    setSaving(true); setSaveError(""); setSaveOk(false)

    // Upload pending images first
    let newUrls: string[] = []
    if (pendingImgs.length > 0) {
      newUrls = await uploadToStorage(pendingImgs)
    }

    const allImages = [...form.images, ...newUrls]
    const published = publishOverride !== undefined ? publishOverride : form.published

    const payload = {
      name: form.name, category: form.category, description: form.description,
      full_desc: form.full_desc, specification: form.specification,
      price: form.price || 0, warranty: form.warranty,
      stock: form.stock === "in" ? 1 : form.stock === "low" ? 0 : -1,
      specs: form.specs, images: allImages, published, unit: form.unit,
    }

    if (isNew) {
      const { data, error } = await supabase.from("products").insert([{ ...payload, id: crypto.randomUUID(), created_by: "admin" }]).select().single()
      if (error) { setSaveError(error.message); setSaving(false); return }
      const p = data as Product
      setProducts(prev => [p, ...prev])
      setSelected(p)
      setForm(f => ({ ...f, images: allImages, published }))
      setPendingImgs([])
      setIsNew(false)
    } else if (selected) {
      const { error } = await supabase.from("products").update(payload).eq("id", selected.id)
      if (error) { setSaveError(error.message); setSaving(false); return }
      const updated = { ...selected, ...payload }
      setProducts(prev => prev.map(x => x.id === selected.id ? updated : x))
      setSelected(updated)
      setForm(f => ({ ...f, images: allImages, published }))
      setPendingImgs([])
    }

    setSaveOk(true)
    setTimeout(() => setSaveOk(false), 3000)
    setSaving(false)
  }

  // ── delete product ─────────────────────────────────────
  const deleteProduct = async (id: string) => {
    if (!confirm("Delete this product?")) return
    await supabase.from("products").delete().eq("id", id)
    setProducts(prev => prev.filter(x => x.id !== id))
    if (selected?.id === id) { setSelected(null); setIsNew(false) }
  }

  // ── remove saved image ─────────────────────────────────
  const removeSavedImage = (i: number) => {
    setForm(f => ({ ...f, images: f.images.filter((_, j) => j !== i) }))
  }

  // ── spec helpers ───────────────────────────────────────
  const addSpec = () => setForm(f => ({ ...f, specs: [...f.specs, { label: "", value: "" }] }))
  const delSpec = (i: number) => setForm(f => ({ ...f, specs: f.specs.filter((_, j) => j !== i) }))
  const setSpec = (i: number, k: "label"|"value", v: string) =>
    setForm(f => ({ ...f, specs: f.specs.map((s, j) => j === i ? { ...s, [k]: v } : s) }))

  const filtered = products.filter(p =>
    (p.name || "").toLowerCase().includes(search.toLowerCase()) ||
    (p.category || "").toLowerCase().includes(search.toLowerCase())
  )

  const allImages = [...form.images, ...pendingImgs.map(p => p.preview)]

  return (
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
            {filtered.map(p => (
              <button key={p.id} onClick={() => pick(p)}
                className={`w-full text-left px-3 py-2.5 hover:bg-accent transition-colors flex items-center gap-3 ${selected?.id === p.id ? "bg-accent" : ""}`}>
                <div className="w-10 h-10 rounded-lg border bg-neutral-50 shrink-0 overflow-hidden flex items-center justify-center">
                  {p.images?.[0]
                    ? <img src={p.images[0]} alt="" className="w-full h-full object-contain p-1" />
                    : <ImageIcon className="w-4 h-4 text-muted-foreground opacity-30" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.category}</p>
                </div>
                {p.published
                  ? <Globe className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  : <EyeOff className="w-3.5 h-3.5 text-muted-foreground opacity-40 shrink-0" />}
              </button>
            ))}
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
              <h2 className="text-base font-semibold">{isNew ? "New Product" : form.name || "Edit Product"}</h2>
              <div className="flex items-center gap-2">
                {selected && (
                  <button onClick={() => deleteProduct(selected.id)} className="p-2 rounded-lg hover:bg-red-50 text-red-500 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <button onClick={() => save(false)} disabled={saving}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border hover:bg-accent disabled:opacity-60">
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  Save draft
                </button>
                <button onClick={() => save(true)} disabled={saving}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60"
                  style={{ backgroundColor: "#1a9f9a" }}>
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Globe className="w-3.5 h-3.5" />}
                  Save & Publish
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
                    className="w-full h-9 px-3 rounded-lg border text-sm outline-none focus:border-[#1a9f9a]" placeholder="e.g. WL-5" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Category</label>
                  <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                    className="w-full h-9 px-3 rounded-lg border text-sm outline-none focus:border-[#1a9f9a] bg-white">
                    {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Stock Status</label>
                  <select value={form.stock} onChange={e => setForm(f => ({ ...f, stock: e.target.value }))}
                    className="w-full h-9 px-3 rounded-lg border text-sm outline-none focus:border-[#1a9f9a] bg-white">
                    {STOCK_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Price</label>
                  <input value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                    className="w-full h-9 px-3 rounded-lg border text-sm outline-none focus:border-[#1a9f9a]" placeholder="e.g. 210000" />
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

            {/* Specs */}
            <div className="rounded-xl border p-5 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Specifications</p>
                <button onClick={addSpec} className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg border hover:bg-accent">
                  <Plus className="w-3 h-3" /> Add row
                </button>
              </div>
              {form.specs.length === 0
                ? <p className="text-xs text-muted-foreground">No specs yet — click Add row.</p>
                : <div className="space-y-2">
                    {form.specs.map((s, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input value={s.label} onChange={e => setSpec(i, "label", e.target.value)}
                          className="flex-1 h-8 px-3 rounded-lg border text-xs outline-none focus:border-[#1a9f9a]" placeholder="Label" />
                        <input value={s.value} onChange={e => setSpec(i, "value", e.target.value)}
                          className="flex-1 h-8 px-3 rounded-lg border text-xs outline-none focus:border-[#1a9f9a]" placeholder="Value" />
                        <button onClick={() => delSpec(i)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>}
            </div>

            {/* Bottom bar */}
            <div className="flex items-center justify-end gap-3 pt-2 pb-8">
              {selected && (
                <button onClick={() => deleteProduct(selected.id)}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-red-500 border border-red-100 hover:bg-red-50">
                  Delete product
                </button>
              )}
              <button onClick={() => save(false)} disabled={saving}
                className="px-4 py-2 rounded-lg text-sm font-medium border hover:bg-accent disabled:opacity-60">
                Save draft
              </button>
              <button onClick={() => save(true)} disabled={saving}
                className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60"
                style={{ backgroundColor: "#1a9f9a" }}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
                Save & Publish
              </button>
            </div>

          </div>
        )}
      </div>
    </div>
  )
}
