import { Lightbulb, Award, Leaf, ArrowRight } from "lucide-react"
import ScrollFloat from "./scroll-float"
import ScrollReveal from "./scroll-reveal"

const sustainability = [
  "Driving carbon reduction through every Voltrix solution",
  "Supporting clients in earning green credits and achieving compliance with environmental policies",
  "Promoting renewable adoption to combat climate change and safeguard Pakistan's environment",
]

const values = [
  {
    icon: Lightbulb,
    title: "Innovation",
    desc: "Continuous research and development to create cutting-edge energy solutions that meet evolving market needs.",
    color: "#f0fdf4",
  },
  {
    icon: Award,
    title: "Quality",
    desc: "Uncompromising standards in manufacturing to deliver products that exceed international quality benchmarks.",
    color: "#f0f9ff",
  },
  {
    icon: Leaf,
    title: "Sustainability",
    desc: "Commitment to environmental stewardship through clean energy solutions that reduce carbon footprint.",
    color: "#f0fdf4",
  },
]

export default function VisionSection() {
  return (
    <section id="vision" className="bg-white">

      {/* ── Hero ── */}
      <div className="py-24 px-4 border-b border-neutral-100 bg-neutral-950">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-16 items-center">

          {/* Left — heading */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#1a9f9a" }}>Our Vision & Mission</p>
            <div className="flex flex-col gap-0 mt-3">
              <ScrollFloat
                animationDuration={1}
                ease="back.inOut(2)"
                scrollStart="center bottom+=50%"
                scrollEnd="bottom bottom-=40%"
                stagger={0.03}
                containerClassName="text-2xl font-bold tracking-tight text-white/50 leading-none"
              >
                Transforming
              </ScrollFloat>
              <ScrollFloat
                animationDuration={1}
                ease="back.inOut(2)"
                scrollStart="center bottom+=50%"
                scrollEnd="bottom bottom-=40%"
                stagger={0.03}
                containerClassName="text-4xl md:text-5xl font-bold tracking-tight text-white leading-none"
              >
                Ideas into Impact
              </ScrollFloat>
            </div>
            {/* Teal divider */}
            <div className="w-12 h-1 rounded-full mt-6" style={{ backgroundColor: "#1a9f9a" }} />
          </div>

          {/* Right — mission */}
          <div className="space-y-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-white/40">Our Mission</p>
            <ScrollReveal
              baseOpacity={0.1}
              enableBlur
              baseRotation={1}
              blurStrength={3}
              textClassName="text-[15px] text-white/70 leading-relaxed"
            >
              To empower individuals and organizations to embrace clean energy while reducing their carbon footprint. Every solution we create is proudly rooted in local production and backed by continuous R&D, ensuring innovation that is homegrown yet globally competitive.
            </ScrollReveal>
            <ScrollReveal
              baseOpacity={0.1}
              enableBlur
              baseRotation={1}
              blurStrength={3}
              textClassName="text-[15px] text-white/50 leading-relaxed"
            >
              We are committed to develop durable, high-quality products that exceed international standards with a clear vision of exporting to Europe, the USA, and other global markets.
            </ScrollReveal>
          </div>

        </div>
      </div>

      {/* ── Vision + Sustainability ── */}
      <div className="py-24 px-4 border-b border-neutral-100">
        <div className="max-w-5xl mx-auto space-y-5">

          {/* Vision — full width hero strip */}
          <div className="rounded-3xl overflow-hidden grid grid-cols-1 md:grid-cols-2" style={{ backgroundColor: "#0f1a17" }}>
            {/* Left — label + heading */}
            <div className="p-10 flex flex-col justify-between gap-8">
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#1a9f9a" }}>Our Vision</p>
                <h3 className="text-3xl font-bold text-white leading-snug mt-2">
                  A cleaner, smarter<br />energy future for<br />Pakistan and beyond.
                </h3>
              </div>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: "#1a9f9a20" }}>
                <Leaf className="w-5 h-5" style={{ color: "#1a9f9a" }} />
              </div>
            </div>
            {/* Right — body */}
            <div className="p-10 flex items-center" style={{ backgroundColor: "#1a9f9a10", borderLeft: "1px solid rgba(255,255,255,0.06)" }}>
              <p className="text-[15px] text-white/60 leading-relaxed">
                We envision a Pakistan where every home, business, and vehicle runs on clean, locally-produced energy — independent of fossil fuels and capable of competing on the global stage.
              </p>
            </div>
          </div>

          {/* Sustainability — card with numbered items */}
          <div className="rounded-3xl border border-neutral-100 bg-white p-10 space-y-8">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#1a9f9a" }}>Our Sustainability Commitment</p>
                <h3 className="text-2xl font-bold text-neutral-900 leading-snug">Driving carbon reduction<br />through every Voltrix solution.</h3>
              </div>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "#1a9f9a15" }}>
                <Leaf className="w-5 h-5" style={{ color: "#1a9f9a" }} />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {sustainability.map((s, i) => (
                <div key={i} className="rounded-2xl p-5 space-y-3" style={{ backgroundColor: "#f7faf9", border: "1px solid #e6f4f1" }}>
                  <span className="text-xs font-bold tabular-nums" style={{ color: "#1a9f9a" }}>0{i + 1}</span>
                  <p className="text-sm text-neutral-700 leading-relaxed">{s}</p>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* ── Core Values ── */}
      <div className="py-24 px-4">
        <div className="max-w-5xl mx-auto space-y-14">
          <div className="text-center space-y-3">
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#1a9f9a" }}>Our Commitment</p>
            <ScrollFloat
              animationDuration={1}
              ease="back.inOut(2)"
              scrollStart="center bottom+=50%"
              scrollEnd="bottom bottom-=40%"
              stagger={0.03}
              containerClassName="text-4xl font-bold tracking-tight text-neutral-900"
            >
              Core Values That Drive Us
            </ScrollFloat>
            <p className="text-neutral-500 text-sm max-w-md mx-auto">The principles that guide our decisions and actions every day.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {values.map((v) => (
              <div
                key={v.title}
                className="rounded-3xl p-8 space-y-4 border border-neutral-100"
                style={{ backgroundColor: v.color }}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: "#1a9f9a15" }}>
                  <v.icon className="w-5 h-5" style={{ color: "#1a9f9a" }} />
                </div>
                <h3 className="text-lg font-bold text-neutral-900">{v.title}</h3>
                <ScrollReveal
                  baseOpacity={0.1}
                  enableBlur
                  baseRotation={2}
                  blurStrength={4}
                  textClassName="text-sm text-neutral-500 leading-relaxed"
                >
                  {v.desc}
                </ScrollReveal>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="text-center pt-4">
            <a
              href="#contact"
              className="inline-flex items-center gap-2 px-8 h-12 rounded-full text-sm font-semibold text-white hover:opacity-90 transition-opacity"
              style={{ backgroundColor: "#1a9f9a" }}
            >
              Work with us <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>

    </section>
  )
}
