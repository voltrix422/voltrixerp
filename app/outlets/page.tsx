import type { Metadata } from "next"
import Navbar from "@/components/landing/navbar"
import Footer from "@/components/landing/footer"
import { MapPin, Phone, Mail, Clock, ExternalLink } from "lucide-react"
import { buildPageMetadata } from "@/lib/seo"

export const metadata: Metadata = buildPageMetadata({
  title: "Outlets",
  description:
    "Locate Voltrix Batteries outlets near you in Pakistan for LiFePO₄ batteries, inverters, and after-sales support.",
  path: "/outlets",
})

type WebsiteOutlet = {
  id: string
  name: string
  city: string
  address: string
  phone: string
  email: string
  manager: string
  openingHours: string
  mapUrl: string
}

async function getOutlets(): Promise<WebsiteOutlet[]> {
  const base = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"
  const res = await fetch(`${base}/api/db/outlets?public=true`, { cache: "no-store" })
  if (!res.ok) return []
  return res.json()
}

function mapsHref(outlet: WebsiteOutlet) {
  if (outlet.mapUrl?.trim()) return outlet.mapUrl.trim()
  const query = [outlet.address, outlet.city].filter(Boolean).join(", ")
  if (!query) return null
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
}

export default async function OutletsPage() {
  const outlets = await getOutlets()

  return (
    <main className="min-h-screen bg-white text-neutral-900">
      <Navbar />
      <section className="pt-36 pb-24 px-4">
        <div className="max-w-5xl mx-auto space-y-12">
          <div className="text-center space-y-4">
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#1a9f9a" }}>
              Outlets
            </p>
            <h1 className="text-5xl font-bold tracking-tight text-neutral-900">Our Branches</h1>
            <p className="text-neutral-500 text-lg max-w-xl mx-auto">
              Visit a Voltrix outlet near you for products, support, and warranty services.
            </p>
          </div>

          {outlets.length === 0 ? (
            <div className="text-center py-16 rounded-2xl border border-dashed border-neutral-200">
              <p className="text-neutral-400">Outlet locations coming soon.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {outlets.map(outlet => {
                const mapLink = mapsHref(outlet)
                return (
                  <article
                    key={outlet.id}
                    className="rounded-2xl border border-neutral-100 p-6 space-y-4 hover:border-neutral-200 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                        style={{ backgroundColor: "#1a9f9a12" }}
                      >
                        <MapPin className="w-5 h-5" style={{ color: "#1a9f9a" }} />
                      </div>
                      <div className="min-w-0">
                        <h2 className="text-xl font-bold text-neutral-900">{outlet.name}</h2>
                        {outlet.city && (
                          <p className="text-sm text-neutral-500 mt-0.5">{outlet.city}</p>
                        )}
                      </div>
                    </div>

                    {outlet.address && (
                      <p className="text-sm text-neutral-600 leading-relaxed pl-[52px]">{outlet.address}</p>
                    )}

                    <div className="pl-[52px] space-y-2">
                      {outlet.phone && (
                        <a
                          href={`tel:${outlet.phone.replace(/\s/g, "")}`}
                          className="flex items-center gap-2 text-sm text-neutral-600 hover:text-neutral-900 transition-colors"
                        >
                          <Phone className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                          {outlet.phone}
                        </a>
                      )}
                      {outlet.email && (
                        <a
                          href={`mailto:${outlet.email}`}
                          className="flex items-center gap-2 text-sm text-neutral-600 hover:text-neutral-900 transition-colors"
                        >
                          <Mail className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                          {outlet.email}
                        </a>
                      )}
                      {outlet.openingHours && (
                        <p className="flex items-center gap-2 text-sm text-neutral-600">
                          <Clock className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                          {outlet.openingHours}
                        </p>
                      )}
                      {outlet.manager && (
                        <p className="text-sm text-neutral-500">Manager: {outlet.manager}</p>
                      )}
                    </div>

                    {mapLink && (
                      <div className="pl-[52px] pt-1">
                        <a
                          href={mapLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-sm font-medium transition-colors"
                          style={{ color: "#1a9f9a" }}
                        >
                          Open in Google Maps
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    )}
                  </article>
                )
              })}
            </div>
          )}
        </div>
      </section>
      <Footer />
    </main>
  )
}
