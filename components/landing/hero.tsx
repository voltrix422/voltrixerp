"use client"

import { ArrowRight, Zap } from "lucide-react"
import GradualBlur from "./gradual-blur"
import RotatingText from "./rotating-text"
import SideRays from "./side-rays"
import HeroProductCarousel from "./hero-product-carousel"

export default function Hero() {

  return (
    <section className="relative min-h-screen flex flex-col overflow-hidden bg-neutral-950">
      {/* Dark base */}
      <div className="absolute inset-0 z-0 bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950" />
      <div className="absolute inset-0 z-0 bg-gradient-to-tr from-white/[0.04] via-transparent to-neutral-950/80" />

      {/* Side rays — subtle top-right glow */}
      <SideRays
        speed={2.5}
        rayColor1="#ffffff"
        rayColor2="#e8e8e8"
        intensity={1.6}
        spread={2.2}
        origin="top-right"
        tilt={-4}
        saturation={1}
        blend={0.65}
        falloff={1.5}
        opacity={0.65}
      />

      {/* Soft highlight on product area */}
      <div
        className="absolute inset-0 z-[2] pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 45% 38% at 78% 14%, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.03) 40%, transparent 70%)",
        }}
        aria-hidden
      />

      {/* 50px grid on dark */}
      <div
        className="absolute inset-0 z-[1] pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(255, 255, 255, 0.2) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255, 255, 255, 0.2) 1px, transparent 1px)
          `,
          backgroundSize: "50px 50px",
          opacity: 0.03,
        }}
        aria-hidden
      />

      {/* Vignette for depth */}
      <div
        className="absolute inset-0 z-[3] pointer-events-none bg-gradient-to-t from-neutral-950 via-transparent to-neutral-950/25"
        aria-hidden
      />

      {/* Main hero content */}
      <div className="relative z-10 flex-1 flex items-center">
        <div className="container mx-auto px-6 lg:px-16 flex flex-col lg:flex-row items-center justify-between gap-12 py-24 lg:py-28 relative pl-6 sm:pl-12 lg:pl-48 w-full">
          <div className="flex flex-col gap-6 max-w-xl lg:max-w-2xl lg:mr-12">
            <div className="flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-[#1a9f9a] shrink-0" strokeWidth={2.5} />
              <span className="text-[10px] sm:text-[11px] font-bold text-[#1a9f9a] uppercase tracking-[0.22em]">
                Let&apos;s go off grid.
              </span>
            </div>

            <h1 className="text-[clamp(2.4rem,5vw,4rem)] font-bold tracking-tight leading-[1.15] text-white">
              Power your{" "}
              <span className="inline-block min-w-[4.5rem] align-bottom">
                <RotatingText
                  texts={["Drive", "Solar", "EVs", "House"]}
                  splitBy="words"
                  mainClassName="px-1 py-1 rounded-lg font-bold text-[#1a9f9a]"
                  staggerDuration={0.03}
                  staggerFrom="last"
                  rotationInterval={2500}
                  transition={{ type: "spring", damping: 20, stiffness: 200 }}
                  initial={{ y: "100%", opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: "-100%", opacity: 0 }}
                  splitLevelClassName="overflow-hidden inline-block"
                />
              </span>
              <br />
              <span className="text-[#1a9f9a]">with Voltrix lithium batteries.</span>
            </h1>

            <p className="text-base text-neutral-400 leading-relaxed max-w-2xl">
              Empowering Sustainable Living with Innovative Lithium Batteries, Smart Inverters, and{" "}
              <span className="whitespace-nowrap">Next-Generation Energy Solutions</span>
            </p>

            <a
              href="#products"
              className="group flex items-center gap-3 pl-6 pr-2 h-12 rounded-full text-sm font-medium text-white bg-[#1a9f9a] overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-[#1a9f9a]/25 hover:bg-[#158a85] w-fit cursor-pointer"
            >
              <span className="transition-transform duration-300 group-hover:-translate-x-0.5">
                Explore products
              </span>
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-white/20 transition-all duration-300 group-hover:translate-x-0.5">
                <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </a>
          </div>

          <div className="hidden lg:flex flex-col items-center justify-center flex-1 relative w-[400px] shrink-0">
            <HeroProductCarousel />
          </div>

          <div className="lg:hidden w-full mt-4">
            <HeroProductCarousel />
          </div>
        </div>
      </div>

      <GradualBlur
        position="bottom"
        height="6rem"
        strength={2}
        divCount={6}
        curve="bezier"
        exponential
        opacity={1}
        zIndex={5}
      />
    </section>
  )
}
