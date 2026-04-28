// @ts-nocheck
"use client"
import { ArrowRight } from "lucide-react"
import GradualBlur from "./gradual-blur"
import RotatingText from "./rotating-text"

export default function Hero() {
  return (
    <section className="relative min-h-screen flex items-center bg-white overflow-hidden">
      <div className="container mx-auto px-6 lg:px-16 flex flex-col items-center justify-center gap-12 py-24">

        {/* Center — text */}
        <div className="flex flex-col items-center gap-6 max-w-xl text-center">
          <h1 className="text-[clamp(2.4rem,5vw,4rem)] font-bold tracking-tight leading-[1.15] text-neutral-900">
            Power your{" "}
            <span className="inline-flex items-center ml-2">
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

      </div>

      <GradualBlur position="bottom" height="6rem" strength={2} divCount={6} curve="bezier" exponential opacity={1} zIndex={5} />
    </section>
  )
}
