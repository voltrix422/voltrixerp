import { DM_Sans } from "next/font/google"
import Navbar from "@/components/landing/navbar"
import Footer from "@/components/landing/footer"

const dmSans = DM_Sans({ subsets: ["latin"], weight: ["300", "400", "500", "600", "700"], variable: "--font-dm-sans" })

export default function AboutPage() {
  return (
    <main className={`${dmSans.variable} min-h-screen bg-white text-neutral-900 antialiased`} style={{ fontFamily: "var(--font-dm-sans), sans-serif" }}>
      <Navbar />
      <section className="pt-36 pb-24 px-4">
        <div className="max-w-4xl mx-auto space-y-16">
          <div className="text-center space-y-4 max-w-xl mx-auto">
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#1a9f9a" }}>About Us</p>
            <h1 className="text-5xl font-bold tracking-tight text-neutral-900">The team behind Voltrix.</h1>
            <p className="text-neutral-500 text-base leading-relaxed">We are a team of engineers, scientists, and energy enthusiasts on a mission to make clean, reliable power accessible to everyone in Pakistan.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div className="space-y-5">
              <h2 className="text-2xl font-bold text-neutral-900">Our Story</h2>
              <p className="text-neutral-500 leading-relaxed">Voltrix was founded with a simple but powerful belief — that Pakistan deserves world-class battery technology, manufactured locally, at prices that make sense for our market.</p>
              <p className="text-neutral-500 leading-relaxed">Starting from a small R&D lab, we have grown into a full-scale battery manufacturer serving residential customers, EV owners, and industrial clients across the country.</p>
              <p className="text-neutral-500 leading-relaxed">Today, Voltrix products power thousands of homes, dozens of commercial installations, and a growing fleet of electric vehicles — all backed by our industry-leading warranty and support.</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[["2019","Founded"],["10,000+","Units deployed"],["50+","Team members"],["6","Product lines"]].map(([v, l]) => (
                <div key={l} className="p-6 rounded-2xl bg-neutral-50 text-center space-y-1">
                  <p className="text-3xl font-bold" style={{ color: "#1a9f9a" }}>{v}</p>
                  <p className="text-sm text-neutral-500">{l}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="p-8 rounded-3xl border border-neutral-100 space-y-4 text-center">
            <h2 className="text-2xl font-bold text-neutral-900">Join the Voltrix family</h2>
            <p className="text-neutral-500 max-w-md mx-auto">Whether you're a homeowner, a business, or an EV enthusiast — there's a Voltrix solution built for you.</p>
            <a href="/contact" className="inline-flex items-center gap-2 mt-2 px-8 h-12 rounded-full text-sm font-semibold text-white hover:opacity-90 transition-opacity" style={{ backgroundColor: "#1a9f9a" }}>
              Get in touch
            </a>
          </div>
        </div>
      </section>
      <Footer />
    </main>
  )
}
