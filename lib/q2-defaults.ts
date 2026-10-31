import type { QuoteCustomSection, QuoteTermSection, QuoteWarrantySection } from "@/lib/extensive-quotations"

export const DEFAULT_Q2_PREPARED_BY = "Engr. Fasi Ur Rehman"

/** Table-style warranties: productName | brand (heading) | duration (plainText). */
export function createDefaultQ2Warranties(stamp = Date.now()): QuoteWarrantySection[] {
  const rows: Omit<QuoteWarrantySection, "id">[] = [
    {
      productName: "PV Solar Module Performance Warranty (As per manufacturer's policy)",
      heading: "Tier 1 Grade 'A'",
      bodyType: "plain",
      bullets: [],
      plainText: "25 years",
    },
    {
      productName: "PV Module Product Warranty (As per manufacturer's policy)",
      heading: "Tier 1 Grade 'A'",
      bodyType: "plain",
      bullets: [],
      plainText: "12 years",
    },
    {
      productName: "Inverter Warranty (As per manufacturer's policy)",
      heading: "Ongrid Inverter",
      bodyType: "plain",
      bullets: [],
      plainText: "05 years",
    },
    {
      productName: "BESS Warranty (As per manufacturer's policy)",
      heading: "Voltrix",
      bodyType: "plain",
      bullets: [],
      plainText: "10 years",
    },
    {
      productName: "Complete System Warranty (As per Voltrix policy)",
      heading: "Voltrix Official Service Warranty",
      bodyType: "plain",
      bullets: [],
      plainText: "01 year",
    },
  ]
  return rows.map((row, i) => ({ ...row, id: `warranty-default-${stamp}-${i}` }))
}

export function createDefaultQ2Terms(stamp = Date.now()): QuoteTermSection[] {
  const rows: Omit<QuoteTermSection, "id">[] = [
    {
      heading: "Pre-Requisites",
      bodyType: "bullets",
      plainText: "",
      bullets: [
        "Ensure clear and easy access to the rooftop/ground for solar installation activities.",
        "Complete all required civil work and internal wiring before solar system deployment, if not included in the scope of work.",
        "Provide Wi-Fi access for system monitoring and online connectivity.",
        "Complete the change of meter title and sanctioned load limit, where applicable. Obtain all required permissions or NOCs from the relevant authorities before commissioning.",
      ],
    },
    {
      heading: "Payment Terms",
      bodyType: "bullets",
      plainText: "",
      bullets: [
        "40% Advance Payment – Upon signing the contract.",
        "40% Payment – After material delivery.",
        "20% Payment – After project completion.",
      ],
    },
    {
      heading: "Notes",
      bodyType: "bullets",
      plainText: "",
      bullets: [
        "VOLTRIX will not buy back the installed system under any circumstances.",
        "This quotation is based on standard terms and conditions and may be revised at the time of contract execution, if required.",
        "All works mentioned in the Scope of Work shall be executed by VOLTRIX.",
        "The Client is requested to carefully review and sign the contract before confirmation.",
        "The quotation includes all charges for the works specifically mentioned in the Scope of Work.",
      ],
    },
  ]
  return rows.map((row, i) => ({ ...row, id: `term-default-${stamp}-${i}` }))
}

export function createDefaultQ2CustomSections(stamp = Date.now()): QuoteCustomSection[] {
  return [
    {
      id: `custom-unit-gen-${stamp}`,
      heading: "Unit Generation",
      bodyType: "plain",
      bullets: [],
      plainText: "",
    },
  ]
}

export const DEFAULT_Q2_INTRO =
  "Thank you for considering Voltrix Batteries Pvt. Ltd. Please find below our commercial proposal for your solar / energy storage requirements."
