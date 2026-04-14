import { DM_Sans } from "next/font/google"
import Navbar from "@/components/landing/navbar"
import Footer from "@/components/landing/footer"

const dmSans = DM_Sans({ subsets: ["latin"], weight: ["300", "400", "500", "600", "700"], variable: "--font-dm-sans" })

export default function VisionPage() {
  return (
    <main className={`${dmSans.variable} min-h-screen bg-white text-neutral-900 antialiased`} style={{ fontFamily: "var(--font-dm-sans), sans-serif" }}>
      <Navbar />
      <section className="pt-36 pb-24 px-4">
        <div className="max-w-4xl mx-auto space-y-20">
          <div className="text-center space-y-4 max-w-xl mx-auto">
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#1a9f9a" }}>Vision & Mission</p>
            <h1 className="text-5xl font-bold tracking-tight text-neutral-900">Why we exist.</h1>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Vision */}
            <div className="p-8 rounded-3xl border border-neutral-100 space-y-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-lg font-bold" style={{ backgroundColor: "#1a9f9a" }}>V</div>
              <h2 className="text-2xl font-bold text-neutral-900">Our Vision</h2>
              <p className="text-neutral-500 leading-relaxed">
                To be the leading force in Pakistan's clean energy transition — powering homes, businesses, and electric vehicles with the most reliable, affordable, and sustainable battery technology available.
              </p>
              <p className="text-neutral-500 leading-relaxed">
                We envision a future where every Pakistani household and business has access to uninterrupted, clean energy — independent of the grid and free from fossil fuels.
              </p>
            </div>

            {/* Mission */}
            <div className="p-8 rounded-3xl space-y-4 text-white" style={{ backgroundColor: "#1a9f9a" }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/20 text-white text-lg font-bold">M</div>
              <h2 className="text-2xl font-bold">Our Mission</h2>
              <p className="text-white/80 leading-relaxed">
                To design, manufacture, and deliver cutting-edge LiFePO₄ battery solutions that exceed international safety and performance standards — while remaining accessible to the Pakistani market.
              </p>
              <p className="text-white/80 leading-relaxed">
                We are committed to continuous innovation, local manufacturing, and building long-term relationships with our customers through exceptional service and support.
              </p>
            </div>
          </div>

          {/* Values */}
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-neutral-900 text-center">Our Core Values</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { title: "Innovation", desc: "We push the boundaries of what's possible in energy storage, investing heavily in R&D to stay ahead." },
                { title: "Integrity", desc: "We build trust through transparency, honest pricing, and standing behind every product we sell." },
                { title: "Sustainability", desc: "Every decision we make considers its impact on the environment and future generations." },
              ].map((v) => (
                <div key={v.title} className="p-6 rounded-2xl bg-neutral-50 space-y-2">
                  <h3 className="font-semibold text-neutral-900">{v.title}</h3>
                  <p className="text-sm text-neutral-500 leading-relaxed">{v.desc}</p>
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
