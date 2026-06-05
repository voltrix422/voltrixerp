"use client"

import { useState, useEffect, Fragment } from "react"
import { ArrowRight, Zap } from "lucide-react"
import GradualBlur from "./gradual-blur"
import RotatingText from "./rotating-text"

const fillAnimation = `
@keyframes fill {
  from { transform: scaleX(0); }
  to { transform: scaleX(1); }
}
`

const heroImages = [
  "/craiyon_130718_image.png",
  "/craiyon_130930_image.png",
  "/craiyon_131152_image.png",
  "/craiyon_132822_image.png",
]

const SECTOR_STRIP = [
  "Residential",
  "Commercial",
  "Industrial BESS",
  "EV Packs",
]

export default function Hero() {
  const [currentImageIndex, setCurrentImageIndex] = useState(0)

  useEffect(() => {
    const style = document.createElement("style")
    style.textContent = fillAnimation
    document.head.appendChild(style)
    return () => {
      document.head.removeChild(style)
    }
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImageIndex(prev => (prev + 1) % heroImages.length)
    }, 4000)
    return () => clearInterval(interval)
  }, [])

  return (
    <section className="relative min-h-screen flex flex-col overflow-hidden">
      {/* Base gradient */}
      <div className="absolute inset-0 z-0 bg-gradient-to-br from-[#1a9f9a]/20 via-white to-white" />

      {/* 50px geometric grid — opacity ~0.03 */}
      <div
        className="absolute inset-0 z-[1] pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(26, 159, 154, 0.14) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(26, 159, 154, 0.14) 1px, transparent 1px)
          `,
          backgroundSize: "50px 50px",
          opacity: 0.03,
        }}
        aria-hidden
      />

      {/* Main hero content */}
      <div className="relative z-10 flex-1 flex items-center">
        <div className="container mx-auto px-6 lg:px-16 flex flex-col lg:flex-row items-center justify-between gap-12 py-24 lg:py-28 relative pl-6 sm:pl-12 lg:pl-48 w-full">
          {/* Left — text */}
          <div className="flex flex-col gap-6 max-w-xl lg:max-w-2xl lg:mr-12">
            <div className="flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-[#1a9f9a] shrink-0" strokeWidth={2.5} />
              <span className="text-[10px] sm:text-[11px] font-bold text-[#1a9f9a] uppercase tracking-[0.22em]">
                Let&apos;s go off grid.
              </span>
            </div>

            <h1 className="text-[clamp(2.4rem,5vw,4rem)] font-bold tracking-tight leading-[1.15] text-neutral-900">
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
              <span className="text-[#1a9f9a]">with Voltrix.</span>
            </h1>

            <p className="text-base text-neutral-600 leading-relaxed max-w-2xl">
              Empowering Sustainable Living with Innovative Batteries, Smart Inverters, and{" "}
              <span className="whitespace-nowrap">Next-Generation Energy Solutions</span>
            </p>

            <a
              href="#products"
              className="group flex items-center gap-3 pl-6 pr-2 h-12 rounded-full text-sm font-medium text-white bg-[#1a9f9a] overflow-hidden transition-all duration-300 hover:shadow-lg hover:bg-[#158a85] w-fit cursor-pointer"
            >
              <span className="transition-transform duration-300 group-hover:-translate-x-0.5">
                Explore products
              </span>
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-white/20 transition-all duration-300 group-hover:translate-x-0.5">
                <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </a>
          </div>

          {/* Right — carousel on platform */}
          <div className="hidden lg:flex flex-col items-center justify-center flex-1 relative gap-5 w-[400px] shrink-0">
            <div className="relative w-full flex flex-col items-center">
              {/* Soft ground shadow */}
              <div
                className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[78%] h-10 rounded-[100%] bg-neutral-900/[0.08] blur-2xl pointer-events-none"
                aria-hidden
              />
              <div
                className="absolute bottom-8 left-1/2 -translate-x-1/2 w-[72%] h-3 rounded-[100%] bg-neutral-900/[0.06] blur-md pointer-events-none"
                aria-hidden
              />

              <div className="relative w-96 h-[450px] rounded-3xl overflow-visible">
                {heroImages.map((img, index) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={img}
                    src={img}
                    alt=""
                    className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-1000 drop-shadow-[0_28px_32px_rgba(0,0,0,0.12)] ${
                      index === currentImageIndex ? "opacity-100" : "opacity-0"
                    }`}
                  />
                ))}
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {heroImages.map((_, index) => (
                <div
                  key={index}
                  className="relative w-1.5 h-1.5 rounded-full overflow-hidden bg-neutral-300"
                  aria-label={`Slide ${index + 1}`}
                >
                  <div
                    className={`absolute inset-0 bg-[#1a9f9a] origin-left ${
                      index === currentImageIndex ? "animate-fill" : "scale-x-0"
                    }`}
                    style={{
                      animation: index === currentImageIndex ? "fill 4s linear" : "none",
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Social proof strip — above the fold line */}
      <div className="relative z-10 border-t border-neutral-200/50 bg-white/50 backdrop-blur-[2px]">
        <div className="container mx-auto px-6 lg:px-16 py-4 lg:py-5">
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 sm:gap-x-0">
            {SECTOR_STRIP.map((label, i) => (
              <Fragment key={label}>
                {i > 0 && (
                  <span
                    className="hidden sm:inline-block w-px h-3 bg-neutral-300/80 mx-6 lg:mx-10"
                    aria-hidden
                  />
                )}
                <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-400 whitespace-nowrap">
                  {label}
                </span>
              </Fragment>
            ))}
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
