import {
  VOLTRIX_COMPREHENSIVE_WARRANTY,
  type WarrantyTermsSection,
} from "@/lib/warranty-comprehensive-terms"

/** These SKUs are 5-year replacement only. All other Voltrix products stay 5+5. */
export const FIVE_YEAR_WARRANTY_MODELS = [
  "HS-25.6V100AH",
  "HS-12.8V 100Ah",
  "HS-YD3.6KW",
  "HS-TQS4.2KW+8038.4Wh",
  "HS-TQS4.2KW",
] as const

export const DEFAULT_WARRANTY_YEARS = 10
export const FIVE_YEAR_WARRANTY_YEARS = 5

export type WarrantyPolicyKind = "five_year" | "five_plus_five"

export type WarrantyPolicy = {
  kind: WarrantyPolicyKind
  years: number
  policyLabel: string
  policySummary: string
}

export type WarrantyCardDocument = {
  company: string
  documentTitle: string
  policyLabel: string
  policySummary: string
  sections: WarrantyTermsSection[]
  footer: { company: string; location: string; website: string }
}

export function compactWarrantyModelKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^man[-_\s]*/, "")
    .replace(/[^a-z0-9]/g, "")
}

const FIVE_YEAR_KEYS = FIVE_YEAR_WARRANTY_MODELS.map(compactWarrantyModelKey)

function haystacksForProduct(productName?: string | null, serialNumber?: string | null): string[] {
  return [productName, serialNumber].map((v) => compactWarrantyModelKey(v || "")).filter(Boolean)
}

export function isFiveYearWarrantyProduct(
  productName?: string | null,
  serialNumber?: string | null,
): boolean {
  const haystacks = haystacksForProduct(productName, serialNumber)
  if (haystacks.length === 0) return false
  return FIVE_YEAR_KEYS.some((key) => haystacks.some((h) => h === key || h.startsWith(key)))
}

export function warrantyYearsForProduct(
  productName?: string | null,
  serialNumber?: string | null,
): number {
  return isFiveYearWarrantyProduct(productName, serialNumber)
    ? FIVE_YEAR_WARRANTY_YEARS
    : DEFAULT_WARRANTY_YEARS
}

export function warrantyPolicyForProduct(
  productName?: string | null,
  serialNumber?: string | null,
): WarrantyPolicy {
  if (isFiveYearWarrantyProduct(productName, serialNumber)) {
    return {
      kind: "five_year",
      years: FIVE_YEAR_WARRANTY_YEARS,
      policyLabel: "5 Year Replacement",
      policySummary: "5 years limited replacement for manufacturing defects",
    }
  }
  return {
    kind: "five_plus_five",
    years: DEFAULT_WARRANTY_YEARS,
    policyLabel: VOLTRIX_COMPREHENSIVE_WARRANTY.policyLabel,
    policySummary: VOLTRIX_COMPREHENSIVE_WARRANTY.policySummary,
  }
}

const FIVE_YEAR_SECTIONS: WarrantyTermsSection[] = [
  {
    title: "1. Warranty Coverage",
    paragraphs: [
      "Voltrix Batteries Pvt. Ltd. warrants that its products are free from manufacturing defects in material and workmanship under normal operating conditions during the applicable 5-year replacement warranty period (5 years from the warranty start date).",
      "This warranty applies only to genuine Voltrix products purchased through authorized dealers, distributors, or official sales channels.",
    ],
  },
  {
    title: "2. Warranty Start Date",
    paragraphs: [
      "The 5-year replacement warranty period shall start from: the original date of purchase mentioned on the customer invoice, and the warranty activation/start date mentioned on the digital warranty card. Both dates must match for the warranty claim to be considered valid.",
      "Failure to provide matching purchase and warranty registration records may result in rejection of the warranty claim.",
    ],
  },
  {
    title: "3. Product Warranty Categories",
    bullets: [
      "This product is covered by a 5-year replacement warranty for manufacturing defects, internal malfunction, and factory defects. It is not covered by the 5+5 year replacement policy that applies to other Voltrix models.",
      "Warranty terms may vary by product model. Other Voltrix products may carry a 5+5 year replacement warranty as stated on their own warranty card.",
    ],
  },
  {
    title: "4. Replacement Warranty Policy",
    paragraphs: [
      "This product is covered under a 5-year replacement warranty policy from the warranty start date. An approved manufacturing defect entitles the customer to repair or replacement of the defective unit during that period.",
      "The product will first be inspected and tested at the designated Voltrix Warranty Claim Lab or authorized service center. If the issue is a manufacturing defect or internal malfunction, Voltrix may repair the product. If it cannot be technically resolved, the product may be replaced with an equivalent unit.",
      "Replacement does not mean immediate exchange at dealer location. All warranty claims are subject to technical inspection and approval by Voltrix Batteries Pvt. Ltd.",
    ],
  },
]

export function warrantyDocumentForProduct(
  productName?: string | null,
  serialNumber?: string | null,
): WarrantyCardDocument {
  const policy = warrantyPolicyForProduct(productName, serialNumber)
  const sections: WarrantyTermsSection[] =
    policy.kind === "five_year"
      ? [...FIVE_YEAR_SECTIONS, ...VOLTRIX_COMPREHENSIVE_WARRANTY.sections.slice(4)]
      : [...VOLTRIX_COMPREHENSIVE_WARRANTY.sections]

  return {
    company: VOLTRIX_COMPREHENSIVE_WARRANTY.company,
    documentTitle: VOLTRIX_COMPREHENSIVE_WARRANTY.documentTitle,
    policyLabel: policy.policyLabel,
    policySummary: policy.policySummary,
    sections,
    footer: { ...VOLTRIX_COMPREHENSIVE_WARRANTY.footer },
  }
}
