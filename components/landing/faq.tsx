"use client"

import { useState } from "react"
import { Plus, Minus } from "lucide-react"
import ScrollFloat from "./scroll-float"

const faqs = [
  { q: "How long do Voltrix batteries last?",         a: "Voltrix batteries last between 10–15 years depending upon usage and the type of battery purchased." },
  { q: "Do Voltrix batteries come with a warranty?",  a: "Yes. All Voltrix products come with a warranty ranging from 1 to 10 years depending on the product line. Our residential wall-mount batteries carry up to a 10-year warranty." },
  { q: "Are Voltrix batteries safe to use?",          a: "Absolutely. Every Voltrix battery is built with multi-layer safety protection including overcharge, over-discharge, short circuit, and thermal runaway prevention, meeting IEC 62619 and UN 38.3 standards." },
  { q: "Can I use Voltrix batteries with solar systems?", a: "Yes. Voltrix batteries are fully compatible with solar systems and are designed to integrate seamlessly with inverters and solar charge controllers for residential and commercial applications." },
  { q: "Do you provide installation and support?",    a: "Yes. We offer end-to-end installation, commissioning, and after-sales technical support. Our team is available 24/7 to assist with any queries or issues." },
]

export default function FAQ() {
  const [open, setOpen] = useState<number | null>(0)

  return (
    <section className="py-24 px-4 bg-neutral-50/60">
      <div className="max-w-3xl mx-auto space-y-12">
        <div className="text-center space-y-3">
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#1a9f9a" }}>FAQ's</p>
          <ScrollFloat
            animationDuration={1}
            ease="back.inOut(2)"
            scrollStart="center bottom+=50%"
            scrollEnd="bottom bottom-=40%"
            stagger={0.03}
            containerClassName="text-4xl font-bold tracking-tight text-neutral-900"
          >
            Have a Question?
          </ScrollFloat>
          <p className="text-neutral-500 text-sm">We've got the answers you need.</p>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <div
              key={i}
              className="rounded-2xl border border-neutral-100 bg-white overflow-hidden transition-all duration-200"
            >
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full flex items-center justify-between px-6 py-4 text-left gap-4"
              >
                <span className="text-sm font-semibold text-neutral-900">{faq.q}</span>
                <span
                  className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-colors"
                  style={{ backgroundColor: open === i ? "#1a9f9a" : "#f3f4f6" }}
                >
                  {open === i
                    ? <Minus className="w-3 h-3 text-white" />
                    : <Plus className="w-3 h-3 text-neutral-500" />
                  }
                </span>
              </button>
              <div
                className="overflow-hidden transition-all duration-300"
                style={{ maxHeight: open === i ? "200px" : "0px" }}
              >
                <p className="px-6 pb-5 text-sm text-neutral-500 leading-relaxed">{faq.a}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
