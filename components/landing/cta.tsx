import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"

export default function CTA() {
  return (
    <section className="py-24 px-4">
      <div
        className="max-w-4xl mx-auto rounded-3xl p-12 md:p-16 text-center space-y-6 relative overflow-hidden"
        style={{ backgroundColor: "#1a9f9a" }}
      >
        {/* Decorative circles */}
        <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-white/5 pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-80 h-80 rounded-full bg-white/5 pointer-events-none" />

        <div className="relative z-10 space-y-4">
          <h2 className="text-4xl md:text-5xl font-bold text-white tracking-tight">
            Ready to power up?
          </h2>
          <p className="text-white/70 text-base max-w-md mx-auto leading-relaxed">
            Join thousands of engineers and product teams who trust Voltrix for their most demanding applications.
          </p>
        </div>

        <div className="relative z-10 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button
            size="lg"
            className="rounded-xl bg-white text-neutral-900 hover:bg-neutral-100 h-12 px-8 text-sm font-medium gap-2"
          >
            Get started today <ArrowRight className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="lg"
            className="rounded-xl h-12 text-sm text-white/80 hover:text-white hover:bg-white/10"
          >
            Talk to sales
          </Button>
        </div>
      </div>
    </section>
  )
}
