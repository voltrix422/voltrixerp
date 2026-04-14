// @ts-nocheck
import { ArrowRight } from "lucide-react"
import SplitText from "./split-text"
import GradualBlur from "./gradual-blur"

export default function Hero() {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-black">

      {/* Overlays */}
      <div className="absolute inset-x-0 top-0 h-40 z-[1] pointer-events-none bg-gradient-to-b from-black to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-48 z-[1] pointer-events-none bg-gradient-to-t from-black to-transparent" />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center text-center px-6 -mt-16 max-w-3xl mx-auto gap-5">

        {/* Line 1 — white */}
        <h1 className="text-[clamp(2.2rem,6vw,4.5rem)] font-bold tracking-[-0.05em] leading-[0.9] m-0 p-0">
          <SplitText
            text="Power your drive"
            tag="span"
            className="text-white block"
            splitType="chars"
            from={{ opacity: 0, y: 20, rotateX: -10 }}
            to={{ opacity: 1, y: 0, rotateX: 0 }}
            delay={35}
            duration={0.8}
            ease="power3.out"
            threshold={0.2}
            rootMargin="0px"
            textAlign="center"
          />

          {/* Line 2 — gradient, starts after line 1 finishes */}
          <SplitText
            text="with Voltrix."
            tag="span"
            className="block teal-gradient-text"
            splitType="chars"
            from={{ opacity: 0, y: 20, rotateX: -10 }}
            to={{ opacity: 1, y: 0, rotateX: 0 }}
            delay={35}
            duration={0.8}
            ease="power3.out"
            threshold={0.2}
            rootMargin="0px"
            textAlign="center"
            startDelay={17 * 0.035 + 0.8}
          />
        </h1>

        {/* CTA */}
        <a
          href="#products"
          className="group relative mt-2 flex items-center gap-3 pl-6 pr-2 h-12 rounded-full text-sm font-medium text-black bg-white overflow-hidden transition-all duration-300 hover:pr-3 hover:shadow-[0_8px_32px_rgba(255,255,255,0.15)]"
        >
          <span className="relative z-10 transition-transform duration-300 group-hover:-translate-x-0.5">
            Explore products
          </span>
          <span className="relative z-10 flex items-center justify-center w-8 h-8 rounded-full bg-black/8 transition-all duration-300 group-hover:bg-black/12 group-hover:translate-x-0.5">
            <ArrowRight className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
          </span>
        </a>
      </div>

      {/* Scroll line */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-1.5 opacity-25">
        <div className="w-px h-10 bg-gradient-to-b from-transparent via-white to-transparent" />
      </div>

      {/* Gradual blur at bottom to blend into next section */}
      <GradualBlur position="bottom" height="8rem" strength={2} divCount={6} curve="bezier" exponential opacity={1} zIndex={5} />
    </section>
  )
}
