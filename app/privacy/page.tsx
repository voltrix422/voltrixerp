import Navbar from "@/components/landing/navbar"
import Footer from "@/components/landing/footer"

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-white text-neutral-900">
      <Navbar />
      <section className="pt-36 pb-24 px-4">
        <div className="max-w-3xl mx-auto space-y-12">
          <div className="text-center space-y-4">
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#1a9f9a" }}>Legal</p>
            <h1 className="text-5xl font-bold tracking-tight text-neutral-900">Privacy Policy</h1>
          </div>

          <div className="prose prose-neutral max-w-none space-y-6">
            <p className="text-neutral-600">Last updated: April 2026</p>
            
            <h2 className="text-xl font-semibold text-neutral-900">Information We Collect</h2>
            <p className="text-neutral-600">We collect information you provide directly to us, such as when you create an account, request a quote, or contact us. This may include your name, email address, phone number, and company information.</p>
            
            <h2 className="text-xl font-semibold text-neutral-900">How We Use Your Information</h2>
            <p className="text-neutral-600">We use the information we collect to provide, maintain, and improve our services, to communicate with you about our products and services, and to comply with legal obligations.</p>
            
            <h2 className="text-xl font-semibold text-neutral-900">Data Security</h2>
            <p className="text-neutral-600">We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction.</p>
            
            <h2 className="text-xl font-semibold text-neutral-900">Contact Us</h2>
            <p className="text-neutral-600">If you have any questions about this Privacy Policy, please contact us at privacy@voltrixev.com</p>
          </div>
        </div>
      </section>
      <Footer />
    </main>
  )
}
