import { getProductDisplayName } from "@/lib/product-display-name"
import { normalizeSpecRows } from "@/lib/product-specs"

export type ProductSeoFaq = { q: string; a: string }

export type ProductSeoCopy = {
  h1: string
  intro: string
  features: { title: string; body: string }[]
  compatible: string
  installation: string
  warranty: string
  useCases: string
  vsLeadAcid: string
  faqs: ProductSeoFaq[]
}

function isInverter(category: string, name: string): boolean {
  const blob = `${category} ${name}`.toLowerCase()
  return blob.includes("inverter")
}

export function buildProductSeoCopy(product: Record<string, unknown>): ProductSeoCopy {
  const { title, model } = getProductDisplayName({
    name: String(product.name ?? ""),
    model: product.model != null ? String(product.model) : undefined,
  })
  const category = String(product.category || "")
  const warranty = String(product.warranty || "5 years").trim() || "5 years"
  const inverter = isInverter(category, title)
  const specBits = normalizeSpecRows(product.specs)
    .slice(0, 6)
    .map((s) => `${s.label} ${s.value}`.trim())
    .filter(Boolean)
    .join(", ")

  if (inverter) {
    return {
      h1: `${title} — Hybrid Solar Inverter for Pakistan`,
      intro: `${title}${model ? ` (model ${model})` : ""} is a Voltrix hybrid solar inverter for homes and businesses in Pakistan. It is designed to work with LiFePO4 solar batteries, manage grid and solar input, and keep essential loads running during load shedding. Buyers comparing hybrid solar inverter options in Pakistan can use this page for specs, warranty, and a quote.`,
      features: [
        {
          title: "Solar + grid + battery",
          body: "Hybrid operation lets the inverter use solar first, charge a lithium battery, and draw from the grid only when needed — a practical setup for Pakistani load-shedding patterns.",
        },
        {
          title: "Sized for real homes",
          body: "Choose capacity based on AC tons, pumps, and lighting. Pair with a Voltrix LiFePO4 battery so backup time matches your evening and night load.",
        },
        {
          title: "Installer-friendly",
          body: "Voltrix supports dealers and installers with documentation, warranty claims, and after-sales help from Islamabad.",
        },
      ],
      compatible: `This inverter is intended for solar PV arrays and LiFePO4 energy storage. Confirm voltage and charge settings with your installer before pairing with a specific Voltrix battery model.${specBits ? ` Listed specs include: ${specBits}.` : ""}`,
      installation:
        "A licensed installer should size DC cables, AC output, earthing, and breaker ratings. Mount the inverter in a ventilated, dry location away from direct sun. Commissioning includes lithium charge voltages, current limits, and a test of backup loads. Voltrix support in Islamabad can review your single-line diagram.",
      warranty: `Covered by Voltrix warranty (${warranty}). Register the serial after installation and keep purchase proof. Support is available through Voltrix Batteries Pvt Ltd in I-9/2, Islamabad.`,
      useCases:
        "Typical uses include home solar with net metering, shop backup, and three-phase commercial sites where a hybrid inverter must handle both solar harvest and battery discharge.",
      vsLeadAcid:
        "A hybrid inverter with lithium storage charges faster and cycles more often than a lead-acid or tubular bank of the same footprint, which matters in heat and daily outages.",
      faqs: [
        {
          q: `Is the ${title} suitable for Pakistan solar systems?`,
          a: "Yes. It is sold for Pakistani grid and solar conditions. An installer should confirm array size, battery voltage, and earthing.",
        },
        {
          q: "Does it work with Voltrix LiFePO4 batteries?",
          a: "Voltrix inverters are designed to pair with Voltrix lithium batteries. Share your panel count and backup hours when you request a quote so we can match the bank.",
        },
        {
          q: "How do I get a price?",
          a: "Use Request a Quote on this page or contact Voltrix in Islamabad. Prices can depend on phase, accessories, and installation.",
        },
      ],
    }
  }

  return {
    h1: `${title} — LiFePO4 Solar Battery for Home & Business`,
    intro: `${title}${model ? ` (model ${model})` : ""} is a Voltrix LiFePO4 (lithium iron phosphate) energy storage battery for solar systems in Pakistan. It is built for daily cycling, load shedding backup, and pairing with hybrid inverters — a longer-life alternative to tubular and lead-acid banks. This page covers who it is for, specifications, compatibility, and warranty.`,
    features: [
      {
        title: "LiFePO4 chemistry",
        body: "Lithium iron phosphate cells are used for thermal stability and long cycle life compared with older lead-acid solar batteries commonly sold in Pakistan.",
      },
      {
        title: "Solar storage and backup",
        body: "Store daytime solar and run lights, fans, IT loads, and selected ACs at night or during outages, depending on the kWh size you choose.",
      },
      {
        title: "BMS protection",
        body: "A battery management system helps protect against over-charge, over-discharge, and short circuit when the pack is installed as specified.",
      },
    ],
    compatible: `Install with a compatible hybrid solar inverter and correctly sized PV array. Voltrix can recommend inverter pairings for this capacity.${specBits ? ` Key figures: ${specBits}.` : ""} A qualified installer should set charge voltage, current limits, and cable size.`,
    installation:
      "Place the pack in a shaded, ventilated indoor or outdoor-rated enclosure as specified. Keep it off wet floors, use the correct fuse or breaker, and never mix old tubular batteries on the same lithium bus. Your installer must set the inverter to a LiFePO4 profile that matches this voltage. After install, start the warranty with the serial number as instructed by Voltrix.",
    warranty: `This product is sold with Voltrix warranty (${warranty}). Keep the invoice and serial number. Warranty start follows Voltrix policy after delivery and registration. After-sales support is handled by Voltrix Batteries Pvt Ltd, Plot 73, Street 14, I-9/2, Islamabad.`,
    useCases:
      "Homes that want lithium battery backup, shops that cannot afford long outages, and commercial solar storage where cycle life matters more than a cheap tubular replacement.",
    vsLeadAcid:
      "Compared with tubular batteries, LiFePO4 typically offers more usable capacity per cycle, faster charging from solar, and less maintenance — important in Pakistan’s heat. Upfront price is higher; lifetime energy cost is often lower.",
    faqs: [
      {
        q: `Who should buy the ${title} in Pakistan?`,
        a: "Households and businesses adding solar storage or replacing a failing lead-acid bank. Share your inverter model and backup hours when you request a quote.",
      },
      {
        q: "Can I use it with an existing solar inverter?",
        a: "Often yes if the inverter supports lithium / LiFePO4 charge profiles and the voltage matches. Confirm with your installer or Voltrix support before purchase.",
      },
      {
        q: "How long does a LiFePO4 solar battery last?",
        a: "Voltrix lithium packs are designed for many years of cycling when used within spec. Real life depends on depth of discharge, temperature, and inverter settings.",
      },
      {
        q: "Where can I see the price?",
        a: "Listed prices appear on this page when published. Some systems are quote-only. Contact Islamabad for a current lithium battery price including delivery.",
      },
    ],
  }
}

export function productMetaDescription(product: Record<string, unknown>, fallback: string): string {
  const { title } = getProductDisplayName({
    name: String(product.name ?? ""),
    model: product.model != null ? String(product.model) : undefined,
  })
  const warranty = String(product.warranty || "5-year warranty")
  const category = String(product.category || "")
  const inverter = isInverter(category, title)
  const raw = inverter
    ? `Voltrix ${title} hybrid solar inverter in Pakistan. ${warranty}. Request a quote for home & commercial solar.`
    : `Voltrix ${title} LiFePO4 solar battery in Pakistan. ${warranty}. Energy storage for homes & businesses.`
  const source = fallback.trim().length >= 80 && /[.!?]$/.test(fallback.trim()) ? fallback.trim() : raw
  return source
}
