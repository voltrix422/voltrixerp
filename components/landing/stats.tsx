"use client"

import { Users, Package, Star, Truck } from "lucide-react"

const stats = [
  { icon: Users, value: 500, suffix: "+", label: "Clients", desc: "Across Pakistan" },
  { icon: Package, value: 1200, suffix: "+", label: "Units Sold", desc: "And counting" },
  { icon: Star, value: 99, suffix: "%", label: "Customer Satisfaction", desc: "5-star rated" },
  { icon: Truck, value: 2000, suffix: "+", label: "Units Delivered", desc: "Nationwide" },
]

export default function Stats() {
  return (
    <section className="py-20 px-4 bg-neutral-50/60">
      <div className="max-w-5xl mx-auto space-y-10">
        <h2 className="text-3xl font-bold tracking-tight text-center text-neutral-900">
          Trusted across Pakistan.
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((s) => {
            const Icon = s.icon
            return (
              <div
                key={s.label}
                className="flex flex-col gap-4 p-6 rounded-2xl bg-white border border-neutral-100"
              >
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: "#1a9f9a10" }}
                >
                  <Icon className="w-3.5 h-3.5" style={{ color: "#1a9f9a" }} />
                </div>
                <div>
                  <p className="text-4xl font-bold text-neutral-900 tabular-nums leading-none tracking-tight">
                    {s.value >= 1000 ? s.value.toLocaleString() : s.value}
                    <span className="text-2xl" style={{ color: "#1a9f9a" }}>
                      {s.suffix}
                    </span>
                  </p>
                </div>
                <div className="space-y-0.5 border-t border-neutral-50 pt-3">
                  <p className="text-sm font-semibold text-neutral-800">{s.label}</p>
                  <p className="text-xs text-neutral-400">{s.desc}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
