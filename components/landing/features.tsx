// @ts-nocheck
import { Card, CardContent } from "@/components/ui/card"
import { Zap, Shield, Leaf, Cpu, Battery, Thermometer } from "lucide-react"

const features = [
  {
    icon: Zap,
    title: "Ultra-fast charging",
    desc: "Proprietary nano-cell architecture delivers 80% charge in under 12 minutes without degrading cell life.",
  },
  {
    icon: Battery,
    title: "10,000 cycle lifespan",
    desc: "Engineered to outlast the competition by 3x — less waste, more value over the product lifetime.",
  },
  {
    icon: Shield,
    title: "Multi-layer safety",
    desc: "Seven independent protection circuits prevent overcharge, thermal runaway, and short circuits.",
  },
  {
    icon: Thermometer,
    title: "Extreme temperature range",
    desc: "Operates reliably from -40°C to 85°C, making Voltrix ideal for any environment on earth.",
  },
  {
    icon: Cpu,
    title: "Smart BMS",
    desc: "Onboard battery management system monitors cell health in real time and optimises every charge.",
  },
  {
    icon: Leaf,
    title: "Sustainable materials",
    desc: "Cobalt-free cathode chemistry and fully recyclable packaging — power without the planet cost.",
  },
]

export default function Features() {
  return (
    <section className="py-24 px-4">
      <div className="max-w-5xl mx-auto space-y-14">
        <div className="text-center space-y-3 max-w-xl mx-auto">
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#1a9f9a" }}>
            Why Voltrix
          </p>
          <h2 className="text-4xl font-bold text-neutral-900 tracking-tight">
            Built different, by design.
          </h2>
          <p className="text-neutral-500 text-base leading-relaxed">
            Every cell is a result of years of materials science research and real-world stress testing.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f) => (
            <Card
              key={f.title}
              className="border border-neutral-100 rounded-2xl shadow-none hover:shadow-md hover:shadow-neutral-100 transition-shadow bg-white"
            >
              <CardContent className="p-6 space-y-3">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: "#1a9f9a1a" }}
                >
                  <f.icon className="w-4 h-4" style={{ color: "#1a9f9a" }} />
                </div>
                <h3 className="font-semibold text-neutral-900 text-sm">{f.title}</h3>
                <p className="text-neutral-500 text-sm leading-relaxed">{f.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
