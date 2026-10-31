import type {
  QuoteCustomSection,
  QuoteProjectCard,
  QuoteTermSection,
  QuoteWarrantySection,
} from "@/lib/extensive-quotations"

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

/** Recent / previous solar projects — table defaults for Q2. */
export function createDefaultQ2Projects(stamp = Date.now()): QuoteProjectCard[] {
  const rows: Omit<QuoteProjectCard, "id">[] = [
    {
      title: "Solar Power Plants",
      client: "Fauji Cement Company Limited",
      location: "",
      summary:
        "Electrical Works for Solar Project (PV Panel Interconnection, DC/AC & MV/LV Cable Laying and Termination, Transformer & LV/MV Panel Installation, Overhead Transmission Line Works, Grounding & Lightning Protection, Street Lighting & Electrical Distribution Works)",
      projectValue: "11.937",
      capacityMw: "5",
      completionDate: "05 June 2024",
      imageUrls: [],
    },
    {
      title: "Solar Power Plants",
      client: "Fauji Cement Company Limited",
      location: "",
      summary:
        "Electrical Works (PV Module Stringing, Inverter Mounting, DC/AC Cable Laying & Termination, PV & Structure Earthing, LV Panel Installation, MV/LV/DC Excavation & MV Cable Works)",
      projectValue: "15.000",
      capacityMw: "10",
      completionDate: "11 November 2024",
      imageUrls: [],
    },
    {
      title: "Solar Power Plants",
      client: "Fauji Cement Company Limited",
      location: "",
      summary:
        "Electrical Works for Solar Project (DC & AC Cable Laying, Communication Cable Laying, Cable Termination & Testing, Cable Tray Installation, Combiner Panel Installation, Earthing Cable Laying & Connection)",
      projectValue: "1.000",
      capacityMw: "0.850",
      completionDate: "20 January 2025",
      imageUrls: [],
    },
    {
      title: "Solar Power Plants",
      client: "Fauji Cement Company Limited",
      location: "",
      summary:
        "Electrical Works (PV Module Stringing & Inverter Mounting, DC/AC Cable Laying & Termination, PV/Structure Earthing & LV Panel Installation, Communication & MV Cable Works, MV Excavation/Trenching & Earthing Bores, Transformer Sheds)",
      projectValue: "11.030",
      capacityMw: "10",
      completionDate: "13 August 2024",
      imageUrls: [],
    },
    {
      title: "Solar Power Plants",
      client: "Fauji Cement Company Limited",
      location: "",
      summary:
        "Electrical Works (Installation of Electrical Power & Control Equipment, Motors/VFDs/MCCs Installation, I/O Panels Installation, Equipment Tagging, Electrical Installation Works, Testing & Completion Works)",
      projectValue: "4.7923",
      capacityMw: "3",
      completionDate: "12 May 2026",
      imageUrls: [],
    },
    {
      title: "Solar Power Plants",
      client: "Fauji Cement Company Limited (FCCL)",
      location: "",
      summary:
        "Full Scope Electrical, Mechanical, Civil & Structural Installation (PV module stringing & inverter mounting, AC/DC cable laying & termination, LV panels & MV terminations, earthing system & bores, MV trenching & cable laying, testing & commissioning)",
      projectValue: "11.030",
      capacityMw: "5",
      completionDate: "13 August 2024",
      imageUrls: [],
    },
    {
      title: "Solar Power Plants",
      client: "TechX",
      location: "",
      summary:
        "Solar PV Project (New & Existing Structure Installation, LV Panels, Earthing, Electrical Installation, Testing & Commissioning)",
      projectValue: "45.000",
      capacityMw: "4.3",
      completionDate: "06 February 2025",
      imageUrls: [],
    },
    {
      title: "Solar Power Plants",
      client: "TECH X",
      location: "",
      summary:
        "Electrical, Mechanical, Civil & Structural Installation and Services for 4 MW Solar Plant (Electrical installation, mechanical installation, civil works, structural works, testing & commissioning, complete system operationalization)",
      projectValue: "—",
      capacityMw: "4",
      completionDate: "07 June 2024",
      imageUrls: [],
    },
    {
      title: "Solar Power Plants",
      client: "Foundation Solar Energy (Pvt.) Limited",
      location: "",
      summary:
        "Electrical Material for 5 MW Ground Mount Solar Power Plant (Cable trays & ladders, UPVC/flexible conduits, cable glands/lugs & termination/joint kits, earthing materials, lightning protection, cable-management accessories)",
      projectValue: "4.55629",
      capacityMw: "5",
      completionDate: "29 January 2021",
      imageUrls: [],
    },
  ]
  return rows.map((row, i) => ({ ...row, id: `project-default-${stamp}-${i}` }))
}

export function createDefaultQ2CustomSections(stamp = Date.now()): QuoteCustomSection[] {
  return [
    {
      id: `custom-unit-gen-${stamp}`,
      heading: "Unit Generation",
      bodyType: "bullets",
      bullets: [
        "Daily production average ≈ 4,000 kWh",
        "Monthly production average ≈ 120,000 kWh",
        "Annual production average ≈ 1,440,000 kWh",
      ],
      plainText: "",
    },
  ]
}

export const DEFAULT_Q2_INTRO =
  "Thank you for considering Voltrix Batteries Pvt. Ltd. Please find below our commercial proposal for your solar / energy storage requirements."
