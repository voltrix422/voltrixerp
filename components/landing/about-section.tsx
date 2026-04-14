// @ts-nocheck
import { Shield, Cpu, Globe, Leaf, Factory, Zap } from "lucide-react"
import ScrollFloat from "./scroll-float"
import ScrollReveal from "./scroll-reveal"

const milestones = [
  { value: "1st",  label: "BMS Developed",   desc: "Pakistan's first indigenous Battery Management System" },
  { value: "6+",   label: "Products Range",  desc: "Energy solutions for diverse applications"            },
  { value: "4+",   label: "Focus Areas",     desc: "Residential, Commercial, Industrial & EV"             },
  { value: "100%", label: "Global Standards",desc: "International performance and safety benchmarks"      },
]

const reasons = [
  { icon: Factory, title: "100% Local Manufacturing & In-house R&D",  desc: "Indigenous BMS Technology — Pakistan's first locally developed Battery Management System ensuring safety, intelligence, and global standards." },
  { icon: Zap,     title: "Complete Energy Ecosystem",                 desc: "From EV battery packs to residential, commercial, and industrial energy storage solutions." },
  { icon: Globe,   title: "Top-Tier Technology Partners",              desc: "Collaborating with global leaders to ensure international performance and safety benchmarks." },
  { icon: Leaf,    title: "Green Energy Contribution",                 desc: "Helping customers earn green credits, reduce emissions, and contribute to Pakistan's climate goals." },
  { icon: Shield,  title: "Multi-layer Safety",                        desc: "Every product is engineered with multiple protection layers meeting IEC 62619 and UN 38.3 standards." },
  { icon: Cpu,     title: "Smart BMS Intelligence",                    desc: "Real-time cell monitoring, balancing, and Bluetooth diagnostics built entirely in-house." },
]

export default function AboutSection() {
  return (
    <section id="about" className="bg-white">

      {/* ── Who We Are ── */}
      <div className="py-24 px-4 border-b border-neutral-100 bg-neutral-950">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
          {/* Left */}
          <div className="space-y-5">
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#1a9f9a" }}>Who We Are</p>
            <div className="flex flex-col gap-0">
              <span className="text-2xl font-bold text-white/40 leading-none">Powering the future</span>
              <span className="text-4xl md:text-5xl font-bold text-white leading-none">with innovative,<br/>reliable energy.</span>
            </div>
            <div className="w-10 h-0.5 rounded-full" style={{ backgroundColor: "#1a9f9a" }} />
            <a
              href="#contact"
              className="inline-flex items-center gap-2 px-6 h-11 rounded-full text-sm font-semibold text-white hover:opacity-90 transition-opacity w-fit"
              style={{ backgroundColor: "#1a9f9a" }}
            >
              Contact Us
            </a>
          </div>

          {/* Right */}
          <div className="space-y-4">
            <p className="text-[15px] text-white/60 leading-relaxed">
              At Voltrix, we specialize in the research, design, manufacturing, and integration of advanced lithium battery systems and Battery Energy Storage Solutions (BESS) tailored for commercial and industrial applications, high-quality inverters, EV mobility, charging stations, and many more.
            </p>
            <p className="text-[15px] text-white/35 leading-relaxed">
              With a strong focus on indigenous innovation, we are proud to be Pakistan's first company to develop a Battery Management System entirely in-house.
            </p>
          </div>
        </div>
      </div>


      {/* ── Trusted By ── */}
      <div className="py-20 px-4 bg-neutral-50/60 border-b border-neutral-100">
        <div className="max-w-5xl mx-auto space-y-10">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#1a9f9a" }}>Trusted By</p>
            <ScrollFloat
              animationDuration={1}
              ease="back.inOut(2)"
              scrollStart="center bottom+=50%"
              scrollEnd="bottom bottom-=40%"
              stagger={0.03}
              containerClassName="text-3xl font-bold text-neutral-900 tracking-tight"
            >
              Leading Businesses in Pakistan
            </ScrollFloat>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <ScrollReveal
              baseOpacity={0.1}
              enableBlur
              baseRotation={2}
              blurStrength={4}
              textClassName="text-[15px] text-neutral-500 leading-relaxed"
            >
              Voltrix delivers energy products that meet the demands of Pakistan's evolving power landscape — from electric vehicle battery packs to residential, commercial, and industrial energy storage solutions. Our mission is to bridge the gap between clean energy generation and dependable energy storage.
            </ScrollReveal>
            <ScrollReveal
              baseOpacity={0.1}
              enableBlur
              baseRotation={2}
              blurStrength={4}
              textClassName="text-[15px] text-neutral-500 leading-relaxed"
            >
              We work with top-tier technology partners to ensure every product meets international performance and safety benchmarks. By combining cutting-edge engineering, local expertise, and a vision for a greener tomorrow, we aim to empower communities and drive the nation towards a cleaner, smarter energy future.
            </ScrollReveal>
          </div>
        </div>
      </div>

      {/* ── Milestones ── */}
      <div className="py-20 px-4 border-b border-neutral-100">
        <div className="max-w-5xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-4">
          {milestones.map((m) => (
            <div key={m.label} className="p-6 rounded-2xl border border-neutral-100 bg-white space-y-3">
              <p className="text-4xl font-bold tracking-tight" style={{ color: "#1a9f9a" }}>{m.value}</p>
              <div className="border-t border-neutral-50 pt-3 space-y-0.5">
                <p className="text-sm font-semibold text-neutral-900">{m.label}</p>
                <p className="text-xs text-neutral-400 leading-relaxed">{m.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Why Choose Us ── */}
      <div className="py-24 px-4">
        <div className="max-w-5xl mx-auto space-y-14">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#1a9f9a" }}>Why Choose Us</p>
            <ScrollFloat
              animationDuration={1}
              ease="back.inOut(2)"
              scrollStart="center bottom+=50%"
              scrollEnd="bottom bottom-=40%"
              stagger={0.03}
              containerClassName="text-4xl font-bold text-neutral-900 tracking-tight leading-tight"
            >
              Reliable energy solutions. Trusted for performance.
            </ScrollFloat>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {reasons.map((r) => (
              <div key={r.title} className="p-6 rounded-2xl border border-neutral-100 space-y-3 hover:border-neutral-200 hover:shadow-md hover:shadow-neutral-100 transition-all duration-200">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: "#1a9f9a12" }}>
                  <r.icon className="w-4 h-4" style={{ color: "#1a9f9a" }} />
                </div>
                <h4 className="font-semibold text-neutral-900 text-sm leading-snug">{r.title}</h4>
                <p className="text-sm text-neutral-500 leading-relaxed">{r.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

    </section>
  )
}
