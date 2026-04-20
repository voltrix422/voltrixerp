"use client"

import { useEffect, useState } from "react"
import { Topbar } from "@/components/layout/topbar"
import { ModuleGuard } from "@/components/layout/module-guard"
// DB access via /api/db routes (Prisma)
import { Badge } from "@/components/ui/badge"
import { Loader2, RefreshCw, ExternalLink, Package } from "lucide-react"
import ProductsManager from "@/components/website/products-manager"

type Quotation = {
  id: string
  created_at: string
  product_type: string | null
  voltage: string | null
  capacity: string | null
  quantity: number | null
  budget: string | null
  application: string | null
  specifications: string | null
  timeline: string | null
  full_name: string
  company: string | null
  email: string
  phone: string
  status: "new" | "in_review" | "quoted" | "closed"
}

const statusColors: Record<string, string> = {
  new:       "bg-blue-50 text-blue-600 border-blue-100",
  in_review: "bg-amber-50 text-amber-600 border-amber-100",
  quoted:    "bg-green-50 text-green-600 border-green-100",
  closed:    "bg-neutral-100 text-neutral-500 border-neutral-200",
}

const statusOptions = ["new", "in_review", "quoted", "closed"]

export default function WebsitePage() {
  const [tab, setTab]           = useState<"quotations" | "products">("quotations")
  const [quotes, setQuotes]     = useState<Quotation[]>([])
  const [loading, setLoading]   = useState(true)
  const [selected, setSelected] = useState<Quotation | null>(null)
  const [updating, setUpdating] = useState(false)

  const fetchQuotes = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/db/quotations")
      if (res.ok) {
        const data = await res.json()
        setQuotes(data.map((q: Record<string, unknown>) => ({
          id: q.id as string,
          created_at: (q.createdAt || q.created_at) as string,
          product_type: (q.productType || q.product_type) as string | null,
          voltage: q.voltage as string | null,
          capacity: q.capacity as string | null,
          quantity: q.quantity as number | null,
          budget: q.budget as string | null,
          application: q.application as string | null,
          specifications: (q.specifications || q.specs) as string | null,
          timeline: q.timeline as string | null,
          full_name: (q.fullName || q.full_name) as string,
          company: q.company as string | null,
          email: q.email as string,
          phone: q.phone as string,
          status: (q.status || "new") as Quotation["status"],
        })))
      }
    } catch (e) { console.error("Quotations fetch error:", e) }
    setLoading(false)
  }

  useEffect(() => { fetchQuotes() }, [])

  const updateStatus = async (id: string, status: string) => {
    setUpdating(true)
    try {
      await fetch("/api/db/quotations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      })
    } catch {}
    setQuotes(q => q.map(x => x.id === id ? { ...x, status: status as Quotation["status"] } : x))
    if (selected?.id === id) setSelected(s => s ? { ...s, status: status as Quotation["status"] } : s)
    setUpdating(false)
  }

  return (
    <ModuleGuard module="website">
      <Topbar title="Website" />

      {/* Tabs */}
      <div className="flex items-center gap-1 px-4 py-2 border-b">
        <button onClick={() => setTab("quotations")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === "quotations" ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
          <RefreshCw className="w-3.5 h-3.5" /> Quotations
        </button>
        <button onClick={() => setTab("products")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === "products" ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
          <Package className="w-3.5 h-3.5" /> Products
        </button>
      </div>

      {tab === "products" ? (
        <ProductsManager />
      ) : (
      <div className="flex flex-1 overflow-hidden">

        {/* List */}
        <div className="w-full md:w-[420px] shrink-0 border-r flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <div>
              <p className="text-sm font-semibold">Customer Quotations</p>
              <p className="text-xs text-muted-foreground">{quotes.length} total</p>
            </div>
            <button onClick={fetchQuotes} className="p-1.5 rounded-lg hover:bg-accent transition-colors">
              <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </div>

          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : quotes.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">No quotations yet</div>
          ) : (
            <div className="flex-1 overflow-y-auto divide-y">
              {quotes.map((q) => (
                <button
                  key={q.id}
                  onClick={() => setSelected(q)}
                  className={`w-full text-left px-4 py-3 hover:bg-accent transition-colors ${selected?.id === q.id ? "bg-accent" : ""}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{q.full_name}</p>
                      <p className="text-xs text-muted-foreground truncate">{q.email}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{q.product_type || "—"} · {q.quantity ? `${q.quantity} units` : "qty n/a"}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${statusColors[q.status]}`}>
                        {q.status.replace("_", " ")}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(q.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Detail */}
        <div className="flex-1 overflow-y-auto">
          {!selected ? (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
              Select a quotation to view details
            </div>
          ) : (
            <div className="p-6 space-y-6 max-w-2xl">
              {/* Header */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold">{selected.full_name}</h2>
                  {selected.company && <p className="text-sm text-muted-foreground">{selected.company}</p>}
                  <p className="text-xs text-muted-foreground mt-0.5">{new Date(selected.created_at).toLocaleString()}</p>
                </div>
                <select
                  value={selected.status}
                  disabled={updating}
                  onChange={e => updateStatus(selected.id, e.target.value)}
                  className={`text-xs font-medium px-3 py-1.5 rounded-full border outline-none cursor-pointer ${statusColors[selected.status]}`}
                >
                  {statusOptions.map(s => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
                </select>
              </div>

              {/* Contact */}
              <div className="rounded-xl border p-4 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Contact</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><p className="text-xs text-muted-foreground">Email</p><a href={`mailto:${selected.email}`} className="font-medium hover:underline flex items-center gap-1">{selected.email}<ExternalLink className="w-3 h-3" /></a></div>
                  <div><p className="text-xs text-muted-foreground">Phone</p><a href={`tel:${selected.phone}`} className="font-medium hover:underline">{selected.phone}</a></div>
                </div>
              </div>

              {/* Product */}
              <div className="rounded-xl border p-4 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Product Requirements</p>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  {[
                    ["Type",     selected.product_type],
                    ["Voltage",  selected.voltage],
                    ["Capacity", selected.capacity],
                    ["Quantity", selected.quantity?.toString()],
                    ["Budget",   selected.budget],
                    ["Timeline", selected.timeline],
                  ].map(([label, val]) => (
                    <div key={label}>
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className="font-medium">{val || "—"}</p>
                    </div>
                  ))}
                </div>
                {selected.application && (
                  <div>
                    <p className="text-xs text-muted-foreground">Application</p>
                    <p className="text-sm font-medium">{selected.application}</p>
                  </div>
                )}
                {selected.specifications && (
                  <div>
                    <p className="text-xs text-muted-foreground">Specifications</p>
                    <p className="text-sm text-muted-foreground leading-relaxed">{selected.specifications}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      )}
    </ModuleGuard>
  )
}
