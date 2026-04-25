import Navbar from "@/components/landing/navbar"
import Footer from "@/components/landing/footer"

export default function CookiesPage() {
  return (
    <main className="min-h-screen bg-white text-neutral-900">
      <Navbar />
      <section className="pt-36 pb-24 px-4">
        <div className="max-w-3xl mx-auto space-y-12">
          <div className="text-center space-y-4">
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#1a9f9a" }}>Legal</p>
            <h1 className="text-5xl font-bold tracking-tight text-neutral-900">Cookie Policy</h1>
          </div>

          <div className="prose prose-neutral max-w-none space-y-6">
            <p className="text-neutral-600">Last updated: April 2026</p>
            
            <h2 className="text-xl font-semibold text-neutral-900">What Are Cookies</h2>
            <p className="text-neutral-600">Cookies are small text files that are placed on your device when you visit our website. They help us provide you with a better experience by allowing the site to remember your preferences.</p>
            
            <h2 className="text-xl font-semibold text-neutral-900">How We Use Cookies</h2>
            <p className="text-neutral-600">We use cookies to analyze website traffic, personalize content, and improve our services. We may also use cookies for authentication and security purposes.</p>
            
            <h2 className="text-xl font-semibold text-neutral-900">Managing Cookies</h2>
            <p className="text-neutral-600">You can control and manage cookies through your browser settings. Please note that disabling certain cookies may affect the functionality of our website.</p>
            
            <h2 className="text-xl font-semibold text-neutral-900">Contact Us</h2>
            <p className="text-neutral-600">If you have any questions about our use of cookies, please contact us at privacy@voltrixev.com</p>
          </div>
        </div>
      </section>
      <Footer />
    </main>
  )
}
