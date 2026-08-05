// @ts-nocheck
"use client"

import { useState } from "react"
import { Wrench, Truck, Settings, RefreshCw, ClipboardList, Zap, ArrowRight, Building2, Cpu, HardHat, Leaf, ChevronRight } from "lucide-react"

const cards = [
  {
    tag: "BOT Model",
    icon: RefreshCw,
    heading: "Build-Operate-Transfer.",
    sub: "Zero upfront investment.",
    body: "Voltrix finances, builds, and operates the solar energy system for a fixed term. Clients benefit from solar power with no upfront cost. At term end, ownership transfers to the client — a sustainable, low-risk path to renewable energy.",
    items: null,
  },
  {
    tag: "EPC Solutions",
    icon: HardHat,
    heading: "Complete engineering,",
    sub: "procurement & construction.",
    body: "We provide full Engineering, Procurement & Construction services for large-scale energy infrastructure projects.",
    items: [
      { icon: Settings, title: "Design & Engineering",        desc: "Tailored designs for site-specific requirements." },
      { icon: Truck,    title: "Procurement",                 desc: "High-quality components from trusted manufacturers." },
      { icon: Zap,      title: "Construction & Commissioning",desc: "Complete installation and operational handover." },
    ],
  },
  {
    tag: "Installation & Commissioning",
    icon: Wrench,
    heading: "End-to-end EPC solutions",
    sub: "for commercial & industrial.",
    body: "Turnkey execution from initial design through final commissioning — with a strong emphasis on quality, safety, and long-term performance.",
    items: null,
  },
  {
    tag: "Our EPC Scope",
    icon: ClipboardList,
    heading: "Everything covered,",
    sub: "end to end.",
    body: "System design, certified procurement, professional installation, performance testing, and ongoing O&M — all under one roof.",
    items: [
      { icon: Settings,      title: "System Design",          desc: "Customized solutions for site-specific needs." },
      { icon: Truck,         title: "Procurement & Supply",   desc: "Only certified panels, inverters, and components." },
      { icon: Zap,           title: "Installation",           desc: "Professional install to global safety standards." },
      { icon: ClipboardList, title: "Performance Testing",    desc: "Thorough testing to guarantee all benchmarks." },
      { icon: RefreshCw,     title: "O&M",                   desc: "Ongoing monitoring for peak efficiency." },
      { icon: Wrench,        title: "Technical Support",      desc: "Continuous support and system monitoring." },
    ],
  },
  {
    tag: "Renewable Energy",
    icon: Leaf,
    heading: "Sustainable power",
    sub: "for a greener tomorrow.",
    body: "From rooftop solar to grid-scale BESS, Voltrix delivers clean energy solutions that reduce costs and carbon footprints for businesses across Pakistan.",
    items: null,
  },
  {
    tag: "Industrial Solutions",
    icon: Building2,
    heading: "Built for industry,",
    sub: "engineered to last.",
    body: "Heavy-duty energy systems designed for factories, commercial facilities, and large-scale operations — reliable, scalable, and backed by expert support.",
    items: null,
  },
  {
    tag: "Smart Technology",
    icon: Cpu,
    heading: "Intelligent BMS",
    sub: "at the core of every pack.",
    body: "Every Voltrix pack includes a Smart BMS for optimal cell health, safety, and real-time diagnostics via Bluetooth — built for LiFePO₄ chemistry.",
    items: null,
  },
]

