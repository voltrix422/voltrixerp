import { DM_Sans } from "next/font/google"
import Navbar from "@/components/landing/navbar"
import Footer from "@/components/landing/footer"
import { FlaskConical, Factory, Microscope, Cog, BarChart3, Globe } from "lucide-react"

const dmSans = DM_Sans({ subsets: ["latin"], weight: ["300", "400", "500", "600", "700"], variable: "--font-dm-sans" })

const areas = [
  { icon: FlaskConical, title: "Partner Cell Chemistry", desc: "We source proven LiFePO₄ chemistries from trusted Chinese manufacturing partners selected for energy density, cycle life, and safety." },
  { icon: Microscope, title: "Quality Assurance", desc: "Every shipment is reviewed against strict incoming QC standards — thermal, electrical, and safety checks before products reach customers." },
  { icon: Cog, title: "Smart BMS", desc: "Partner-integrated Smart BMS enables real-time cell balancing, health monitoring, and Bluetooth diagnostics on every pack." },
  { icon: Factory, title: "Chinese Manufacturing Partners", desc: "Voltrix products are manufactured by leading Chinese partners with modern assembly lines and certified quality systems." },
  { icon: BarChart3, title: "Field Performance", desc: "Feedback from deployed units in Pakistan helps us refine product mix, support, and reliability for local conditions." },
  { icon: Globe, title: "International Standards", desc: "All Voltrix products are designed to meet or exceed IEC 62619, UN 38.3, and CE safety certifications for market readiness." },
]

export default function RDPage() {
  return (
    <main className={`${dmSans.variable} min-h-screen bg-white text-neutral-900 antialiased`} style={{ fontFamily: "var(--font-dm-sans), sans-serif" }}>
      <Navbar />
      <section className="pt-36 pb-24 px-4">
        <div className="max-w-5xl mx-auto space-y-16">
          <div className="text-center space-y-4 max-w-xl mx-auto">
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#1a9f9a" }}>Technology & Partners</p>
            <h1 className="text-5xl font-bold tracking-tight text-neutral-900">Global partners.<br />Local trust.</h1>
            <p className="text-neutral-500 text-base leading-relaxed">Voltrix works with leading Chinese manufacturing partners to deliver certified LiFePO₄ battery solutions — backed by local sales, warranty, and support across Pakistan.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {areas.map((a) => (
              <div key={a.title} className="p-6 rounded-2xl border border-neutral-100 hover:border-neutral-200 hover:shadow-md hover:shadow-neutral-100 transition-all space-y-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: "#1a9f9a1a" }}>
                  <a.icon className="w-5 h-5" style={{ color: "#1a9f9a" }} />
                </div>
                <h3 className="font-semibold text-neutral-900">{a.title}</h3>
                <p className="text-sm text-neutral-500 leading-relaxed">{a.desc}</p>
              </div>
            ))}
          </div>

          <div className="rounded-3xl p-10 md:p-14 text-center space-y-4 text-white" style={{ backgroundColor: "#1a9f9a" }}>
            <h2 className="text-3xl font-bold">Want to know more?</h2>
            <p className="text-white/70 max-w-md mx-auto">Talk to our team about product specs, certifications, and how Voltrix partners deliver quality for your project.</p>
            <a href="/contact" className="inline-flex items-center gap-2 mt-2 px-8 h-12 rounded-full text-sm font-semibold text-black bg-white hover:bg-white/90 transition-colors">
              Contact us
            </a>
          </div>
        </div>
      </section>
      <Footer />
    </main>
  )
}
