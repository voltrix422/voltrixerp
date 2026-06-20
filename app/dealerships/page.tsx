import Navbar from "@/components/landing/navbar"
import Footer from "@/components/landing/footer"
import { MapPin, Phone, Mail, Clock, ExternalLink, Store, ShieldCheck, User } from "lucide-react"
import { mapsHref, normalizeDealership, type DealershipRecord } from "@/lib/dealership-display"

async function getDealerships(): Promise<DealershipRecord[]> {
  const base = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"
  const res = await fetch(`${base}/api/db/dealerships?public=true`, { cache: "no-store" })
  if (!res.ok) return []
  return res.json()
}

function groupByCity(dealerships: ReturnType<typeof normalizeDealership>[]) {
  const groups = new Map<string, ReturnType<typeof normalizeDealership>[]>()
  for (const d of dealerships) {
    const city = d.city || "Other locations"
    const list = groups.get(city) ?? []
    list.push(d)
    groups.set(city, list)
  }
  return [...groups.entries()]
}

export default async function DealershipsPage() {
  const dealerships = (await getDealerships()).map(normalizeDealership)
  const grouped = groupByCity(dealerships)
  const cities = [...new Set(dealerships.map(d => d.city).filter(Boolean))]

  return (
    <main className="min-h-screen bg-neutral-50 text-neutral-900">
      <Navbar />

      <section
        className="pt-36 pb-20 px-4 relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #0d4f4c 0%, #1a9f9a 50%, #2bc4be 100%)" }}
      >
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 w-64 h-64 rounded-full bg-white blur-3xl" />
          <div className="absolute bottom-0 right-10 w-96 h-96 rounded-full bg-white blur-3xl" />
        </div>
        <div className="max-w-5xl mx-auto text-center space-y-5 relative">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/15 backdrop-blur-sm border border-white/20 text-white text-xs font-semibold uppercase tracking-widest">
            <ShieldCheck className="w-3.5 h-3.5" />
            Authorized Partners
          </div>
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-white">Dealerships</h1>
          <p className="text-white/80 text-lg max-w-2xl mx-auto leading-relaxed">
            Find a Voltrix authorized dealership near you for genuine products, expert advice, and full warranty support.
          </p>
          {cities.length > 0 && (
            <p className="text-white/60 text-sm">
              {dealerships.length} partner{dealerships.length !== 1 ? "s" : ""} across {cities.length} cit{cities.length !== 1 ? "ies" : "y"}
            </p>
          )}
        </div>
      </section>

      <section className="py-16 px-4 -mt-8">
        <div className="max-w-5xl mx-auto space-y-12">
          {dealerships.length === 0 ? (
            <div className="text-center py-20 rounded-2xl border border-dashed border-neutral-200 bg-white shadow-sm">
              <Store className="w-10 h-10 text-neutral-300 mx-auto mb-4" />
              <p className="text-neutral-400 text-lg">Authorized dealerships coming soon.</p>
              <p className="text-neutral-300 text-sm mt-1">Check back for partner locations in your area.</p>
            </div>
          ) : (
            grouped.map(([city, items]) => (
              <div key={city} className="space-y-5">
                {grouped.length > 1 && (
                  <div className="flex items-center gap-3">
                    <h2 className="text-sm font-semibold uppercase tracking-widest text-neutral-400">{city}</h2>
                    <div className="flex-1 h-px bg-neutral-200" />
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {items.map(dealership => {
                    const mapLink = mapsHref(dealership)
                    const telHref = dealership.phone ? `tel:${dealership.phone.replace(/\s/g, "")}` : null

                    return (
                      <article
                        key={dealership.id}
                        className="group rounded-2xl bg-white border border-neutral-100 shadow-sm hover:shadow-md hover:border-[#1a9f9a]/30 transition-all duration-300 overflow-hidden"
                      >
                        <div className="h-1.5" style={{ background: "linear-gradient(90deg, #1a9f9a, #2bc4be)" }} />

                        <div className="p-6 space-y-5">
                          <div className="flex items-start gap-4">
                            <div
                              className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                              style={{ backgroundColor: "#1a9f9a15" }}
                            >
                              <Store className="w-5 h-5" style={{ color: "#1a9f9a" }} />
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <h3 className="text-xl font-bold text-neutral-900 leading-tight">
                                    {dealership.displayName}
                                  </h3>
                                  {dealership.city && (
                                    <p className="text-sm text-neutral-500 mt-1">{dealership.city}</p>
                                  )}
                                </div>
                                <span
                                  className="shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-full uppercase tracking-wide"
                                  style={{ backgroundColor: "#1a9f9a12", color: "#1a9f9a" }}
                                >
                                  <ShieldCheck className="w-3 h-3" />
                                  Authorized
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="rounded-xl bg-neutral-50 border border-neutral-100 divide-y divide-neutral-100">
                            {dealership.address && (
                              <div className="flex items-start gap-3 px-4 py-3">
                                <MapPin className="w-4 h-4 text-[#1a9f9a] shrink-0 mt-0.5" />
                                <div className="min-w-0">
                                  <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Address</p>
                                  <p className="text-sm text-neutral-700 leading-relaxed mt-0.5">{dealership.address}</p>
                                </div>
                              </div>
                            )}

                            {telHref && (
                              <div className="flex items-start gap-3 px-4 py-3">
                                <Phone className="w-4 h-4 text-[#1a9f9a] shrink-0 mt-0.5" />
                                <div className="min-w-0">
                                  <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Phone</p>
                                  <a
                                    href={telHref}
                                    className="text-sm font-medium text-neutral-800 hover:text-[#1a9f9a] transition-colors mt-0.5 inline-block"
                                  >
                                    {dealership.phone}
                                  </a>
                                </div>
                              </div>
                            )}

                            {dealership.email && (
                              <div className="flex items-start gap-3 px-4 py-3">
                                <Mail className="w-4 h-4 text-[#1a9f9a] shrink-0 mt-0.5" />
                                <div className="min-w-0">
                                  <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Email</p>
                                  <a
                                    href={`mailto:${dealership.email}`}
                                    className="text-sm font-medium text-neutral-800 hover:text-[#1a9f9a] transition-colors mt-0.5 inline-block break-all"
                                  >
                                    {dealership.email}
                                  </a>
                                </div>
                              </div>
                            )}

                            {dealership.contactPerson && (
                              <div className="flex items-start gap-3 px-4 py-3">
                                <User className="w-4 h-4 text-[#1a9f9a] shrink-0 mt-0.5" />
                                <div className="min-w-0">
                                  <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Contact</p>
                                  <p className="text-sm text-neutral-700 mt-0.5">{dealership.contactPerson}</p>
                                </div>
                              </div>
                            )}

                            {dealership.openingHours && (
                              <div className="flex items-start gap-3 px-4 py-3">
                                <Clock className="w-4 h-4 text-[#1a9f9a] shrink-0 mt-0.5" />
                                <div className="min-w-0">
                                  <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Hours</p>
                                  <p className="text-sm text-neutral-700 mt-0.5">{dealership.openingHours}</p>
                                </div>
                              </div>
                            )}
                          </div>

                          {mapLink && (
                            <a
                              href={mapLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center justify-center gap-2 w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                              style={{ backgroundColor: "#1a9f9a" }}
                            >
                              Get directions
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          )}
                        </div>
                      </article>
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <Footer />
    </main>
  )
}
