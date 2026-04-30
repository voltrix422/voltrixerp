// @ts-nocheck
import { Lightbulb, Award, Leaf, ArrowRight, Target, Eye, Heart } from "lucide-react"

const values = [
  { icon: Lightbulb, title: "Innovation", desc: "Pioneering indigenous energy technology through continuous R&D." },
  { icon: Award, title: "Quality", desc: "Uncompromising standards that exceed international benchmarks." },
  { icon: Heart, title: "Sustainability", desc: "Environmental stewardship in every solution we create." },
]

const sustainabilityGoals = [
  { num: "01", title: "Carbon Reduction", desc: "Driving carbon reduction through every Voltrix solution" },
  { num: "02", title: "Green Credits", desc: "Supporting clients in earning green credits and achieving compliance" },
  { num: "03", title: "Climate Action", desc: "Promoting renewable adoption to combat climate change" },
]

export default function VisionSection() {
  return (
    <section id="vision" className="bg-white py-24 px-4">
      <div className="max-w-7xl mx-auto space-y-24">
        
        {/* Header */}
        <div className="text-center space-y-4">
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#1a9f9a]/10 text-[#1a9f9a] text-sm font-semibold">
            <Target className="w-4 h-4" />
            Vision & Mission
          </span>
          <h2 className="text-4xl md:text-6xl font-bold text-neutral-900">
            Transforming Ideas into <span className="text-[#1a9f9a]">Impact</span>
          </h2>
        </div>

        {/* Mission & Vision Cards */}
        <div className="grid md:grid-cols-2 gap-8">
          {/* Mission */}
          <div className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1a9f9a] to-[#158a85] p-10 text-white">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="relative z-10 space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                  <Target className="w-6 h-6" />
                </div>
                <span className="text-sm font-semibold uppercase tracking-wider opacity-80">Our Mission</span>
              </div>
              <p className="text-lg leading-relaxed opacity-95">
                To empower individuals and organizations to embrace clean energy while reducing their carbon footprint. Every solution is proudly rooted in local production and backed by continuous R&D.
              </p>
              <p className="text-sm opacity-70">
                Committed to developing durable, high-quality products exceeding international standards for export to Europe, USA, and global markets.
              </p>
            </div>
          </div>

          {/* Vision */}
          <div className="group relative overflow-hidden rounded-3xl bg-neutral-900 p-10 text-white">
            <div className="absolute top-0 right-0 w-64 h-64 bg-[#1a9f9a]/20 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="relative z-10 space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-[#1a9f9a]/20 flex items-center justify-center">
                  <Eye className="w-6 h-6 text-[#1a9f9a]" />
                </div>
                <span className="text-sm font-semibold uppercase tracking-wider opacity-80">Our Vision</span>
              </div>
              <h3 className="text-2xl md:text-3xl font-bold leading-tight">
                A cleaner, smarter energy future for Pakistan and beyond.
              </h3>
              <p className="text-neutral-400 leading-relaxed">
                We envision a Pakistan where every home, business, and vehicle runs on clean, locally-produced energy — independent of fossil fuels and competing globally.
              </p>
            </div>
          </div>
        </div>

        {/* Sustainability Goals */}
        <div className="space-y-8">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[#1a9f9a] text-sm font-semibold uppercase tracking-wider">Commitment</span>
              <h3 className="text-2xl font-bold text-neutral-900 mt-2">Sustainability Goals</h3>
            </div>
            <Leaf className="w-8 h-8 text-[#1a9f9a]" />
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {sustainabilityGoals.map((goal) => (
              <div key={goal.num} className="group p-6 rounded-2xl bg-neutral-50 border border-neutral-100 hover:border-[#1a9f9a]/30 hover:shadow-lg transition-all">
                <span className="text-3xl font-bold text-[#1a9f9a]/30">{goal.num}</span>
                <h4 className="font-semibold text-neutral-900 mt-3 mb-2">{goal.title}</h4>
                <p className="text-sm text-neutral-600 leading-relaxed">{goal.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Core Values */}
        <div className="space-y-8">
          <div className="text-center">
            <span className="text-[#1a9f9a] text-sm font-semibold uppercase tracking-wider">What We Stand For</span>
            <h3 className="text-2xl font-bold text-neutral-900 mt-2">Core Values</h3>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {values.map((v) => (
              <div key={v.title} className="group p-8 rounded-2xl bg-white border border-neutral-100 hover:border-[#1a9f9a]/30 hover:shadow-xl transition-all text-center">
                <div className="w-16 h-16 rounded-2xl bg-[#1a9f9a]/10 flex items-center justify-center mx-auto mb-4 group-hover:bg-[#1a9f9a] transition-colors">
                  <v.icon className="w-8 h-8 text-[#1a9f9a] group-hover:text-white transition-colors" />
                </div>
                <h4 className="font-bold text-neutral-900 mb-2">{v.title}</h4>
                <p className="text-sm text-neutral-600 leading-relaxed">{v.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="text-center">
          <a
            href="#contact"
            className="inline-flex items-center gap-3 px-8 py-4 rounded-full bg-[#1a9f9a] text-white font-semibold hover:bg-[#158a85] transition-colors group"
          >
            Work with us
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </a>
        </div>

      </div>
    </section>
  )
}
