// @ts-nocheck
import { Quote, Star } from "lucide-react"

const reviews = [
  { name: "Ali Khan",    role: "Business Owner",      text: "Voltrix provide long-lasting power and excellent customer support. Truly a game-changer for our facility.", initials: "AK" },
  { name: "Sara Ahmed",  role: "Operations Manager",  text: "Reliable and efficient! Our operations have never been smoother since switching to Voltrix energy systems.", initials: "SA" },
  { name: "Bilal Shah",  role: "Factory Director",    text: "Highly recommend Voltrix for their performance and durability. The ROI has been exceptional.", initials: "BS" },
]

function StarRating() {
  return (
    <div className="flex gap-0.5">
      {[...Array(5)].map((_, i) => (
        <Star key={i} className="w-5 h-5 fill-[#1a9f9a] text-[#1a9f9a]" />
      ))}
    </div>
  )
}

function Card({ r }: { r: typeof reviews[0] }) {
  return (
    <div className="p-8 rounded-3xl bg-white border border-neutral-200 shadow-lg hover:shadow-xl transition-shadow">
      <div className="flex flex-col h-full">
        <Quote className="w-10 h-10 text-[#1a9f9a] mb-4 opacity-50" />
        <StarRating />
        <p className="text-lg text-neutral-700 leading-relaxed mt-4 mb-6">"{r.text}"</p>
        <div className="flex items-center gap-4 pt-6 border-t border-neutral-100">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#1a9f9a]/20 to-[#1a9f9a]/5 flex items-center justify-center text-lg font-bold text-[#1a9f9a]">
            {r.initials}
          </div>
          <div>
            <p className="text-base font-semibold text-neutral-900">{r.name}</p>
            <p className="text-sm text-neutral-500">{r.role}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Testimonials() {
  return (
    <section className="py-24 px-4 bg-white">
      {/* Header */}
      <div className="max-w-5xl mx-auto text-center space-y-3 mb-16">
        <p className="text-xs font-semibold uppercase tracking-widest text-[#1a9f9a]">Client Testimonials</p>
        <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-neutral-900">
          What our clients say
        </h2>
        <p className="text-neutral-500 text-base max-w-2xl mx-auto">
          Trusted by homeowners, businesses, and fleet operators across Pakistan.
        </p>
      </div>

      {/* Cards Grid */}
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {reviews.map((r) => (
          <Card key={r.name} r={r} />
        ))}
      </div>
    </section>
  )
}
