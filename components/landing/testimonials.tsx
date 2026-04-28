// @ts-nocheck
"use client"

import { useState, useEffect } from "react"
import { Quote, Star, ChevronLeft, ChevronRight } from "lucide-react"

const reviews = [
  { name: "Ali Khan",    role: "Business Owner",      text: "Voltrix provide long-lasting power and excellent customer support. Truly a game-changer for our facility.", initials: "AK" },
  { name: "Sara Ahmed",  role: "Operations Manager",  text: "Reliable and efficient! Our operations have never been smoother since switching to Voltrix energy systems.", initials: "SA" },
  { name: "Bilal Shah",  role: "Factory Director",    text: "Highly recommend Voltrix for their performance and durability. The ROI has been exceptional.", initials: "BS" },
  { name: "Usman Malik", role: "Solar Consultant",    text: "The BMS technology is outstanding. Real-time Bluetooth monitoring gives us complete peace of mind.", initials: "UM" },
  { name: "Hina Raza",   role: "Homeowner",           text: "Switched from lead-acid to Voltrix LiFePO₄ — the difference is night and day. Zero maintenance headaches.", initials: "HR" },
  { name: "Tariq Butt",  role: "EV Fleet Manager",    text: "Our electric rickshaw fleet runs on Voltrix EV packs. Range improved by 40% and downtime is near zero.", initials: "TB" },
  { name: "Amir Khan",   role: "Restaurant Owner",    text: "The backup power system has been flawless. No interruptions even during load shedding.", initials: "AK" },
  { name: "Fatima Ali",  role: "School Administrator", text: "Our institution runs on Voltrix storage. Reliable and cost-effective for our energy needs.", initials: "FA" },
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

function TestimonialCard({ review }: { review: typeof reviews[0] }) {
  return (
    <div className="max-w-4xl mx-auto bg-white rounded-3xl shadow-xl overflow-hidden border border-neutral-200">
      <div className="flex flex-col md:flex-row">
        {/* Left - User Image */}
        <div className="w-full md:w-48 bg-gradient-to-br from-[#1a9f9a]/10 to-[#1a9f9a]/5 p-8 flex items-center justify-center">
          <div className="w-24 h-24 md:w-32 md:h-32 rounded-full bg-gradient-to-br from-[#1a9f9a] to-[#158a85] flex items-center justify-center text-white text-3xl md:text-4xl font-bold shadow-lg">
            {review.initials}
          </div>
        </div>
        
        {/* Divider */}
        <div className="hidden md:block w-px bg-gradient-to-b from-transparent via-neutral-200 to-transparent" />
        
        {/* Right - Testimonial Content */}
        <div className="flex-1 p-8 md:p-12">
          <Quote className="w-10 h-10 text-[#1a9f9a] mb-4 opacity-50" />
          <StarRating />
          <p className="text-xl md:text-2xl text-neutral-700 leading-relaxed mt-6 mb-8">"{review.text}"</p>
          <div className="flex items-center gap-4 pt-6 border-t border-neutral-100">
            <div className="md:hidden w-12 h-12 rounded-full bg-gradient-to-br from-[#1a9f9a] to-[#158a85] flex items-center justify-center text-white text-lg font-bold">
              {review.initials}
            </div>
            <div>
              <p className="text-lg font-semibold text-neutral-900">{review.name}</p>
              <p className="text-sm text-neutral-500">{review.role}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Testimonials() {
  const [currentIndex, setCurrentIndex] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % reviews.length)
    }, 5000)
    return () => clearInterval(interval)
  }, [])

  const next = () => setCurrentIndex((prev) => (prev + 1) % reviews.length)
  const prev = () => setCurrentIndex((prev) => (prev - 1 + reviews.length) % reviews.length)

  return (
    <section className="py-24 px-4 bg-neutral-50">
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

      {/* Testimonial Slider */}
      <div className="relative">
        <TestimonialCard review={reviews[currentIndex]} />
        
        {/* Navigation */}
        <div className="flex justify-center gap-3 mt-8">
          <button 
            onClick={prev}
            className="w-12 h-12 rounded-full bg-white border border-neutral-200 shadow-md flex items-center justify-center hover:bg-neutral-50 hover:border-[#1a9f9a]/50 transition-all"
          >
            <ChevronLeft className="w-5 h-5 text-neutral-600" />
          </button>
          <div className="flex items-center gap-2">
            {reviews.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentIndex(i)}
                className={`h-2 rounded-full transition-all duration-300 ${i === currentIndex ? "bg-[#1a9f9a] w-6" : "bg-neutral-300 w-2"}`}
              />
            ))}
          </div>
          <button 
            onClick={next}
            className="w-12 h-12 rounded-full bg-white border border-neutral-200 shadow-md flex items-center justify-center hover:bg-neutral-50 hover:border-[#1a9f9a]/50 transition-all"
          >
            <ChevronRight className="w-5 h-5 text-neutral-600" />
          </button>
        </div>
      </div>
    </section>
  )
}
