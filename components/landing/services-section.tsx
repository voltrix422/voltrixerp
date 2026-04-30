// @ts-nocheck
"use client"

import { useEffect, useRef, useState } from "react"
import { Wrench, Truck, Settings, RefreshCw, ClipboardList, Zap, ArrowRight, Building2, Cpu, HardHat, Leaf } from "lucide-react"
import ScrollFloat from "./scroll-float"
import ScrollReveal from "./scroll-reveal"

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
    body: "Our indigenously developed Battery Management Systems ensure optimal cell health, safety, and real-time diagnostics via Bluetooth — built for LiFePO₄ chemistry.",
    items: null,
  },
]

export default function ServicesSection() {
  const [active, setActive] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const dragStartX = useRef<number | null>(null)
  const isDragging = useRef(false)

  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setActive((prev) => (prev + 1) % cards.length)
    }, 10000)
  }

  useEffect(() => {
    startTimer()
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [])

  const goTo = (i: number) => {
    setActive(i)
    startTimer()
  }

  const onDragStart = (e: React.PointerEvent) => {
    dragStartX.current = e.clientX
    isDragging.current = false
  }

  const onDragMove = (e: React.PointerEvent) => {
    if (dragStartX.current !== null && Math.abs(e.clientX - dragStartX.current) > 5) {
      isDragging.current = true
    }
  }

  const onDragEnd = (e: React.PointerEvent) => {
    if (dragStartX.current === null) return
    const diff = dragStartX.current - e.clientX
    if (Math.abs(diff) > 50) {
      if (diff > 0) goTo((active + 1) % cards.length)
      else goTo((active - 1 + cards.length) % cards.length)
    }
    dragStartX.current = null
    isDragging.current = false
  }

  const card = cards[active]

  return (
    <section id="services" className="bg-white">

      {/* Hero */}
      <div className="py-24 px-4 text-center">
        <div className="max-w-3xl mx-auto space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#1a9f9a" }}>Our Services</p>
          <div className="flex flex-col gap-0">
            <ScrollFloat animationDuration={1} ease="back.inOut(2)" scrollStart="center bottom+=50%" scrollEnd="bottom bottom-=40%" stagger={0.03} containerClassName="text-3xl font-bold tracking-tight text-neutral-900 leading-none">
              Empowering Businesses with
            </ScrollFloat>
            <ScrollFloat animationDuration={1} ease="back.inOut(2)" scrollStart="center bottom+=50%" scrollEnd="bottom bottom-=40%" stagger={0.03} containerClassName="text-5xl md:text-6xl font-bold tracking-tight text-neutral-900 leading-none">
              Smart Solutions
            </ScrollFloat>
          </div>
          <ScrollReveal baseOpacity={0.1} enableBlur baseRotation={2} blurStrength={4} textClassName="text-neutral-500 text-base leading-relaxed max-w-xl mx-auto">
            Innovative, reliable, and result-driven services to help you achieve your business goals efficiently and effectively.
          </ScrollReveal>
        </div>
      </div>

      {/* Carousel */}
      <div className="pb-24 px-4">
        <div className="max-w-4xl mx-auto space-y-6">

          {/* Card */}
          <div
            key={active}
            className="rounded-3xl border border-neutral-100 bg-white p-8 md:p-10 space-y-6 shadow-sm select-none cursor-grab active:cursor-grabbing"
            style={{ animation: "slideInRight 0.45s cubic-bezier(0.22,1,0.36,1)" }}
            onPointerDown={onDragStart}
            onPointerMove={onDragMove}
            onPointerUp={onDragEnd}
            onPointerLeave={onDragEnd}
          >
            {/* Top row */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "#1a9f9a15" }}>
                <card.icon className="w-4.5 h-4.5" style={{ color: "#1a9f9a" }} strokeWidth={1.8} />
              </div>
              <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#1a9f9a" }}>{card.tag}</span>
            </div>

            {/* Heading */}
            <div>
              <h3 className="text-2xl md:text-3xl font-bold text-neutral-900 tracking-tight leading-snug">{card.heading}</h3>
              <p className="text-2xl md:text-3xl font-bold tracking-tight leading-snug" style={{ color: "#1a9f9a" }}>{card.sub}</p>
            </div>

            {/* Body */}
            <p className="text-neutral-500 text-sm leading-relaxed max-w-2xl">{card.body}</p>

            {/* Items grid */}
            {card.items && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pt-2">
                {card.items.map((item) => (
                  <div key={item.title} className="flex items-start gap-3 p-4 rounded-2xl bg-neutral-50 border border-neutral-100">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "#1a9f9a12" }}>
                      <item.icon className="w-3.5 h-3.5" style={{ color: "#1a9f9a" }} />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-neutral-900">{item.title}</p>
                      <p className="text-xs text-neutral-400 mt-0.5 leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Dots + progress */}
          <div className="flex items-center justify-center gap-2">
            {cards.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                className="h-1.5 rounded-full transition-all duration-300"
                style={{
                  width: i === active ? "2rem" : "0.5rem",
                  backgroundColor: i === active ? "#1a9f9a" : "#d4d4d4",
                }}
              />
            ))}
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

      <style>{`
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(48px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </section>
  )
}
