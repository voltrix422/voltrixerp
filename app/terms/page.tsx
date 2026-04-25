import Navbar from "@/components/landing/navbar"
import Footer from "@/components/landing/footer"

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-white text-neutral-900">
      <Navbar />
      <section className="pt-36 pb-24 px-4">
        <div className="max-w-3xl mx-auto space-y-12">
          <div className="text-center space-y-4">
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#1a9f9a" }}>Legal</p>
            <h1 className="text-5xl font-bold tracking-tight text-neutral-900">Terms of Service</h1>
          </div>

          <div className="prose prose-neutral max-w-none space-y-6">
            <p className="text-neutral-600">Last updated: April 2026</p>
            
            <h2 className="text-xl font-semibold text-neutral-900">Acceptance of Terms</h2>
            <p className="text-neutral-600">By accessing or using Voltrix services, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our services.</p>
            
            <h2 className="text-xl font-semibold text-neutral-900">Products and Services</h2>
            <p className="text-neutral-600">Voltrix offers battery products and related services. All products are subject to availability and we reserve the right to discontinue any product at any time.</p>
            
            <h2 className="text-xl font-semibold text-neutral-900">Warranty</h2>
            <p className="text-neutral-600">Our products come with manufacturer warranties as specified at the time of purchase. Warranty claims must be made in accordance with our warranty policy.</p>
            
            <h2 className="text-xl font-semibold text-neutral-900">Limitation of Liability</h2>
            <p className="text-neutral-600">Voltrix shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from the use of our products or services.</p>
            
            <h2 className="text-xl font-semibold text-neutral-900">Contact Us</h2>
            <p className="text-neutral-600">If you have any questions about these Terms of Service, please contact us at legal@voltrixev.com</p>
          </div>
        </div>
      </section>
      <Footer />
    </main>
  )
}
