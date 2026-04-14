import { CheckCircle2, ArrowRight } from "lucide-react"
import ScrollFloat from "./scroll-float"
import BlurText from "./blur-text"

const points = [
  "Pakistan's first indigenous BMS technology",
  "Complete energy ecosystem solutions",
  "Local manufacturing & in-house R&D",
  "Global standards with local expertise",
]

export default function MissionBanner() {
  return (
    <section className="py-24 px-4 bg-white border-b border-neutral-100">
      <div className="max-w-5xl mx-auto">

        {/* Headline + points */}
        <div className="space-y-6 max-w-xl">
          <div className="flex flex-col gap-0">
          <ScrollFloat
            animationDuration={1}
            ease="back.inOut(2)"
            scrollStart="center bottom+=50%"
            scrollEnd="bottom bottom-=40%"
            stagger={0.03}
            containerClassName="text-5xl font-bold tracking-tight text-neutral-900 leading-none"
          >
            Powering Pakistan's
          </ScrollFloat>
          <ScrollFloat
            animationDuration={1}
            ease="back.inOut(2)"
            scrollStart="center bottom+=50%"
            scrollEnd="bottom bottom-=40%"
            stagger={0.03}
            containerClassName="text-5xl font-bold tracking-tight text-neutral-900 leading-none"
          >
            Sustainable Future
          </ScrollFloat>
          </div>

          <ul className="space-y-3 pt-2">
            {points.map((p, i) => (
              <li key={p} className="flex items-start gap-3">
                <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "#1a9f9a" }} />
                <BlurText
                  text={p}
                  delay={120}
                  animateBy="words"
                  direction="top"
                  stepDuration={0.3}
                  className="text-sm text-neutral-600 font-medium"
                />
              </li>
            ))}
          </ul>

          <a
            href="#about"
            className="inline-flex items-center gap-2 px-6 h-11 rounded-full text-sm font-semibold text-white hover:opacity-90 transition-opacity"
            style={{ backgroundColor: "#1a9f9a" }}
          >
            More About Us <ArrowRight className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </section>
  )
}
