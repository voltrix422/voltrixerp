// @ts-nocheck
"use client"
import { useState, useEffect } from "react"
import { ArrowRight } from "lucide-react"
import GradualBlur from "./gradual-blur"
import RotatingText from "./rotating-text"
import Silk from "./silk"

// Add fill animation styles
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
  "/craiyon_132822_image.png"
]

export default function Hero() {
  const [currentImageIndex, setCurrentImageIndex] = useState(0)

  // Inject animation styles
  useEffect(() => {
    const style = document.createElement('style')
    style.textContent = fillAnimation
    document.head.appendChild(style)
    return () => { document.head.removeChild(style) }
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % heroImages.length)
    }, 4000)
    return () => clearInterval(interval)
  }, [])

  return (
    <section className="relative min-h-screen flex items-center overflow-hidden">
      {/* Silk Background */}
      <div className="absolute inset-0 z-0 opacity-60">
        <Silk
          speed={3}
          scale={1}
          color="#1a9f9a"
          noiseIntensity={1}
          rotation={0}
        />
      </div>
      
      <div className="container mx-auto px-6 lg:px-16 flex flex-col lg:flex-row items-center justify-between gap-12 py-24 relative pl-32 lg:pl-48 z-10">
        
        {/* Left - Text Content */}
        <div className="flex flex-col gap-6 max-w-xl lg:max-w-2xl lg:mr-12">
          <h1 className="text-[clamp(2.4rem,5vw,4rem)] font-bold tracking-tight leading-[1.15] text-neutral-900">
            Power your{" "}
            <span className="inline-block w-[100px]">
              <RotatingText
                texts={["Drive", "Solar", "EVs", "Car", "House"]}
                mainClassName="px-1 py-1 rounded-lg font-bold text-[#1a9f9a]"
                staggerDuration={0.03}
                staggerFrom="last"
                rotationInterval={2500}
                transition={{ type: "spring", damping: 20, stiffness: 200 }}
                initial={{ y: "100%", opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: "-100%", opacity: 0 }}
                splitLevelClassName="overflow-hidden"
              />
            </span>
            <br />
            <span className="text-[#1a9f9a]">with Voltrix.</span>
          </h1>
          <p className="text-base text-neutral-600 leading-relaxed max-w-md">
            Premium automotive electrical solutions engineered for performance, reliability, and the road ahead.
          </p>
          <a
            href="#products"
            className="group flex items-center gap-3 pl-6 pr-2 h-12 rounded-full text-sm font-medium text-white bg-[#1a9f9a] overflow-hidden transition-all duration-300 hover:shadow-lg hover:bg-[#158a85] w-fit"
          >
            <span className="transition-transform duration-300 group-hover:-translate-x-0.5">
              Explore products
            </span>
            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-white/20 transition-all duration-300 group-hover:translate-x-0.5">
              <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </a>
        </div>

        {/* Right - Image Carousel */}
        <div className="hidden lg:flex flex-col items-center justify-center flex-1 relative gap-4 w-[400px] shrink-0">
          {/* Image Container - No bg, bigger, static position */}
          <div className="relative w-96 h-[450px] rounded-3xl overflow-hidden">
            {heroImages.map((img, index) => (
              <img
                key={img}
                src={img}
                alt=""
                className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-1000 ${
                  index === currentImageIndex ? 'opacity-100' : 'opacity-0'
                }`}
              />
            ))}
          </div>
          
          {/* Static Dots with Loading Animation */}
          <div className="flex items-center gap-1.5">
            {heroImages.map((_, index) => (
              <div
                key={index}
                className="relative w-1.5 h-1.5 rounded-full overflow-hidden bg-neutral-300"
                aria-label={`Slide ${index + 1}`}
              >
                {/* Fill animation for active slide */}
                <div 
                  className={`absolute inset-0 bg-[#1a9f9a] origin-left ${
                    index === currentImageIndex 
                      ? 'animate-fill' 
                      : 'scale-x-0'
                  }`}
                  style={{
                    animation: index === currentImageIndex ? 'fill 4s linear' : 'none'
                  }}
                />
              </div>
            ))}
          </div>
        </div>

      </div>

      <GradualBlur position="bottom" height="6rem" strength={2} divCount={6} curve="bezier" exponential opacity={1} zIndex={5} />
    </section>
  )
}
