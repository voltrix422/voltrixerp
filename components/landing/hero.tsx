// @ts-nocheck
"use client"
import { ArrowRight } from "lucide-react"
import Image from "next/image"
import { useState, useEffect } from "react"
import GradualBlur from "./gradual-blur"

const images = [
  "/(WL-5)-Photoroom.png",
  "/Gemini_Generated_Image_7tmgjr7tmgjr7tmg-Photoroom.png",
]

export default function Hero() {
  const [current, setCurrent] = useState(0)
  const [fade, setFade] = useState(true)

  useEffect(() => {
    const interval = setInterval(() => {
      setFade(false)
      setTimeout(() => {
        setCurrent(prev => (prev + 1) % images.length)
        setFade(true)
      }, 400)
    }, 6000)
    return () => clearInterval(interval)
  }, [])

  return (
    <section className="relative min-h-screen flex items-center bg-white overflow-hidden">
      <div className="container mx-auto px-6 lg:px-16 flex flex-col lg:flex-row items-center gap-12 py-24">

        {/* Left — text */}
        <div className="flex-1 flex flex-col items-start gap-6 max-w-xl">
          <h1 className="text-[clamp(2.4rem,5vw,4rem)] font-bold tracking-tight leading-[1.05] text-neutral-900">
            Power your drive<br />
            <span className="teal-gradient-text">with Voltrix.</span>
          </h1>
          <p className="text-base text-neutral-500 leading-relaxed max-w-md">
            Premium automotive electrical solutions engineered for performance, reliability, and the road ahead.
          </p>
          <a
            href="#products"
            className="group flex items-center gap-3 pl-6 pr-2 h-12 rounded-full text-sm font-medium text-white bg-neutral-900 overflow-hidden transition-all duration-300 hover:shadow-lg"
          >
            <span className="transition-transform duration-300 group-hover:-translate-x-0.5">
              Explore products
            </span>
            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-white/10 transition-all duration-300 group-hover:translate-x-0.5">
              <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </a>
        </div>

        {/* Right — rotating image */}
        <div className="flex-1 flex items-center justify-center relative h-[420px] lg:h-[520px] w-full">
          <div
            className="relative w-full h-full transition-opacity duration-400"
            style={{ opacity: fade ? 1 : 0, transition: "opacity 0.4s ease" }}
          >
            <Image
              src={images[current]}
              alt="Voltrix product"
              fill
              className="object-contain drop-shadow-2xl"
              priority
            />
          </div>

          {/* Dot indicators */}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 flex gap-2">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={() => { setFade(false); setTimeout(() => { setCurrent(i); setFade(true) }, 400) }}
                className={`w-2 h-2 rounded-full transition-all duration-300 ${i === current ? "bg-neutral-900 w-5" : "bg-neutral-300"}`}
              />
            ))}
          </div>
        </div>
      </div>

      <GradualBlur position="bottom" height="6rem" strength={2} divCount={6} curve="bezier" exponential opacity={1} zIndex={5} />
    </section>
  )
}
