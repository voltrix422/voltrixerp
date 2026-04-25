import Navbar from "@/components/landing/navbar"
import Footer from "@/components/landing/footer"

export default function DocsPage() {
  return (
    <main className="min-h-screen bg-white text-neutral-900">
      <Navbar />
      <section className="pt-36 pb-24 px-4">
        <div className="max-w-4xl mx-auto space-y-12">
          <div className="text-center space-y-4">
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#1a9f9a" }}>Resources</p>
            <h1 className="text-5xl font-bold tracking-tight text-neutral-900">Documentation</h1>
            <p className="text-neutral-500 text-lg max-w-xl mx-auto">Product guides, specifications, and technical resources.</p>
          </div>

          <div className="text-center py-16">
            <p className="text-neutral-400">Coming soon...</p>
          </div>
        </div>
      </section>
      <Footer />
    </main>
  )
}
