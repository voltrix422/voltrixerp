// @ts-nocheck
import { Zap, Activity, Box, Shield, ArrowRight } from "lucide-react"
import Image from "next/image"
import ScrollFloat from "./scroll-float"
import ScrollReveal from "./scroll-reveal"

const features = [
  { icon: Zap,      label: "100A Current Rating",    desc: "High power delivery capability"     },
  { icon: Activity, label: "1A Balancing Current",   desc: "Optimal cell health maintenance"    },
  { icon: Box,      label: "Compact Design",         desc: "Space-efficient installation"       },
  { icon: Shield,   label: "Complete Safety",        desc: "Multi-layer protection system"      },
]

export default function FeaturedProduct() {
  return (
    <section className="py-24 px-4 bg-neutral-950 text-white overflow-hidden">
      <div className="max-w-5xl mx-auto space-y-14">

        {/* Header */}
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "#1a9f9a" }}>Innovative Technology</p>
          <ScrollFloat
            animationDuration={1}
            ease="back.inOut(2)"
            scrollStart="center bottom+=50%"
            scrollEnd="bottom bottom-=40%"
            stagger={0.03}
            containerClassName="text-5xl md:text-6xl font-bold tracking-tight leading-none text-white max-w-2xl"
          >
            Advanced Battery
          </ScrollFloat>
          <ScrollFloat
            animationDuration={1}
            ease="back.inOut(2)"
            scrollStart="center bottom+=50%"
            scrollEnd="bottom bottom-=40%"
            stagger={0.03}
            containerClassName="text-4xl md:text-5xl font-bold tracking-tight leading-none text-white/70 max-w-2xl"
          >
            Management System
          </ScrollFloat>
          <p className="text-white/40 text-sm pt-2">For 8s–16s LiFePO₄ Battery Packs · Non-Inverter Type</p>
        </div>

        {/* Card */}
        <div className="rounded-3xl border border-dashed border-white/20 bg-white/5 p-8 md:p-10 grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
          <div className="space-y-5">
            {/* Product image */}
            <div className="relative w-full h-52 rounded-2xl overflow-hidden bg-white/5 border border-white/10">
              <Image src="/(WL-5).webp" alt="Voltrix A-100816 BMS" fill className="object-contain p-4" />
            </div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/5">
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: "#1a9f9a" }} />
              <span className="text-[11px] font-medium text-white/50 tracking-widest uppercase">Voltrix A-100816</span>
            </div>
            <ScrollReveal
              baseOpacity={0.1}
              enableBlur
              baseRotation={2}
              blurStrength={4}
              textClassName="text-white/60 text-[15px] leading-relaxed"
            >
              A compact and intelligent Battery Management System designed for 8s to 16s lithium iron phosphate (LiFePO₄) battery configurations. With a current rating of 100A and 1A balancing current, it ensures stable operation, optimal cell health, and complete system safety.
            </ScrollReveal>
            <div className="flex flex-wrap gap-3 pt-2">
              <a
                href="#products"
                className="flex items-center gap-2 px-5 h-10 rounded-full text-sm font-semibold text-white hover:opacity-90 transition-opacity"
                style={{ backgroundColor: "#1a9f9a" }}
              >
                View All Products <ArrowRight className="w-3.5 h-3.5" />
              </a>
              <a
                href="#contact"
                className="flex items-center gap-2 px-5 h-10 rounded-full text-sm font-medium text-white/60 border border-white/15 hover:text-white hover:border-white/30 transition-all"
              >
                Get Technical Specs
              </a>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {features.map((f) => (
              <div key={f.label} className="p-5 rounded-2xl border border-white/10 bg-white/5 space-y-2">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: "#1a9f9a20" }}>
                  <f.icon className="w-4 h-4" style={{ color: "#1a9f9a" }} />
                </div>
                <p className="text-sm font-semibold text-white">{f.label}</p>
                <p className="text-xs text-white/40 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
