import { DM_Sans } from "next/font/google"
import Navbar from "@/components/landing/navbar"
import Footer from "@/components/landing/footer"
import { Wrench, Truck, HeadphonesIcon, RefreshCw, ClipboardList, Zap } from "lucide-react"

const dmSans = DM_Sans({ subsets: ["latin"], weight: ["300", "400", "500", "600", "700"], variable: "--font-dm-sans" })

const services = [
  { icon: Zap, title: "Battery Installation", desc: "Professional on-site installation of residential and commercial battery systems by certified Voltrix engineers." },
  { icon: Wrench, title: "Maintenance & Repair", desc: "Scheduled maintenance programs and rapid repair services to keep your battery systems running at peak performance." },
  { icon: HeadphonesIcon, title: "24/7 Technical Support", desc: "Round-the-clock technical assistance via phone, email, and remote diagnostics for all Voltrix products." },
  { icon: RefreshCw, title: "Battery Replacement", desc: "End-of-life battery recycling and replacement programs with minimal downtime and full data continuity." },
  { icon: ClipboardList, title: "Energy Audits", desc: "Comprehensive energy consumption analysis to recommend the right battery solution for your specific needs." },
  { icon: Truck, title: "Nationwide Delivery", desc: "Fast, insured delivery across Pakistan with real-time tracking and white-glove handling for large systems." },
]

export default function ServicesPage() {
  return (
    <main className={`${dmSans.variable} min-h-screen bg-white text-neutral-900 antialiased`} style={{ fontFamily: "var(--font-dm-sans), sans-serif" }}>
      <Navbar />
      <section className="pt-36 pb-24 px-4">
        <div className="max-w-5xl mx-auto space-y-16">
          <div className="text-center space-y-4 max-w-xl mx-auto">
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#1a9f9a" }}>What We Offer</p>
            <h1 className="text-5xl font-bold tracking-tight text-neutral-900">Services built around you.</h1>
            <p className="text-neutral-500 text-base leading-relaxed">From installation to ongoing support, Voltrix is with you at every step of your energy journey.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {services.map((s) => (
              <div key={s.title} className="p-6 rounded-2xl border border-neutral-100 hover:border-neutral-200 hover:shadow-md hover:shadow-neutral-100 transition-all space-y-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: "#1a9f9a1a" }}>
                  <s.icon className="w-5 h-5" style={{ color: "#1a9f9a" }} />
                </div>
                <h3 className="font-semibold text-neutral-900">{s.title}</h3>
                <p className="text-sm text-neutral-500 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
          <div className="text-center">
            <a href="/contact" className="inline-flex items-center gap-2 px-8 h-12 rounded-full text-sm font-semibold text-white hover:opacity-90 transition-opacity" style={{ backgroundColor: "#1a9f9a" }}>
              Get in touch
            </a>
          </div>
        </div>
      </section>
      <Footer />
    </main>
  )
}
