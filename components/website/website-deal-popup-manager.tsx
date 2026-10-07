"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Check, Loader2, Megaphone, RefreshCw, Sparkles } from "lucide-react"
import { getProductDisplayName } from "@/lib/product-display-name"
import { dealLabelForCount, sumCatalogPrices } from "@/lib/website-banner-utils"

type Product = {
  id: string
  name: string
  model?: string
  price: number | string
  quoteMode?: boolean
  published: boolean
  images?: string[]
}

export default function WebsiteDealPopupManager() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [enabled, setEnabled] = useState(false)
  const [productIds, setProductIds] = useState<string[]>([])
  const [bundleDealPrice, setBundleDealPrice] = useState("")
  const [headline, setHeadline] = useState("")
  const [saving, setSaving] = useState(false)
  const [ok, setOk] = useState(false)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const [productsRes, bannerRes] = await Promise.all([
        fetch("/api/products"),
        fetch("/api/site/banner"),
      ])
      const list = (await productsRes.json()) as Product[]
      setProducts(Array.isArray(list) ? list.filter((p) => p.published) : [])

      if (bannerRes.ok) {
        const banner = await bannerRes.json()
        setEnabled(Boolean(banner.enabled))
        setHeadline(banner.headline ? String(banner.headline) : "")
        const ids = Array.isArray(banner.productIds)
          ? banner.productIds.map(String)
          : Array.isArray(banner.items)
            ? banner.items.map((r: { productId?: string }) => String(r.productId || "")).filter(Boolean)
            : banner.productId
              ? [String(banner.productId)]
              : []
        setProductIds(ids.slice(0, 4))
        const b = banner.bundleDealPrice
        setBundleDealPrice(b != null && Number(b) > 0 ? String(b) : "")
      }
    } catch {
      setError("Could not load deal settings.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const selectedProducts = useMemo(
    () => productIds.map((id) => products.find((p) => p.id === id)).filter(Boolean) as Product[],
    [productIds, products],
  )

  const catalogTotal = useMemo(() => sumCatalogPrices(selectedProducts), [selectedProducts])

  const dealN = Number(String(bundleDealPrice).replace(/,/g, ""))
  const dealLabel = dealLabelForCount(productIds.length)
  const pctOff =
    Number.isFinite(dealN) && dealN > 0 && catalogTotal > 0 && dealN < catalogTotal
      ? Math.round(((catalogTotal - dealN) / catalogTotal) * 100)
      : null

  function toggleProduct(id: string) {
    setProductIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id)
      if (prev.length >= 4) return prev
      return [...prev, id]
    })
  }

  async function save() {
    if (enabled && productIds.length === 0) {
      setError("Select at least one product.")
      return
    }
    const bundle = Number(String(bundleDealPrice).replace(/,/g, ""))
    if (enabled && (!Number.isFinite(bundle) || bundle <= 0)) {
      setError("Enter one bundle deal price.")
      return
    }
    setSaving(true)
    setError("")
    setOk(false)
    try {
      const res = await fetch("/api/site/banner", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled,
          productIds,
          bundleDealPrice: enabled ? Math.round(bundle) : null,
          headline: headline.trim(),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(String(data?.error || "Save failed"))
      setOk(true)
      setTimeout(() => setOk(false), 3000)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Homepage deal popup</h2>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Pick up to 4 products and one bundle price. On the site, visitors see each product
            plus the total website price crossed out and your deal price.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-lg border p-2 text-muted-foreground hover:bg-accent"
          aria-label="Refresh"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      <div className="rounded-xl border bg-card p-4 shadow-sm sm:p-5">
        <label className="flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="rounded border-neutral-300 text-[#1a9f9a] focus:ring-[#1a9f9a]"
          />
          <span className="text-sm font-medium">Show popup when the homepage opens</span>
        </label>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Headline (optional)
            </label>
            <input
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              placeholder="Weekend solar bundle"
              maxLength={80}
              className="mt-1.5 h-9 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:border-[#1a9f9a]"
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Bundle deal price (Rs.)
            </label>
            <input
              value={bundleDealPrice}
              onChange={(e) => setBundleDealPrice(e.target.value)}
              inputMode="numeric"
              placeholder={catalogTotal > 0 ? `e.g. ${Math.round(catalogTotal * 0.9)}` : "One price for all items"}
              className="mt-1.5 h-9 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:border-[#1a9f9a]"
            />
            {catalogTotal > 0 && (
              <p className="mt-1 text-[11px] text-muted-foreground">
                Website total (was): Rs. {catalogTotal.toLocaleString()}
                {pctOff != null && pctOff > 0 ? ` · save ~${pctOff}%` : ""}
              </p>
            )}
          </div>
        </div>

        {productIds.length > 0 && (
          <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[#1a9f9a]/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#0d7370]">
            <Sparkles className="h-3 w-3" />
            {dealLabel}
          </p>
        )}

        <p className="mt-4 text-xs font-semibold text-muted-foreground">Products in this deal</p>
        <div className="mt-2 max-h-[280px] space-y-1 overflow-y-auto rounded-lg border p-1">
          {products.map((p) => {
            const display = getProductDisplayName({ name: p.name, model: p.model })
            const checked = productIds.includes(p.id)
            const price = Number(p.price)
            const disabled = !checked && productIds.length >= 4
            return (
              <label
                key={p.id}
                className={`flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 transition ${
                  checked ? "bg-[#1a9f9a]/8" : "hover:bg-muted/60"
                } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={disabled}
                  onChange={() => toggleProduct(p.id)}
                  className="rounded border-neutral-300 text-[#1a9f9a]"
                />
                <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md border bg-white">
                  {p.images?.[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.images[0]} alt="" className="h-full w-full object-contain p-0.5" />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{display.title}</p>
                  {display.model ? (
                    <p className="truncate font-mono text-[10px] text-muted-foreground">{display.model}</p>
                  ) : null}
                </div>
                <p className="shrink-0 text-xs font-medium text-muted-foreground">
                  {Number.isFinite(price) && price > 0 ? `Rs. ${price.toLocaleString()}` : "Quote"}
                </p>
              </label>
            )
          })}
        </div>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            style={{ backgroundColor: "#1a9f9a" }}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Save deal
          </button>
          {ok && <span className="text-sm font-medium text-emerald-600">Saved</span>}
        </div>
      </div>

      {/* Mini preview */}
      {selectedProducts.length > 0 && (
        <div className="rounded-xl border border-dashed bg-muted/30 p-4">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Megaphone className="h-3.5 w-3.5" /> Popup preview
          </p>
          <div className="mx-auto max-w-sm rounded-xl bg-white p-3 shadow-sm ring-1 ring-black/5">
            <p className="text-[10px] font-bold uppercase tracking-wide text-[#0d7370]">{dealLabel}</p>
            <p className="text-sm font-semibold">{headline || "Limited-time bundle"}</p>
            <ul className="mt-2 space-y-1">
              {selectedProducts.map((p) => {
                const d = getProductDisplayName({ name: p.name, model: p.model })
                return (
                  <li key={p.id} className="truncate text-xs text-neutral-600">
                    · {d.title}
                  </li>
                )
              })}
            </ul>
            <div className="mt-2 flex items-baseline gap-2">
              {catalogTotal > 0 && (
                <span className="text-sm text-neutral-400 line-through">
                  Rs. {catalogTotal.toLocaleString()}
                </span>
              )}
              {Number.isFinite(dealN) && dealN > 0 ? (
                <span className="text-xl font-bold text-[#0d7370]">Rs. {dealN.toLocaleString()}</span>
              ) : (
                <span className="text-sm text-neutral-400">Set bundle price</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
