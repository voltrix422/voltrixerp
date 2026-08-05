// @ts-nocheck
import { Shield, Cpu, Globe, Leaf, Factory, Zap, ArrowRight, Award, Users, TrendingUp } from "lucide-react"

const stats = [
  { value: "Smart", label: "BMS", sub: "Bluetooth diagnostics built-in" },
  { value: "6+", label: "Products", sub: "Diverse energy solutions" },
  { value: "4+", label: "Focus Areas", sub: "Residential to Industrial" },
  { value: "100%", label: "Standards", sub: "Global benchmarks met" },
]

const reasons = [
  { icon: Factory, title: "Chinese Partners", desc: "Manufactured with leading Chinese partners for world-class quality." },
  { icon: Zap, title: "Complete Ecosystem", desc: "EV packs to industrial BESS — all under one roof." },
  { icon: Globe, title: "Global Partners", desc: "Collaborating with world leaders for top-tier quality." },
  { icon: Leaf, title: "Green Impact", desc: "Earning green credits, reducing emissions." },
  { icon: Shield, title: "Multi-layer Safety", desc: "IEC 62619 & UN 38.3 certified protection." },
  { icon: Cpu, title: "Smart BMS", desc: "Real-time monitoring with Bluetooth diagnostics." },
]

export default function AboutSection() {
  return (
    <section id="about" className="bg-white py-24 px-4">
      <div className="max-w-7xl mx-auto space-y-24">

        {/* Who We Are */}
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#1a9f9a]/10 text-[#1a9f9a] text-sm font-semibold">
              <Users className="w-4 h-4" />
              Who We Are
            </span>
            <h2 className="text-4xl md:text-5xl font-bold text-neutral-900 leading-tight">
              Powering the Future with <span className="text-[#1a9f9a]">Innovative Energy</span>
            </h2>
            <p className="text-lg text-neutral-600 leading-relaxed">
              We specialize in design, integration, and delivery of advanced lithium battery systems and BESS for commercial, industrial, and EV applications across Pakistan.
            </p>
            <p className="text-neutral-500">
              Our products are manufactured with leading Chinese partners — bringing global quality with local sales and support.
            </p>
            <a
              href="#contact"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#1a9f9a] text-white font-semibold hover:bg-[#158a85] transition-colors group"
            >
              Contact Us
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </a>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-4">
            {stats.map((s) => (
              <div key={s.label} className="p-6 rounded-2xl bg-neutral-50 border border-neutral-100 text-center hover:border-[#1a9f9a]/30 transition-colors">
                <p className="text-4xl font-bold text-[#1a9f9a]">{s.value}</p>
                <p className="font-semibold text-neutral-900 mt-1">{s.label}</p>
                <p className="text-xs text-neutral-500 mt-1">{s.sub}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Why Choose Us */}
        <div className="space-y-8">
          <div className="text-center space-y-3">
            <span className="text-[#1a9f9a] text-sm font-semibold uppercase tracking-wider">Why Voltrix</span>
            <h3 className="text-3xl md:text-4xl font-bold text-neutral-900">
              Reliable Solutions. <span className="text-[#1a9f9a]">Trusted Performance.</span>
            </h3>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {reasons.map((r) => (
              <div key={r.title} className="group p-6 rounded-2xl bg-white border border-neutral-100 hover:border-[#1a9f9a]/30 hover:shadow-lg transition-all">
                <div className="w-12 h-12 rounded-xl bg-[#1a9f9a]/10 flex items-center justify-center mb-4 group-hover:bg-[#1a9f9a] transition-colors">
                  <r.icon className="w-6 h-6 text-[#1a9f9a] group-hover:text-white transition-colors" />
                </div>
                <h4 className="font-bold text-neutral-900 mb-2">{r.title}</h4>
                <p className="text-sm text-neutral-600 leading-relaxed">{r.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Trusted By Banner */}
        <div className="rounded-3xl bg-gradient-to-r from-[#1a9f9a]/5 to-transparent p-10 border border-[#1a9f9a]/10">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-[#1a9f9a]" />
                <span className="text-[#1a9f9a] font-semibold">Trusted By Leading Businesses</span>
              </div>
              <h4 className="text-2xl font-bold text-neutral-900">
                Powering Pakistan's Energy Evolution
              </h4>
            </div>
            <p className="text-neutral-600 leading-relaxed">
              From EV battery packs to grid-scale storage, Voltrix bridges clean energy generation with dependable storage — combining Chinese manufacturing partners with local expertise and support.
            </p>
          </div>
        </div>

      </div>
    </section>
  )
}
