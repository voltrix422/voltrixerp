"use client"

import { useEffect, useRef, useState } from "react"
import { CheckCircle2, ImagePlus, Loader2, Trash2, Wallet } from "lucide-react"

type CatalogProduct = {
  id?: string
  name?: string
  published?: boolean
}

export default function InstallerCashbackForm() {
  const [fullName, setFullName] = useState("")
  const [cnic, setCnic] = useState("")
  const [phone, setPhone] = useState("")
  const [installPlace, setInstallPlace] = useState("")
  const [productId, setProductId] = useState("")
  const [productName, setProductName] = useState("")
  const [quantity, setQuantity] = useState("1")
  const [notes, setNotes] = useState("")
  const [products, setProducts] = useState<CatalogProduct[]>([])
  const [imageUrls, setImageUrls] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState(false)
  const [error, setError] = useState("")
  const fileRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    void fetch("/api/products")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        const list = (Array.isArray(data) ? data : []).filter(
          (p: CatalogProduct) => p.published !== false && String(p.name || "").trim(),
        )
        setProducts(list)
      })
      .catch(() => setProducts([]))
  }, [])

  async function handleUpload(files: FileList | null) {
    if (!files?.length) return
    if (imageUrls.length + files.length > 8) {
      setError("You can upload up to 8 photos.")
      return
    }
    setUploading(true)
    setError("")
    try {
      const form = new FormData()
      form.append("folder", "installer-cashback")
      for (const file of Array.from(files)) form.append("files", file)
      const res = await fetch("/api/upload", { method: "POST", body: form })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((data as { error?: string }).error || "Upload failed")
      const urls = Array.isArray((data as { urls?: string[] }).urls) ? (data as { urls: string[] }).urls : []
      setImageUrls((prev) => [...prev, ...urls].slice(0, 8))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Photo upload failed")
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/db/installer-cashback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: fullName.trim(),
          cnic: cnic.trim(),
          phone: phone.trim(),
          installPlace: installPlace.trim(),
          productId,
          productName: productName.trim(),
          quantity: Number(quantity) || 1,
          imageUrls,
          notes: notes.trim(),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((data as { error?: string }).error || "Submit failed")
      setToast(true)
      setTimeout(() => setToast(false), 4500)
      setFullName("")
      setCnic("")
      setPhone("")
      setInstallPlace("")
      setProductId("")
      setProductName("")
      setQuantity("1")
      setNotes("")
      setImageUrls([])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="pt-32 pb-20 px-4">
      <div
        className="fixed bottom-6 left-6 z-[100] flex items-center gap-3 px-4 py-3 rounded-2xl bg-neutral-900 text-white shadow-2xl transition-all duration-500"
        style={{
          opacity: toast ? 1 : 0,
          transform: toast ? "translateX(0)" : "translateX(-110%)",
          pointerEvents: toast ? "auto" : "none",
        }}
      >
        <CheckCircle2 className="w-5 h-5 text-[#1a9f9a] shrink-0" />
        <p className="text-sm">Request submitted. We will review and contact you.</p>
      </div>

      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-10 space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#1a9f9a]/25 bg-[#1a9f9a]/5 px-3 py-1 text-xs font-semibold text-[#1a9f9a]">
            <Wallet className="w-3.5 h-3.5" />
            Installer program
          </div>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-neutral-900">
            Installer cashback
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="rounded-2xl border border-neutral-200 bg-white p-5 sm:p-8 space-y-5 shadow-sm">
          <div className="grid sm:grid-cols-2 gap-4">
            <label className="space-y-1.5 block text-sm">
              <span className="font-medium text-neutral-800">Full name *</span>
              <input
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full h-11 rounded-xl border border-neutral-200 px-3 outline-none focus:border-[#1a9f9a]"
                placeholder="Your name"
              />
            </label>
            <label className="space-y-1.5 block text-sm">
              <span className="font-medium text-neutral-800">CNIC *</span>
              <input
                required
                value={cnic}
                onChange={(e) => setCnic(e.target.value)}
                className="w-full h-11 rounded-xl border border-neutral-200 px-3 outline-none focus:border-[#1a9f9a]"
                placeholder="xxxxx-xxxxxxx-x"
              />
            </label>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <label className="space-y-1.5 block text-sm">
              <span className="font-medium text-neutral-800">Phone *</span>
              <input
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full h-11 rounded-xl border border-neutral-200 px-3 outline-none focus:border-[#1a9f9a]"
                placeholder="03xx xxxxxxx"
              />
            </label>
            <label className="space-y-1.5 block text-sm">
              <span className="font-medium text-neutral-800">Quantity installed</span>
              <input
                type="number"
                min={1}
                max={99}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full h-11 rounded-xl border border-neutral-200 px-3 outline-none focus:border-[#1a9f9a]"
              />
            </label>
          </div>

          <label className="space-y-1.5 block text-sm">
            <span className="font-medium text-neutral-800">Installation place *</span>
            <input
              required
              value={installPlace}
              onChange={(e) => setInstallPlace(e.target.value)}
              className="w-full h-11 rounded-xl border border-neutral-200 px-3 outline-none focus:border-[#1a9f9a]"
              placeholder="City / area / site address"
            />
          </label>

          <label className="space-y-1.5 block text-sm">
            <span className="font-medium text-neutral-800">Product installed *</span>
            <select
              required
              value={productId || productName}
              onChange={(e) => {
                const val = e.target.value
                const match = products.find((p) => String(p.id) === val || p.name === val)
                if (match) {
                  setProductId(String(match.id || ""))
                  setProductName(String(match.name || ""))
                } else {
                  setProductId("")
                  setProductName(val)
                }
              }}
              className="w-full h-11 rounded-xl border border-neutral-200 px-3 outline-none focus:border-[#1a9f9a] bg-white"
            >
              <option value="">Select product</option>
              {products.map((p) => (
                <option key={String(p.id || p.name)} value={String(p.id || p.name)}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>

          <div className="space-y-2">
            <p className="text-sm font-medium text-neutral-800">Installation / product photos *</p>
            <p className="text-xs text-neutral-500">Upload clear photos of the site and installed Voltrix products (max 8).</p>
            <div className="flex flex-wrap gap-2">
              {imageUrls.map((url) => (
                <div key={url} className="relative w-20 h-20 rounded-xl border overflow-hidden bg-neutral-50">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    className="absolute top-1 right-1 rounded bg-black/60 text-white p-0.5"
                    onClick={() => setImageUrls((prev) => prev.filter((u) => u !== url))}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => void handleUpload(e.target.files)}
              />
              <button
                type="button"
                disabled={uploading || imageUrls.length >= 8}
                onClick={() => fileRef.current?.click()}
                className="w-20 h-20 rounded-xl border border-dashed border-neutral-300 flex flex-col items-center justify-center text-[10px] text-neutral-500 hover:bg-neutral-50 disabled:opacity-50"
              >
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4 mb-0.5" />}
                {uploading ? "…" : "Add"}
              </button>
            </div>
          </div>

          <label className="space-y-1.5 block text-sm">
            <span className="font-medium text-neutral-800">Notes (optional)</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full rounded-xl border border-neutral-200 px-3 py-2 outline-none focus:border-[#1a9f9a]"
              placeholder="Serial numbers, install date, or anything else we should know"
            />
          </label>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <button
            type="submit"
            disabled={loading || uploading}
            className="w-full h-12 rounded-xl bg-[#1a9f9a] text-white font-semibold hover:bg-[#178f8a] disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Submit cashback request
          </button>
        </form>
      </div>
    </section>
  )
}
