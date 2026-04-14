// @ts-nocheck
import { MapPin, Phone, Mail } from "lucide-react"
import ScrollFloat from "./scroll-float"
import ScrollReveal from "./scroll-reveal"

export default function ContactSection() {
  return (
    <section id="contact" className="bg-white">

      {/* ── Hero ── */}
      <div className="py-24 px-4 border-b border-neutral-100">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-16 items-start">
          <div className="space-y-5">
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#1a9f9a" }}>Contact Us</p>
            <ScrollFloat
              animationDuration={1}
              ease="back.inOut(2)"
              scrollStart="center bottom+=50%"
              scrollEnd="bottom bottom-=40%"
              stagger={0.03}
              containerClassName="text-5xl font-bold tracking-tight text-neutral-900 leading-tight"
            >
              Get in Touch
            </ScrollFloat>
          </div>
          <div className="pt-2">
          </div>
        </div>
      </div>

      {/* ── Offices + Form ── */}
      <div className="py-24 px-4">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-10">

          {/* Office info */}
          <div className="space-y-5">

            {/* Head Office */}
            <div className="rounded-2xl border border-neutral-100 p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "#1a9f9a12" }}>
                  <MapPin className="w-4 h-4" style={{ color: "#1a9f9a" }} />
                </div>
                <p className="font-semibold text-neutral-900 text-sm">Head Office</p>
              </div>
              <p className="text-sm text-neutral-500 leading-relaxed pl-11">
                Plot # 73, Street 14, Industrial Area I-9/2, Islamabad
              </p>
              <div className="pl-11 space-y-1">
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                  <a href="tel:05187316619" className="text-sm text-neutral-600 hover:text-neutral-900 transition-colors">051-8731661</a>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                  <a href="tel:+923034927779" className="text-sm text-neutral-600 hover:text-neutral-900 transition-colors">+92 303 4927779</a>
                </div>
              </div>
            </div>

            {/* Lahore Office */}
            <div className="rounded-2xl border border-neutral-100 p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "#1a9f9a12" }}>
                  <MapPin className="w-4 h-4" style={{ color: "#1a9f9a" }} />
                </div>
                <p className="font-semibold text-neutral-900 text-sm">Lahore Office</p>
              </div>
              <p className="text-sm text-neutral-500 leading-relaxed pl-11">
                Centre Point Plaza, Block E2, Gulberg III, Lahore, 54000, Pakistan
              </p>
              <div className="pl-11 space-y-1">
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                  <a href="tel:+923211365440" className="text-sm text-neutral-600 hover:text-neutral-900 transition-colors">+92 321 1365440</a>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                  <a href="tel:+923212626092" className="text-sm text-neutral-600 hover:text-neutral-900 transition-colors">+92 321 2626092</a>
                </div>
              </div>
            </div>

            {/* Email */}
            <div className="rounded-2xl border border-neutral-100 p-6">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "#1a9f9a12" }}>
                  <Mail className="w-4 h-4" style={{ color: "#1a9f9a" }} />
                </div>
                <div>
                  <p className="font-semibold text-neutral-900 text-sm">Email</p>
                  <a href="mailto:info@voltrix-power.com" className="text-sm text-neutral-500 hover:text-neutral-900 transition-colors">
                    info@voltrix-power.com
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Form */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-neutral-600">First name</label>
                <input className="w-full h-11 px-4 rounded-xl border border-neutral-200 text-sm outline-none focus:border-[#1a9f9a] transition-colors bg-white" placeholder="First name" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-neutral-600">Last name</label>
                <input className="w-full h-11 px-4 rounded-xl border border-neutral-200 text-sm outline-none focus:border-[#1a9f9a] transition-colors bg-white" placeholder="Last name" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-neutral-600">Email</label>
              <input type="email" className="w-full h-11 px-4 rounded-xl border border-neutral-200 text-sm outline-none focus:border-[#1a9f9a] transition-colors bg-white" placeholder="Email" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-neutral-600">Phone</label>
              <input type="tel" className="w-full h-11 px-4 rounded-xl border border-neutral-200 text-sm outline-none focus:border-[#1a9f9a] transition-colors bg-white" placeholder="Phone" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-neutral-600">Message</label>
              <textarea rows={5} className="w-full px-4 py-3 rounded-xl border border-neutral-200 text-sm outline-none focus:border-[#1a9f9a] transition-colors resize-none bg-white" placeholder="Message" />
            </div>
            <button
              className="w-full h-12 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-opacity"
              style={{ backgroundColor: "#1a9f9a" }}
            >
              Send message
            </button>
          </div>
        </div>
      </div>

      {/* ── Map ── */}
      <div className="px-4 pb-24">
        <div className="max-w-5xl mx-auto space-y-3">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4" style={{ color: "#1a9f9a" }} />
            <p className="text-sm font-semibold text-neutral-700">Head Office — I-9/2 Industrial Area, Islamabad</p>
          </div>
          <div className="w-full rounded-2xl overflow-hidden border border-neutral-100" style={{ height: "400px" }}>
            <iframe
              title="Voltrix Head Office"
              width="100%"
              height="100%"
              style={{ border: 0 }}
              loading="lazy"
              allowFullScreen
              referrerPolicy="no-referrer-when-downgrade"
              src="https://maps.google.com/maps?q=Plot+73+Street+14+I-9%2F2+Industrial+Area+Islamabad+44000+Pakistan&output=embed&z=16"
            />
          </div>
        </div>
      </div>

    </section>
  )
}
