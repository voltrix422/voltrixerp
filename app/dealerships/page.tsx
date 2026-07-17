import Navbar from "@/components/landing/navbar"
import Footer from "@/components/landing/footer"
import DealershipsLocationBg from "@/components/landing/dealerships-location-bg"
import { MapPin, Phone, Mail, Clock, ExternalLink, Store } from "lucide-react"
import { mapsHref, normalizeDealership, type DealershipRecord } from "@/lib/dealership-display"

async function getDealerships(): Promise<DealershipRecord[]> {
  const base = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"
  const res = await fetch(`${base}/api/db/dealerships?public=true`, { cache: "no-store" })
  if (!res.ok) return []
  return res.json()
}

export default async function DealershipsPage() {
  const dealerships = (await getDealerships()).map(normalizeDealership)
  const cities = [...new Set(dealerships.map(d => d.city).filter(Boolean))]

  return (
    <main className="relative min-h-screen bg-white text-neutral-900">
      <DealershipsLocationBg />
      <Navbar />

      <section className="relative z-10 pt-36 pb-24 px-4">
        <div className="max-w-5xl mx-auto space-y-12">
          <div className="text-center space-y-4">
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#1a9f9a" }}>
              Authorized Partners
            </p>
            <h1 className="text-5xl font-bold tracking-tight text-neutral-900">Dealerships</h1>
            <p className="text-neutral-500 text-lg max-w-xl mx-auto">
              Find a Voltrix authorized dealership near you for genuine products, expert advice, and warranty support.
            </p>
            {dealerships.length > 0 && (
              <p className="text-sm text-neutral-400">
                {dealerships.length} location{dealerships.length !== 1 ? "s" : ""}
                {cities.length > 0 && ` across ${cities.length} cit${cities.length !== 1 ? "ies" : "y"}`}
              </p>
            )}
          </div>

          {dealerships.length === 0 ? (
            <div className="text-center py-16 rounded-2xl border border-dashed border-neutral-200 bg-white/70 backdrop-blur-sm">
              <Store className="w-8 h-8 text-neutral-300 mx-auto mb-3" />
              <p className="text-neutral-400">Authorized dealerships coming soon.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {dealerships.map(dealership => {
                const mapLink = mapsHref(dealership)
                const telHref = dealership.phone ? `tel:${dealership.phone.replace(/\s/g, "")}` : null

                return (
                  <article
                    key={dealership.id}
                    className="rounded-2xl border border-neutral-100 bg-white/75 backdrop-blur-sm p-6 space-y-4 hover:border-neutral-200 hover:bg-white/90 transition-colors shadow-sm shadow-neutral-100/50"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                        style={{ backgroundColor: "#1a9f9a12" }}
                      >
                        <Store className="w-5 h-5" style={{ color: "#1a9f9a" }} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h2 className="text-xl font-bold text-neutral-900 leading-tight">
                          {dealership.displayName}
                        </h2>
                        {dealership.city && (
                          <p className="text-sm text-neutral-500 mt-0.5">{dealership.city}</p>
                        )}
                      </div>
                    </div>

                    {dealership.address && (
                      <p className="text-sm text-neutral-600 leading-relaxed pl-[52px]">{dealership.address}</p>
                    )}

                    <div className="pl-[52px] space-y-2">
                      {telHref && (
                        <a
                          href={telHref}
                          className="flex items-center gap-2 text-sm text-neutral-600 hover:text-neutral-900 transition-colors"
                        >
                          <Phone className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                          {dealership.phone}
                        </a>
                      )}

                      {dealership.email && (
                        <a
                          href={`mailto:${dealership.email}`}
                          className="flex items-center gap-2 text-sm text-neutral-600 hover:text-neutral-900 transition-colors break-all"
                        >
                          <Mail className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                          {dealership.email}
                        </a>
                      )}

                      {dealership.openingHours && (
                        <p className="flex items-center gap-2 text-sm text-neutral-600">
                          <Clock className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                          {dealership.openingHours}
                        </p>
                      )}

                      {dealership.contactPerson && (
                        <p className="text-sm text-neutral-500">Contact: {dealership.contactPerson}</p>
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
                          <MapPin className="w-3.5 h-3.5" />
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

      <div className="relative z-10">
        <Footer />
      </div>
    </main>
  )
}
