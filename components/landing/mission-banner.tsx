// @ts-nocheck
import { Cpu, Battery, Factory, Globe, ArrowRight, Zap } from "lucide-react"

const highlights = [
  { 
    icon: Cpu, 
    title: "First Indigenous BMS",
    desc: "Pakistan's first locally developed Battery Management System technology"
  },
  { 
    icon: Battery, 
    title: "Complete Ecosystem",
    desc: "Comprehensive energy solutions for all applications"
  },
  { 
    icon: Factory, 
    title: "Local Manufacturing",
    desc: "In-house R&D and production facilities"
  },
  { 
    icon: Globe, 
    title: "Global Standards",
    desc: "International quality with local expertise"
  },
]

export default function MissionBanner() {
  return (
    <section className="py-24 px-4 bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 text-white overflow-hidden relative">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{ 
          backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(26,159,154,0.3) 1px, transparent 0)',
          backgroundSize: '40px 40px'
        }} />
      </div>
      
      <div className="max-w-6xl mx-auto relative">
        {/* Main Headline */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#1a9f9a]/30 bg-[#1a9f9a]/10 mb-6">
            <Zap className="w-4 h-4 text-[#1a9f9a]" />
            <span className="text-sm font-medium text-[#1a9f9a]">Our Mission</span>
          </div>
          
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-4">
            <span className="text-white">Powering Pakistan's</span>
            <br />
            <span className="text-[#1a9f9a]">Sustainable Future</span>
          </h2>
          
          <p className="text-neutral-400 text-lg max-w-2xl mx-auto">
            Leading the energy revolution with indigenous technology and world-class innovation
          </p>
        </div>

        {/* Highlights Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {highlights.map((item, index) => (
            <div 
              key={item.title}
              className="group relative p-6 rounded-2xl bg-neutral-800/50 border border-neutral-700/50 hover:border-[#1a9f9a]/50 hover:bg-neutral-800/80 transition-all duration-300"
            >
              {/* Glow effect on hover */}
              <div className="absolute -inset-px rounded-2xl bg-gradient-to-r from-[#1a9f9a]/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-xl" />
              
              <div className="relative">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#1a9f9a]/30 to-[#1a9f9a]/5 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                  <item.icon className="w-7 h-7 text-[#1a9f9a]" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{item.title}</h3>
                <p className="text-sm text-neutral-400 leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="flex justify-center">
          <a
            href="#about"
            className="inline-flex items-center gap-3 px-8 py-4 rounded-full text-base font-semibold text-neutral-950 bg-[#1a9f9a] hover:bg-[#158a85] transition-all duration-300 hover:scale-105 shadow-lg shadow-[#1a9f9a]/20 group"
          >
            More About Us 
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-300" />
          </a>
        </div>
      </div>
    </section>
  )
}
