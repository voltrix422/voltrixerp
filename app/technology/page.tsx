import { DM_Sans } from "next/font/google"
import Navbar from "@/components/landing/navbar"
import Footer from "@/components/landing/footer"
import { Zap, Shield, Thermometer, Cpu, Battery, Leaf } from "lucide-react"

const dmSans = DM_Sans({ subsets: ["latin"], weight: ["300", "400", "500", "600", "700"], variable: "--font-dm-sans" })

const pillars = [
  { icon: Zap, title: "Ultra-fast charging", desc: "Proprietary nano-cell architecture delivers 80% charge in under 12 minutes without degrading cell life over thousands of cycles." },
  { icon: Battery, title: "10,000 cycle lifespan", desc: "Engineered to outlast the competition by 3x — less waste, more value, and a dramatically lower total cost of ownership." },
  { icon: Shield, title: "Multi-layer safety", desc: "Seven independent protection circuits prevent overcharge, thermal runaway, and short circuits at every stage of operation." },
  { icon: Thermometer, title: "Extreme temperature range", desc: "Operates reliably from -40°C to 85°C, making Voltrix ideal for any environment — from arctic logistics to desert solar farms." },
  { icon: Cpu, title: "Smart BMS", desc: "Onboard battery management system monitors cell health in real time, optimises every charge cycle, and reports via Bluetooth." },
  { icon: Leaf, title: "Sustainable chemistry", desc: "Cobalt-free LiFePO₄ cathode chemistry and fully recyclable packaging — maximum power with minimum environmental cost." },
]

export default function TechnologyPage() {
  return (
    <main className={`${dmSans.variable} min-h-screen bg-white text-neutral-900 antialiased`} style={{ fontFamily: "var(--font-dm-sans), sans-serif" }}>
      <Navbar />
      <section className="pt-36 pb-24 px-4">
        <div className="max-w-5xl mx-auto space-y-20">
          {/* Header */}
          <div className="text-center space-y-4 max-w-2xl mx-auto">
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#1a9f9a" }}>Our Technology</p>
            <h1 className="text-5xl font-bold tracking-tight text-neutral-900">Built different, by design.</h1>
            <p className="text-neutral-500 text-base leading-relaxed">Every cell is the result of years of materials science research and real-world stress testing across the harshest conditions on earth.</p>
          </div>

          {/* Stat bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 py-12 border-y border-neutral-100">
            {[["10,000+","Charge cycles"],["12 min","0→80% charge"],["99.97%","Safety rating"],["40%","More energy dense"]].map(([v,l]) => (
              <div key={l} className="text-center space-y-1">
                <p className="text-3xl font-bold" style={{ color: "#1a9f9a" }}>{v}</p>
                <p className="text-sm text-neutral-500">{l}</p>
              </div>
            ))}
          </div>

          {/* Pillars */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {pillars.map((p) => (
              <div key={p.title} className="p-6 rounded-2xl border border-neutral-100 hover:border-neutral-200 hover:shadow-md hover:shadow-neutral-100 transition-all space-y-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: "#1a9f9a1a" }}>
                  <p.icon className="w-4 h-4" style={{ color: "#1a9f9a" }} />
                </div>
                <h3 className="font-semibold text-neutral-900">{p.title}</h3>
                <p className="text-sm text-neutral-500 leading-relaxed">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <Footer />
    </main>
  )
}
