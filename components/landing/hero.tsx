"use client"

import { useState, useEffect } from "react"
import { ArrowRight, Zap } from "lucide-react"
import GradualBlur from "./gradual-blur"
import RotatingText from "./rotating-text"
import SideRays from "./side-rays"

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
    <section className="relative min-h-screen flex flex-col overflow-hidden bg-neutral-950">
      {/* Dark base */}
      <div className="absolute inset-0 z-0 bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950" />
      <div className="absolute inset-0 z-0 bg-gradient-to-tr from-white/[0.04] via-transparent to-neutral-950/80" />

      {/* Side rays — top-right white glow onto product showcase */}
      <SideRays
        speed={2.5}
        rayColor1="#ffffff"
        rayColor2="#f5f5f5"
        intensity={2.8}
        spread={2.8}
        origin="top-right"
        tilt={-8}
        saturation={1}
        blend={0.55}
        falloff={1.15}
        opacity={1}
      />

      {/* Spotlight pool — lands on hero product images */}
      <div
        className="absolute inset-0 z-[2] pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 50% 42% at 78% 12%, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0.1) 38%, transparent 68%)",
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

      {/* Vignette for depth — keep top-right bright for product highlight */}
      <div
        className="absolute inset-0 z-[3] pointer-events-none bg-gradient-to-t from-neutral-950 via-transparent to-transparent"
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
              <span className="text-[#1a9f9a]">with Voltrix.</span>
            </h1>

            <p className="text-base text-neutral-400 leading-relaxed max-w-2xl">
              Empowering Sustainable Living with Innovative Batteries, Smart Inverters, and{" "}
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

          <div className="hidden lg:flex flex-col items-center justify-center flex-1 relative gap-5 w-[400px] shrink-0">
            <div className="relative w-full flex flex-col items-center">
              <div
                className="absolute -top-6 right-0 w-[92%] h-[72%] pointer-events-none"
                style={{
                  background:
                    "radial-gradient(ellipse 70% 55% at 68% 18%, rgba(255,255,255,0.42) 0%, rgba(255,255,255,0.14) 42%, transparent 72%)",
                  filter: "blur(10px)",
                }}
                aria-hidden
              />
              <div
                className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[78%] h-10 rounded-[100%] bg-black/40 blur-2xl pointer-events-none"
                aria-hidden
              />
              <div
                className="absolute bottom-8 left-1/2 -translate-x-1/2 w-[72%] h-3 rounded-[100%] bg-[#1a9f9a]/20 blur-md pointer-events-none"
                aria-hidden
              />

              <div className="relative w-96 h-[450px] rounded-3xl overflow-visible">
                {heroImages.map((img, index) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={img}
                    src={img}
                    alt=""
                    className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-1000 drop-shadow-[0_0_48px_rgba(255,255,255,0.22)] drop-shadow-[0_32px_48px_rgba(0,0,0,0.45)] ${
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
                  className="relative w-1.5 h-1.5 rounded-full overflow-hidden bg-neutral-700"
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
