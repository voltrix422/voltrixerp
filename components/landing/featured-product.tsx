// @ts-nocheck
import { Zap, Activity, Box, Shield, ArrowRight, Sparkles } from "lucide-react"
import Image from "next/image"
import ScrollFloat from "./scroll-float"

const features = [
  { icon: Zap,      label: "100A Current Rating",    desc: "High power delivery capability"     },
  { icon: Activity, label: "1A Balancing Current",   desc: "Optimal cell health maintenance"    },
  { icon: Box,      label: "Compact Design",         desc: "Space-efficient installation"       },
  { icon: Shield,   label: "Complete Safety",        desc: "Multi-layer protection system"      },
]

export default function FeaturedProduct() {
  return (
    <section className="py-24 px-4 bg-gradient-to-b from-neutral-950 via-neutral-900 to-neutral-950 text-white overflow-hidden">
      <div className="max-w-6xl mx-auto">
        
        {/* Section Header */}
        <div className="flex flex-col items-center text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-teal-500/30 bg-teal-500/10 mb-6">
            <Sparkles className="w-4 h-4 text-[#1a9f9a]" />
            <span className="text-sm font-medium text-[#1a9f9a] tracking-wide">Innovative Technology</span>
          </div>
          
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-4">
            <span className="text-white">Advanced Battery</span>
            <br />
            <span className="text-[#1a9f9a]">Management System</span>
          </h2>
          
          <p className="text-neutral-400 text-lg max-w-2xl">
            For 8s–16s LiFePO₄ Battery Packs · Non-Inverter Type
          </p>
        </div>

        {/* Main Product Card */}
        <div className="relative rounded-3xl bg-gradient-to-br from-neutral-800/50 to-neutral-900/50 border border-neutral-700/50 p-8 md:p-12 backdrop-blur-sm">
          {/* Glow effect */}
          <div className="absolute -inset-px rounded-3xl bg-gradient-to-r from-[#1a9f9a]/20 via-transparent to-[#1a9f9a]/20 blur-xl opacity-50" />
          
          <div className="relative grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left - Product Image & Details */}
            <div className="space-y-8">
              {/* Product Badge */}
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#1a9f9a]/20 border border-[#1a9f9a]/30">
                <span className="w-2 h-2 rounded-full bg-[#1a9f9a] animate-pulse" />
                <span className="text-sm font-semibold text-[#1a9f9a]">Voltrix A-100816</span>
              </div>
              
              {/* Product Image */}
              <div className="relative aspect-square max-w-md mx-auto lg:mx-0 rounded-2xl overflow-hidden bg-gradient-to-br from-neutral-800 to-neutral-900 border border-neutral-700/50 group">
                <div className="absolute inset-0 bg-gradient-to-t from-[#1a9f9a]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <Image 
                  src="/(WL-5).webp" 
                  alt="Voltrix A-100816 BMS" 
                  fill 
                  className="object-contain p-6 group-hover:scale-105 transition-transform duration-500" 
                />
              </div>
              
              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-4">
                <a
                  href="#products"
                  className="flex items-center justify-center gap-2 px-6 py-3 rounded-full text-sm font-semibold text-neutral-950 bg-[#1a9f9a] hover:bg-[#158a85] transition-all duration-300 hover:scale-105 shadow-lg shadow-[#1a9f9a]/20"
                >
                  View All Products <ArrowRight className="w-4 h-4" />
                </a>
                <a
                  href="#contact"
                  className="flex items-center justify-center gap-2 px-6 py-3 rounded-full text-sm font-medium text-white border border-neutral-600 hover:border-[#1a9f9a]/50 hover:bg-[#1a9f9a]/10 transition-all duration-300"
                >
                  Get Technical Specs
                </a>
              </div>
            </div>

            {/* Right - Features Grid */}
            <div className="space-y-6">
              {/* Description */}
              <p className="text-neutral-300 text-lg leading-relaxed">
                A compact and intelligent Battery Management System designed for 8s to 16s lithium iron phosphate (LiFePO₄) battery configurations. With a current rating of 100A and 1A balancing current, it ensures stable operation, optimal cell health, and complete system safety.
              </p>
              
              {/* Features Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {features.map((f, index) => (
                  <div 
                    key={f.label} 
                    className="group p-5 rounded-2xl bg-neutral-800/50 border border-neutral-700/50 hover:border-[#1a9f9a]/30 hover:bg-neutral-800/80 transition-all duration-300"
                  >
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#1a9f9a]/20 to-[#1a9f9a]/5 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                      <f.icon className="w-6 h-6 text-[#1a9f9a]" />
                    </div>
                    <p className="text-base font-semibold text-white mb-1">{f.label}</p>
                    <p className="text-sm text-neutral-400 leading-relaxed">{f.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