export default function ServicesSection() {
  const [activeService, setActiveService] = useState(0)
  
  return (
    <section id="services" className="bg-white py-20 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <span className="text-xs font-semibold uppercase tracking-widest text-[#1a9f9a] mb-2 block">Our Services</span>
          <h2 className="text-4xl md:text-5xl font-bold text-neutral-900">
            Smart Solutions for <span className="text-[#1a9f9a]">Every Need</span>
          </h2>
        </div>

        {/* Compact Tabbed Layout */}
        <div className="grid md:grid-cols-12 gap-6">
          {/* Service List - Left Side */}
          <div className="md:col-span-5 space-y-2">
            {cards.map((item, index) => (
              <button
                key={item.tag}
                onClick={() => setActiveService(index)}
                onMouseEnter={() => setActiveService(index)}
                className={`w-full flex items-center gap-4 p-4 rounded-xl text-left transition-all duration-200 ${
                  activeService === index 
                    ? 'bg-[#1a9f9a] text-white shadow-lg' 
                    : 'bg-neutral-50 hover:bg-neutral-100 text-neutral-700'
                }`}
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                  activeService === index ? 'bg-white/20' : 'bg-[#1a9f9a]/10'
                }`}>
                  <item.icon className={`w-5 h-5 ${activeService === index ? 'text-white' : 'text-[#1a9f9a]'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{item.tag}</p>
                  <p className={`text-xs truncate ${activeService === index ? 'text-white/80' : 'text-neutral-500'}`}>
                    {item.heading}
                  </p>
                </div>
                <ChevronRight className={`w-4 h-4 shrink-0 transition-transform ${
                  activeService === index ? 'rotate-90' : ''
                }`} />
              </button>
            ))}
          </div>

          {/* Service Detail - Right Side */}
          <div className="md:col-span-7">
            <div className="bg-neutral-50 rounded-2xl p-6 h-full border border-neutral-100">
              {(() => {
                const item = cards[activeService]
                return (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-[#1a9f9a]/10 flex items-center justify-center">
                        <item.icon className="w-6 h-6 text-[#1a9f9a]" />
                      </div>
                      <div>
                        <span className="text-xs font-semibold uppercase tracking-widest text-[#1a9f9a]">{item.tag}</span>
                        <h3 className="text-lg font-bold text-neutral-900">{item.heading} <span className="text-[#1a9f9a]">{item.sub}</span></h3>
                      </div>
                    </div>
                    
                    <p className="text-neutral-600 text-sm leading-relaxed">{item.body}</p>
                    
                    {item.items && (
                      <div className="grid grid-cols-2 gap-3 pt-2">
                        {item.items.map((subItem) => (
                          <div key={subItem.title} className="flex items-start gap-2 p-3 rounded-lg bg-white border border-neutral-100">
                            <div className="w-5 h-5 rounded bg-[#1a9f9a]/10 flex items-center justify-center shrink-0">
                              <subItem.icon className="w-3 h-3 text-[#1a9f9a]" />
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-neutral-900">{subItem.title}</p>
                              <p className="text-xs text-neutral-500 leading-tight">{subItem.desc}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })()}
            </div>
          </div>
        </div>
      </div>
      {/* CTA */}
      <div className="py-24 px-4">
        <div className="max-w-6xl mx-auto">
          <div
            className="relative rounded-3xl p-12 md:p-16 overflow-hidden"
            style={{
              background: "linear-gradient(135deg, #1a9f9a 0%, #158a85 100%)"
            }}
          >
            {/* Decorative elements */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-72 h-72 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[radial-gradient(circle,rgba(255,255,255,0.1)_0%,transparent_70%)]" />

            <div className="relative z-10 grid md:grid-cols-2 gap-12 items-center">
              <div className="space-y-6">
                <h3 className="text-4xl md:text-5xl font-bold text-white leading-tight">
                  Ready to get started?
                </h3>
                <p className="text-white/80 text-lg leading-relaxed max-w-md">
                  Talk to our team about your energy needs and we'll design the right solution for you.
                </p>
                <a
                  href="#contact"
                  className="inline-flex items-center gap-3 px-8 py-4 rounded-full text-base font-semibold text-[#1a9f9a] bg-white hover:bg-white/90 transition-all duration-300 hover:scale-105 hover:shadow-xl group"
                >
                  Contact us
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-300" />
                </a>
              </div>

              {/* Stats/Features */}
              <div className="grid grid-cols-2 gap-6">
                <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 text-center">
                  <div className="text-3xl font-bold text-white mb-1">500+</div>
                  <div className="text-white/70 text-sm">Projects Delivered</div>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 text-center">
                  <div className="text-3xl font-bold text-white mb-1">98%</div>
                  <div className="text-white/70 text-sm">Client Satisfaction</div>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 text-center">
                  <div className="text-3xl font-bold text-white mb-1">24/7</div>
                  <div className="text-white/70 text-sm">Support Available</div>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 text-center">
                  <div className="text-3xl font-bold text-white mb-1">10+</div>
                  <div className="text-white/70 text-sm">Years Experience</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
