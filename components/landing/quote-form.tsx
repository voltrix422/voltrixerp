// @ts-nocheck
"use client"

import { useState } from "react"
import { Battery, Zap, Cpu, Package, ChevronDown, Loader2, CheckCircle2, X } from "lucide-react"
// DB access via /api/db routes (Prisma)

const productTypes = [
  { id: "battery",  label: "Battery Pack", icon: Battery },
  { id: "bess",     label: "BESS",         icon: Zap     },
  { id: "inverter", label: "Inverter",     icon: Cpu     },
  { id: "custom",   label: "Custom",       icon: Package },
]

const voltageOptions  = ["12V","24V","48V","60V","72V","96V","Custom"]
const capacityOptions = ["< 5 KWh","5–20 KWh","20–80 KWh","80–232 KWh","Custom"]
const timelineOptions = ["ASAP","1–2 weeks","1 month","2–3 months","Flexible"]

export default function QuoteForm() {
  const [selected, setSelected]       = useState<string | null>(null)
  const [voltage, setVoltage]         = useState("")
  const [capacity, setCapacity]       = useState("")
  const [quantity, setQuantity]       = useState("")
  const [budget, setBudget]           = useState("")
  const [application, setApplication] = useState("")
  const [specs, setSpecs]             = useState("")
  const [timeline, setTimeline]       = useState("")
  const [fullName, setFullName]       = useState("")
  const [company, setCompany]         = useState("")
  const [email, setEmail]             = useState("")
  const [phone, setPhone]             = useState("")
  const [loading, setLoading]         = useState(false)
  const [toast, setToast]             = useState(false)
  const [error, setError]             = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/db/quotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_type:   selected,
          voltage,
          capacity,
          quantity:       quantity ? parseInt(quantity) : null,
          budget,
          application,
          specifications: specs,
          timeline,
          full_name:      fullName,
          company,
          email,
          phone,
        }),
      })
      setLoading(false)
      if (!res.ok) { setError("Something went wrong. Please try again."); return }
    } catch {
      setLoading(false)
      setError("Something went wrong. Please try again."); return
    }
    setToast(true)
    setTimeout(() => setToast(false), 4000)
    // Reset form
    setSelected(null); setVoltage(""); setCapacity(""); setQuantity(""); setBudget("")
    setApplication(""); setSpecs(""); setTimeline(""); setFullName(""); setCompany(""); setEmail(""); setPhone("")
  }

  return (
    <section className="pt-32 pb-20 px-4">
      {/* Toast */}
      <div
        className="fixed bottom-6 left-6 z-[100] flex items-center gap-3 px-4 py-3 rounded-2xl bg-neutral-900 text-white shadow-2xl transition-all duration-500"
        style={{
          opacity: toast ? 1 : 0,
          transform: toast ? "translateX(0)" : "translateX(-110%)",
          pointerEvents: toast ? "auto" : "none",
        }}
      >
        <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: "#1a9f9a" }} />
        <div>
          <p className="text-sm font-semibold">Quote request sent!</p>
          <p className="text-xs text-white/50">We'll get back to you within 24 hours.</p>
        </div>
        <button onClick={() => setToast(false)} className="ml-2 text-white/40 hover:text-white transition-colors">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="max-w-2xl mx-auto space-y-8">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#1a9f9a" }}>Request a Quote</p>
          <h1 className="text-4xl font-bold tracking-tight text-neutral-900">Tell us what you need.</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-7">

          {/* Product type */}
          <div className="space-y-3">
            <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">What are you looking for?</label>
            <div className="grid grid-cols-4 gap-2">
              {productTypes.map((p) => (
                <button type="button" key={p.id} onClick={() => setSelected(p.id)}
                  className={`flex flex-col items-center gap-2 p-3 rounded-xl border text-center transition-all duration-200 ${selected === p.id ? "border-[#1a9f9a] bg-[#1a9f9a08]" : "border-neutral-200 hover:border-neutral-300 bg-white"}`}
                >
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: selected === p.id ? "#1a9f9a20" : "#f3f4f6" }}>
                    <p.icon className="w-3.5 h-3.5" style={{ color: selected === p.id ? "#1a9f9a" : "#9ca3af" }} />
                  </div>
                  <span className="text-xs font-medium text-neutral-700">{p.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Technical requirements */}
          <div className="space-y-3">
            <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Technical requirements</label>
            <div className="grid grid-cols-2 gap-3">
              <div className="relative">
                <select value={voltage} onChange={e => setVoltage(e.target.value)} className="w-full h-10 px-3 pr-8 rounded-xl border border-neutral-200 text-sm outline-none focus:border-[#1a9f9a] transition-colors bg-white appearance-none">
                  <option value="">Voltage</option>
                  {voltageOptions.map(v => <option key={v}>{v}</option>)}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400 pointer-events-none" />
              </div>
              <div className="relative">
                <select value={capacity} onChange={e => setCapacity(e.target.value)} className="w-full h-10 px-3 pr-8 rounded-xl border border-neutral-200 text-sm outline-none focus:border-[#1a9f9a] transition-colors bg-white appearance-none">
                  <option value="">Capacity</option>
                  {capacityOptions.map(c => <option key={c}>{c}</option>)}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400 pointer-events-none" />
              </div>
              <input type="number" min="1" value={quantity} onChange={e => setQuantity(e.target.value)} className="h-10 px-3 rounded-xl border border-neutral-200 text-sm outline-none focus:border-[#1a9f9a] transition-colors bg-white" placeholder="Quantity" />
              <input type="text" value={budget} onChange={e => setBudget(e.target.value)} className="h-10 px-3 rounded-xl border border-neutral-200 text-sm outline-none focus:border-[#1a9f9a] transition-colors bg-white" placeholder="Budget (PKR)" />
            </div>
            <input type="text" value={application} onChange={e => setApplication(e.target.value)} className="w-full h-10 px-3 rounded-xl border border-neutral-200 text-sm outline-none focus:border-[#1a9f9a] transition-colors bg-white" placeholder="Application / Use case" />
            <textarea rows={3} value={specs} onChange={e => setSpecs(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-neutral-200 text-sm outline-none focus:border-[#1a9f9a] transition-colors resize-none bg-white" placeholder="Additional specifications or custom requirements" />
          </div>

          {/* Timeline */}
          <div className="space-y-3">
            <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Delivery timeline</label>
            <div className="flex flex-wrap gap-2">
              {timelineOptions.map((t) => (
                <button type="button" key={t} onClick={() => setTimeline(t)}
                  className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${timeline === t ? "border-[#1a9f9a] text-[#1a9f9a] bg-[#1a9f9a08]" : "border-neutral-200 text-neutral-600 hover:border-neutral-300"}`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Contact */}
          <div className="space-y-3">
            <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Your contact details</label>
            <div className="grid grid-cols-2 gap-3">
              <input required type="text" value={fullName} onChange={e => setFullName(e.target.value)} className="h-10 px-3 rounded-xl border border-neutral-200 text-sm outline-none focus:border-[#1a9f9a] transition-colors bg-white" placeholder="Full name" />
              <input type="text" value={company} onChange={e => setCompany(e.target.value)} className="h-10 px-3 rounded-xl border border-neutral-200 text-sm outline-none focus:border-[#1a9f9a] transition-colors bg-white" placeholder="Company (optional)" />
              <input required type="email" value={email} onChange={e => setEmail(e.target.value)} className="h-10 px-3 rounded-xl border border-neutral-200 text-sm outline-none focus:border-[#1a9f9a] transition-colors bg-white" placeholder="Email" />
              <input required type="tel" value={phone} onChange={e => setPhone(e.target.value)} className="h-10 px-3 rounded-xl border border-neutral-200 text-sm outline-none focus:border-[#1a9f9a] transition-colors bg-white" placeholder="Phone" />
            </div>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <button type="submit" disabled={loading} className="w-full h-11 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-60" style={{ backgroundColor: "#1a9f9a" }}>
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? "Submitting..." : "Submit quote request"}
          </button>
        </form>
      </div>
    </section>
  )
}
