import { DM_Sans } from "next/font/google"
import Navbar from "@/components/landing/navbar"
import Footer from "@/components/landing/footer"
import { FlaskConical, Factory, Microscope, Cog, BarChart3, Globe } from "lucide-react"

const dmSans = DM_Sans({ subsets: ["latin"], weight: ["300", "400", "500", "600", "700"], variable: "--font-dm-sans" })

const areas = [
  { icon: FlaskConical, title: "Cell Chemistry R&D", desc: "Our materials science team continuously refines LiFePO₄ cathode formulations to push energy density and cycle life beyond industry benchmarks." },
  { icon: Microscope, title: "Quality Testing Lab", desc: "Every batch undergoes 47-point quality inspection including thermal cycling, vibration, crush, and overcharge tests before leaving our facility." },
  { icon: Cog, title: "BMS Development", desc: "In-house firmware and hardware development for our Smart BMS — enabling real-time cell balancing, health monitoring, and Bluetooth diagnostics." },
  { icon: Factory, title: "Local Manufacturing", desc: "Proudly manufactured in Pakistan. Our facility is equipped with semi-automated assembly lines ensuring consistent quality at scale." },
  { icon: BarChart3, title: "Performance Analytics", desc: "Field data from deployed units feeds back into our R&D cycle, allowing us to continuously improve product performance and reliability." },
  { icon: Globe, title: "International Standards", desc: "All Voltrix products are designed to meet or exceed IEC 62619, UN 38.3, and CE safety certifications for global market readiness." },
]

export default function RDPage() {
  return (
    <main className={`${dmSans.variable} min-h-screen bg-white text-neutral-900 antialiased`} style={{ fontFamily: "var(--font-dm-sans), sans-serif" }}>
      <Navbar />
      <section className="pt-36 pb-24 px-4">
        <div className="max-w-5xl mx-auto space-y-16">
          <div className="text-center space-y-4 max-w-xl mx-auto">
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#1a9f9a" }}>R&D & Manufacturing</p>
            <h1 className="text-5xl font-bold tracking-tight text-neutral-900">Made in Pakistan.<br />Built for the world.</h1>
            <p className="text-neutral-500 text-base leading-relaxed">Our research and manufacturing capabilities are the foundation of every Voltrix product — from raw cell chemistry to finished battery pack.</p>
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
            <h2 className="text-3xl font-bold">Interested in a facility tour?</h2>
            <p className="text-white/70 max-w-md mx-auto">We welcome partners, investors, and customers to visit our manufacturing facility and see the Voltrix process firsthand.</p>
            <a href="/contact" className="inline-flex items-center gap-2 mt-2 px-8 h-12 rounded-full text-sm font-semibold text-black bg-white hover:bg-white/90 transition-colors">
              Schedule a visit
            </a>
          </div>
        </div>
      </section>
      <Footer />
    </main>
  )
}
