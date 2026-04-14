// @ts-nocheck
import { FlaskConical, Factory, Cpu, Zap, Shield, Layers, Leaf, ArrowRight } from "lucide-react"
import ScrollFloat from "./scroll-float"
import ScrollReveal from "./scroll-reveal"

const qualities = [
  { icon: Zap,     label: "Durable",     desc: "Built for long-lasting performance" },
  { icon: Shield,  label: "Reliable",    desc: "Meets strict safety standards"       },
  { icon: Layers,  label: "Scalable",    desc: "Modular and future-ready"            },
  { icon: Leaf,    label: "Sustainable", desc: "Environmentally responsible"         },
]

export default function RDSection() {
  return (
    <section id="rd" className="bg-white">

      {/* ── Hero ── */}
      <div className="py-24 px-4 border-b border-neutral-100 bg-neutral-950">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
          {/* Left */}
          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#1a9f9a" }}>Research & Manufacturing</p>
            <div className="flex flex-col gap-0">
              <ScrollFloat animationDuration={1} ease="back.inOut(2)" scrollStart="center bottom+=50%" scrollEnd="bottom bottom-=40%" stagger={0.03}
                containerClassName="text-2xl font-bold tracking-tight text-white/40 leading-none">
                Where Innovation
              </ScrollFloat>
              <ScrollFloat animationDuration={1} ease="back.inOut(2)" scrollStart="center bottom+=50%" scrollEnd="bottom bottom-=40%" stagger={0.03}
                containerClassName="text-4xl md:text-5xl font-bold tracking-tight text-white leading-none">
                Meets Precision
              </ScrollFloat>
            </div>
            <div className="w-10 h-0.5 rounded-full" style={{ backgroundColor: "#1a9f9a" }} />
          </div>
          {/* Right */}
          <p className="text-[15px] text-white/50 leading-relaxed">
            From concept to creation, our research and manufacturing teams work together to deliver cutting-edge solutions with exceptional quality and performance.
          </p>
        </div>
      </div>

      {/* ── Two columns ── */}
      <div className="py-24 px-4 border-b border-neutral-100">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-5">

          {/* R&D card — dark */}
          <div className="rounded-3xl p-10 space-y-6 relative overflow-hidden" style={{ backgroundColor: "#0f1a17" }}>
            <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full pointer-events-none" style={{ backgroundColor: "#1a9f9a08" }} />
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: "#1a9f9a20" }}>
                <FlaskConical className="w-5 h-5" style={{ color: "#1a9f9a" }} />
              </div>
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#1a9f9a" }}>Driving Innovation Forward</p>
            </div>
            <h3 className="text-2xl font-bold text-white leading-snug">Pakistan's pioneer in<br />Battery Management Systems.</h3>
            <p className="text-[14px] text-white/50 leading-relaxed">
              At Voltrix, R&D is the engine of progress. Our team continuously develops advanced inverters, residential and industrial battery systems, and large-scale BESS solutions — shaping a sustainable energy future.
            </p>
            <div className="grid grid-cols-2 gap-3 pt-2">
              {["Advanced BMS", "Smart Inverters", "Residential BESS", "Industrial BESS"].map((t) => (
                <div key={t} className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ backgroundColor: "#1a9f9a12", border: "1px solid #1a9f9a20" }}>
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: "#1a9f9a" }} />
                  <span className="text-xs text-white/60 font-medium">{t}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Manufacturing card — light */}
          <div className="rounded-3xl p-10 space-y-6 border border-neutral-100 bg-white">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: "#1a9f9a15" }}>
                <Factory className="w-5 h-5" style={{ color: "#1a9f9a" }} />
              </div>
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#1a9f9a" }}>Precision Meets Excellence</p>
            </div>
            <h3 className="text-2xl font-bold text-neutral-900 leading-snug">Automated lines.<br />Global-grade quality.</h3>
            <p className="text-[14px] text-neutral-500 leading-relaxed">
              Our automated manufacturing lines and advanced quality systems ensure every Voltrix battery exceeds global standards. From component testing to final assembly, precision engineering and eco-friendly practices define our process.
            </p>
            <div className="space-y-3 pt-2">
              {["Component-level testing", "Eco-friendly production", "Global safety certification"].map((t, i) => (
                <div key={t} className="flex items-center gap-3">
                  <span className="text-xs font-bold tabular-nums" style={{ color: "#1a9f9a" }}>0{i + 1}</span>
                  <span className="text-sm text-neutral-600">{t}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Quality pillars ── */}
      <div className="py-20 px-4 border-b border-neutral-100">
        <div className="max-w-5xl mx-auto space-y-10">
          <div className="text-center space-y-3">
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#1a9f9a" }}>Built to Last</p>
            <ScrollFloat
              animationDuration={1}
              ease="back.inOut(2)"
              scrollStart="center bottom+=50%"
              scrollEnd="bottom bottom-=40%"
              stagger={0.03}
              containerClassName="text-3xl font-bold tracking-tight text-neutral-900"
            >
              Every product. Every standard.
            </ScrollFloat>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {qualities.map((q) => (
              <div key={q.label} className="p-6 rounded-2xl border border-neutral-100 bg-white space-y-3 text-center">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto" style={{ backgroundColor: "#1a9f9a12" }}>
                  <q.icon className="w-5 h-5" style={{ color: "#1a9f9a" }} />
                </div>
                <p className="font-bold text-neutral-900">{q.label}</p>
                <p className="text-xs text-neutral-400 leading-relaxed">{q.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── BMS highlight ── */}
      <div className="py-24 px-4" style={{ backgroundColor: "#0f1a17" }}>
        <div className="max-w-5xl mx-auto space-y-10">

          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-semibold uppercase tracking-widest" style={{ borderColor: "#1a9f9a40", color: "#1a9f9a", backgroundColor: "#1a9f9a10" }}>
                Pakistan's First
              </div>
              <div className="flex flex-col gap-0 mt-1">
                <span className="text-2xl font-bold text-white/40 leading-none">Indigenous Battery</span>
                <span className="text-4xl md:text-5xl font-bold text-white leading-none">Management System</span>
              </div>
            </div>
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0" style={{ backgroundColor: "#1a9f9a20" }}>
              <Cpu className="w-6 h-6" style={{ color: "#1a9f9a" }} />
            </div>
          </div>

          {/* Body + stats grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Description */}
            <div className="rounded-3xl p-8 space-y-4" style={{ backgroundColor: "#ffffff08", border: "1px solid rgba(255,255,255,0.07)" }}>
              <p className="text-[15px] text-white/60 leading-relaxed">
                Voltrix is the only company in Pakistan to have developed its own BMS in-house — a milestone in indigenous energy technology that enables real-time cell monitoring, balancing, and Bluetooth diagnostics.
              </p>
              <div className="w-8 h-0.5 rounded-full" style={{ backgroundColor: "#1a9f9a" }} />
              <p className="text-xs text-white/30 uppercase tracking-widest font-medium">Built entirely in Pakistan</p>
            </div>

            {/* 4 stat tiles */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { v: "Real-time", l: "Cell monitoring",   icon: "⚡" },
                { v: "Smart",     l: "Cell balancing",    icon: "⚖️" },
                { v: "Bluetooth", l: "Diagnostics",       icon: "📡" },
                { v: "Global",    l: "Safety certified",  icon: "🛡️" },
              ].map(({ v, l, icon }) => (
                <div key={l} className="rounded-2xl p-5 space-y-2 flex flex-col justify-between" style={{ backgroundColor: "#1a9f9a12", border: "1px dashed #1a9f9a30" }}>
                  <span className="text-lg">{icon}</span>
                  <div>
                    <p className="text-base font-bold text-white">{v}</p>
                    <p className="text-xs text-white/40">{l}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

    </section>
  )
}
