import { Space_Grotesk } from "next/font/google"
import Navbar from "@/components/landing/navbar"
import Hero from "@/components/landing/hero"
import FeaturedProduct from "@/components/landing/featured-product"
import Products from "@/components/landing/products"
import Testimonials from "@/components/landing/testimonials"
import Footer from "@/components/landing/footer"
import WhatsappButton from "@/components/landing/whatsapp-button"

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-space-grotesk",
})

export default function Home() {
  return (
    <main
        className={`${spaceGrotesk.variable} min-h-screen bg-white text-neutral-900 antialiased`}
        style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}
      >
        <Navbar />
        <div id="home">
          <Hero />
        </div>
        <FeaturedProduct />
        <Products />
        <Testimonials />
        <Footer />
        <WhatsappButton />
      </main>
  )
}
