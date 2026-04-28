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
    <section className="py-24 px-4 bg-white text-neutral-900">
      <div className="max-w-6xl mx-auto">
        {/* Main Headline */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#1a9f9a]/30 bg-[#1a9f9a]/10 mb-6">
            <Zap className="w-4 h-4 text-[#1a9f9a]" />
            <span className="text-sm font-medium text-[#1a9f9a]">Our Mission</span>
          </div>
          
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-4">
            <span className="text-neutral-900">Powering Pakistan's</span>
            <br />
            <span className="text-[#1a9f9a]">Sustainable Future</span>
          </h2>
          
          <p className="text-neutral-500 text-lg max-w-2xl mx-auto">
            Leading the energy revolution with indigenous technology and world-class innovation
          </p>
        </div>

        {/* Highlights Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {highlights.map((item, index) => (
            <div 
              key={item.title}
              className="group p-6 rounded-2xl bg-neutral-50 border border-neutral-200 hover:border-[#1a9f9a]/30 hover:shadow-lg transition-all duration-300"
            >
              <div className="w-14 h-14 rounded-2xl bg-[#1a9f9a]/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                <item.icon className="w-7 h-7 text-[#1a9f9a]" />
              </div>
              <h3 className="text-lg font-semibold text-neutral-900 mb-2">{item.title}</h3>
              <p className="text-sm text-neutral-500 leading-relaxed">{item.desc}</p>
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
