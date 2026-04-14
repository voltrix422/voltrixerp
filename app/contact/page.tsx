import { DM_Sans } from "next/font/google"
import Navbar from "@/components/landing/navbar"
import Footer from "@/components/landing/footer"
import { MapPin, Phone, Mail, Clock } from "lucide-react"

const dmSans = DM_Sans({ subsets: ["latin"], weight: ["300", "400", "500", "600", "700"], variable: "--font-dm-sans" })

export default function ContactPage() {
  return (
    <main className={`${dmSans.variable} min-h-screen bg-white text-neutral-900 antialiased`} style={{ fontFamily: "var(--font-dm-sans), sans-serif" }}>
      <Navbar />
      <section className="pt-36 pb-24 px-4">
        <div className="max-w-5xl mx-auto space-y-14">
          <div className="text-center space-y-4 max-w-xl mx-auto">
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#1a9f9a" }}>Contact</p>
            <h1 className="text-5xl font-bold tracking-tight text-neutral-900">Let's talk.</h1>
            <p className="text-neutral-500 text-base leading-relaxed">Have a question, need a quote, or want to schedule a visit? We'd love to hear from you.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Form */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-neutral-600">First name</label>
                  <input className="w-full h-11 px-4 rounded-xl border border-neutral-200 text-sm outline-none focus:border-[#1a9f9a] transition-colors" placeholder="Ahmed" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-neutral-600">Last name</label>
                  <input className="w-full h-11 px-4 rounded-xl border border-neutral-200 text-sm outline-none focus:border-[#1a9f9a] transition-colors" placeholder="Raza" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-neutral-600">Email</label>
                <input type="email" className="w-full h-11 px-4 rounded-xl border border-neutral-200 text-sm outline-none focus:border-[#1a9f9a] transition-colors" placeholder="ahmed@example.com" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-neutral-600">Phone</label>
                <input type="tel" className="w-full h-11 px-4 rounded-xl border border-neutral-200 text-sm outline-none focus:border-[#1a9f9a] transition-colors" placeholder="+92 300 0000000" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-neutral-600">Message</label>
                <textarea rows={5} className="w-full px-4 py-3 rounded-xl border border-neutral-200 text-sm outline-none focus:border-[#1a9f9a] transition-colors resize-none" placeholder="Tell us about your project or inquiry..." />
              </div>
              <button className="w-full h-12 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-opacity" style={{ backgroundColor: "#1a9f9a" }}>
                Send message
              </button>
            </div>

            {/* Info */}
            <div className="space-y-6">
              {[
                { icon: MapPin, label: "Address", value: "Voltrix HQ, Lahore, Pakistan" },
                { icon: Phone, label: "Phone", value: "+92 300 000 0000" },
                { icon: Mail, label: "Email", value: "info@voltrixbatteries.com" },
                { icon: Clock, label: "Business Hours", value: "Mon–Sat, 9:00 AM – 6:00 PM" },
              ].map((item) => (
                <div key={item.label} className="flex items-start gap-4 p-5 rounded-2xl border border-neutral-100">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "#1a9f9a1a" }}>
                    <item.icon className="w-4 h-4" style={{ color: "#1a9f9a" }} />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-neutral-400 uppercase tracking-wider">{item.label}</p>
                    <p className="text-sm font-medium text-neutral-900 mt-0.5">{item.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
      <Footer />
    </main>
  )
}
