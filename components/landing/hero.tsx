"use client"

import { ArrowRight, Zap } from "lucide-react"
import RotatingText from "./rotating-text"
import HeroProductCarousel from "./hero-product-carousel"

export default function Hero() {
  return (
    <section className="relative min-h-screen flex flex-col overflow-hidden bg-white">
      {/* Soft white → cool wash */}
      <div
        className="absolute inset-0 z-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(180deg, #ffffff 0%, #f8fafb 55%, #ffffff 100%)",
        }}
        aria-hidden
      />

      {/* Soft Gaussian shade orbs */}
      <div className="absolute inset-0 z-[1] pointer-events-none overflow-hidden" aria-hidden>
        <div
          className="absolute -top-24 right-[-8%] h-[28rem] w-[28rem] rounded-full"
          style={{ background: "rgba(26, 159, 154, 0.16)", filter: "blur(90px)" }}
        />
        <div
          className="absolute top-[38%] left-[-12%] h-[22rem] w-[22rem] rounded-full"
          style={{ background: "rgba(186, 230, 253, 0.55)", filter: "blur(100px)" }}
        />
        <div
          className="absolute bottom-[-10%] right-[18%] h-[18rem] w-[18rem] rounded-full"
          style={{ background: "rgba(212, 212, 212, 0.45)", filter: "blur(80px)" }}
        />
      </div>

      {/* Very light grid over the blur */}
      <div
        className="absolute inset-0 z-[2] pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(15, 23, 42, 0.04) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(15, 23, 42, 0.04) 1px, transparent 1px)
          `,
          backgroundSize: "56px 56px",
        }}
        aria-hidden
      />

      <div className="relative z-10 flex-1 flex items-center">
        <div className="container mx-auto px-6 lg:px-16 flex flex-col lg:flex-row items-center justify-between gap-10 lg:gap-14 py-28 lg:py-32 w-full">
          <div className="flex flex-col gap-6 max-w-xl lg:max-w-2xl">
            <div className="flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-[#1a9f9a] shrink-0" strokeWidth={2.5} />
              <span className="text-[10px] sm:text-[11px] font-bold text-[#1a9f9a] uppercase tracking-[0.22em]">
                Let&apos;s go off grid.
              </span>
            </div>

            <h1 className="text-[clamp(2.35rem,4.8vw,3.75rem)] font-bold tracking-tight leading-[1.12] text-neutral-900">
              Power your{" "}
              <span className="inline-block min-w-[4.5rem] align-bottom">
                <RotatingText
                  texts={["Drive", "Solar", "EVs", "House"]}
                  splitBy="words"
                  mainClassName="px-1 py-0.5 rounded-md font-bold text-[#1a9f9a]"
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
              <span className="text-[#158a85]">with Voltrix lithium batteries.</span>
            </h1>

            <p className="text-base sm:text-[17px] text-neutral-600 leading-relaxed max-w-xl">
              LiFePO4 solar batteries and hybrid inverters in Pakistan — home storage, load-shedding
              backup, and next-generation energy solutions.
            </p>

            <a
              href="#products"
              className="group flex items-center gap-3 pl-6 pr-2 h-12 rounded-full text-sm font-medium text-white bg-[#1a9f9a] overflow-hidden transition-all duration-300 hover:shadow-md hover:shadow-[#1a9f9a]/25 hover:bg-[#158a85] w-fit cursor-pointer"
            >
              <span className="transition-transform duration-300 group-hover:-translate-x-0.5">
                Explore products
              </span>
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-white/25 transition-all duration-300 group-hover:translate-x-0.5">
                <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </a>
          </div>

          <div className="hidden lg:flex flex-col items-center justify-center flex-1 relative w-full max-w-[400px] shrink-0">
            <HeroProductCarousel />
          </div>

          <div className="lg:hidden w-full mt-2">
            <HeroProductCarousel />
          </div>
        </div>
      </div>

      {/* Soft fade into next section */}
      <div
        className="absolute bottom-0 left-0 right-0 h-16 z-[5] pointer-events-none bg-gradient-to-t from-white to-transparent"
        aria-hidden
      />
    </section>
  )
}
