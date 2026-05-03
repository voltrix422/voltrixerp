// @ts-nocheck
"use client"
import { useState, useEffect } from "react"
import { ArrowRight } from "lucide-react"
import GradualBlur from "./gradual-blur"
import RotatingText from "./rotating-text"

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
    <section className="relative min-h-[85vh] flex items-center overflow-hidden pt-20 pb-8">
      {/* Colored Container - smaller from bottom, more top margin */}
      <div className="absolute inset-x-0 top-20 bottom-8 z-0 mx-4 lg:mx-8 rounded-2xl bg-[#1a9f9a] shadow-2xl" />
      
      <div className="container mx-auto px-6 lg:px-16 flex flex-col lg:flex-row items-center justify-between gap-12 py-24 relative pl-32 lg:pl-48 z-10">
        
        {/* Left - Text Content */}
        <div className="flex flex-col gap-6 max-w-xl lg:max-w-2xl lg:mr-12">
          <h1 className="text-[clamp(2.4rem,5vw,4rem)] font-bold tracking-tight leading-[1.1] text-white">
            <span className="block text-4xl lg:text-5xl font-medium mb-2">Power your</span>
            <span className="block">
              <span className="inline-flex flex-col text-7xl lg:text-8xl font-black tracking-wider leading-none">
                <span className="block -mb-2">H</span>
                <span className="block -mb-2">o</span>
                <span className="block -mb-2">u</span>
                <span className="block -mb-2">s</span>
                <span className="block">e</span>
              </span>
            </span>
            <span className="block mt-6 text-3xl lg:text-4xl font-medium">with Voltrix.</span>
          </h1>
          <p className="text-lg text-white/95 leading-relaxed max-w-md font-light">
            Premium automotive electrical solutions engineered for performance, reliability, and the road ahead.
          </p>
          <a
            href="#products"
            className="group flex items-center gap-3 pl-6 pr-2 h-12 rounded-full text-sm font-semibold text-[#1a9f9a] bg-white overflow-hidden transition-all duration-300 hover:shadow-lg hover:bg-gray-50 w-fit"
          >
            <span className="transition-transform duration-300 group-hover:-translate-x-0.5">
              Explore products
            </span>
            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-[#1a9f9a]/10 group-hover:bg-[#1a9f9a]/20 transition-all duration-300 group-hover:translate-x-0.5">
              <ArrowRight className="w-3.5 h-3.5 text-[#1a9f9a]" />
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

    </section>
  )
}
