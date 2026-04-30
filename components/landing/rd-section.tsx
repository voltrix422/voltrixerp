// @ts-nocheck
import { FlaskConical, Factory, Cpu, Zap, Shield, Layers, Leaf, ArrowRight, Bluetooth, Activity, Scale, Globe } from "lucide-react"

const features = [
  { icon: Zap, label: "Durable", desc: "Long-lasting performance" },
  { icon: Shield, label: "Reliable", desc: "Strict safety standards" },
  { icon: Layers, label: "Scalable", desc: "Modular & future-ready" },
  { icon: Leaf, label: "Sustainable", desc: "Eco-friendly design" },
]

const bmsFeatures = [
  { icon: Activity, title: "Real-time", desc: "Cell monitoring" },
  { icon: Scale, title: "Smart", desc: "Cell balancing" },
  { icon: Bluetooth, title: "Bluetooth", desc: "Diagnostics" },
  { icon: Globe, title: "Global", desc: "Safety certified" },
]

export default function RDSection() {
  return (
    <section id="rd" className="bg-neutral-50 py-24 px-4">
      <div className="max-w-7xl mx-auto space-y-24">
        
        {/* Header */}
        <div className="text-center space-y-4">
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#1a9f9a]/10 text-[#1a9f9a] text-sm font-semibold">
            <FlaskConical className="w-4 h-4" />
            Research & Manufacturing
          </span>
          <h2 className="text-4xl md:text-6xl font-bold text-neutral-900">
            Where Innovation Meets <span className="text-[#1a9f9a]">Precision</span>
          </h2>
          <p className="text-lg text-neutral-600 max-w-2xl mx-auto">
            From concept to creation, our teams deliver cutting-edge solutions with exceptional quality.
          </p>
        </div>

        {/* R&D + Manufacturing Cards */}
        <div className="grid md:grid-cols-2 gap-8">
          {/* R&D */}
          <div className="group rounded-3xl bg-neutral-900 p-10 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-[#1a9f9a]/10 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="relative z-10 space-y-6">
              <div className="w-14 h-14 rounded-2xl bg-[#1a9f9a]/20 flex items-center justify-center">
                <FlaskConical className="w-7 h-7 text-[#1a9f9a]" />
              </div>
              <div>
                <span className="text-[#1a9f9a] text-sm font-semibold uppercase tracking-wider">R&D</span>
                <h3 className="text-2xl font-bold mt-1">Pioneering BMS Technology</h3>
              </div>
              <p className="text-neutral-400 leading-relaxed">
                Pakistan's first indigenous Battery Management System development. Advanced inverters, residential and industrial BESS solutions.
              </p>
              <div className="flex flex-wrap gap-2">
                {["Advanced BMS", "Smart Inverters", "Residential BESS", "Industrial BESS"].map((t) => (
                  <span key={t} className="px-3 py-1 rounded-full bg-[#1a9f9a]/10 text-[#1a9f9a] text-xs font-medium">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Manufacturing */}
          <div className="group rounded-3xl bg-white p-10 border border-neutral-100 hover:shadow-xl transition-all">
            <div className="space-y-6">
              <div className="w-14 h-14 rounded-2xl bg-[#1a9f9a]/10 flex items-center justify-center">
                <Factory className="w-7 h-7 text-[#1a9f9a]" />
              </div>
              <div>
                <span className="text-[#1a9f9a] text-sm font-semibold uppercase tracking-wider">Manufacturing</span>
                <h3 className="text-2xl font-bold mt-1 text-neutral-900">Automated Excellence</h3>
              </div>
              <p className="text-neutral-600 leading-relaxed">
                Automated lines and quality systems ensure every battery exceeds global standards. Eco-friendly precision engineering.
              </p>
              <div className="space-y-2">
                {["Component testing", "Eco production", "Global certification"].map((t, i) => (
                  <div key={t} className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-[#1a9f9a]/10 text-[#1a9f9a] text-xs font-bold flex items-center justify-center">{i + 1}</span>
                    <span className="text-sm text-neutral-700">{t}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Quality Features */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {features.map((f) => (
            <div key={f.label} className="group p-6 rounded-2xl bg-white border border-neutral-100 hover:border-[#1a9f9a]/30 hover:shadow-lg transition-all text-center">
              <div className="w-12 h-12 rounded-xl bg-[#1a9f9a]/10 flex items-center justify-center mx-auto mb-3 group-hover:bg-[#1a9f9a] transition-colors">
                <f.icon className="w-6 h-6 text-[#1a9f9a] group-hover:text-white transition-colors" />
              </div>
              <h4 className="font-bold text-neutral-900">{f.label}</h4>
              <p className="text-sm text-neutral-500 mt-1">{f.desc}</p>
            </div>
          ))}
        </div>

        {/* BMS Highlight */}
        <div className="rounded-3xl bg-gradient-to-br from-neutral-900 to-neutral-800 p-10 md:p-16 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#1a9f9a]/10 rounded-full -translate-y-1/2 translate-x-1/4 blur-3xl" />
          
          <div className="relative z-10 grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#1a9f9a]/20 text-[#1a9f9a] text-sm font-semibold">
                <Cpu className="w-4 h-4" />
                Pakistan's First
              </span>
              <h3 className="text-4xl md:text-5xl font-bold leading-tight">
                Indigenous Battery <span className="text-[#1a9f9a]">Management System</span>
              </h3>
              <p className="text-neutral-400 text-lg leading-relaxed">
                Voltrix is the only company in Pakistan to develop its own BMS in-house — enabling real-time monitoring, smart balancing, and wireless diagnostics.
              </p>
              <p className="text-sm text-[#1a9f9a] font-semibold">Built entirely in Pakistan</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {bmsFeatures.map((f) => (
                <div key={f.title} className="p-5 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
                  <f.icon className="w-6 h-6 text-[#1a9f9a] mb-3" />
                  <h4 className="font-bold text-white">{f.title}</h4>
                  <p className="text-sm text-neutral-400">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </section>
  )
}
