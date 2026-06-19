import { isMetaLeadAdsExport, parseCsv, parseLeadImportCsv, type LeadCsvRow } from "@/lib/csv-leads"

/** CRM lead import columns (Facebook form fields). Full Meta exports with extra columns still import. */
export const LEAD_IMPORT_HEADERS = [
  "FULL_NAME",
  "PHONE",
  "COMPANY_NAME",
  "City",
  "Address",
] as const

/** @deprecated Use LEAD_IMPORT_HEADERS */
export const FACEBOOK_LEAD_ADS_HEADERS = LEAD_IMPORT_HEADERS

function escCsvSampleCell(value: string): string {
  const s = String(value ?? "")
  if (/[,"\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function sampleCsvRow(values: string[]): string {
  return values.map(escCsvSampleCell).join(",")
}

/** Downloadable import template (5 columns). */
export const FACEBOOK_LEAD_ADS_SAMPLE_CSV = [
  LEAD_IMPORT_HEADERS.join(","),
  sampleCsvRow([
    "Ali Ahmed",
    "p:+923001234567",
    "Green Sun Solar",
    "Multan",
    "Model Town Multan",
  ]),
  sampleCsvRow([
    "Sara Khan",
    "p:+923339876543",
    "Sunbright Energy",
    "Lahore",
    "Gulberg Lahore",
  ]),
].join("\n")

function csvRows(text: string): string[][] {
  return parseCsv(text.replace(/^\ufeff/, ""))
}

export function isFacebookLeadAdsCsv(text: string): boolean {
  const rows = csvRows(text)
  if (rows.length < 2) return false
  return isMetaLeadAdsExport(rows[0])
}

export function parseFacebookLeadAdsCsv(text: string): LeadCsvRow[] {
  if (!isFacebookLeadAdsCsv(text)) return []
  return parseLeadImportCsv(text)
}

export function facebookLeadAdsImportSummary(text: string): {
  valid: boolean
  rowCount: number
  message: string
} {
  if (!isFacebookLeadAdsCsv(text)) {
    return {
      valid: false,
      rowCount: 0,
      message: `Use a Facebook Lead Ads CSV with FULL_NAME, PHONE, COMPANY_NAME, City, Address.`,
    }
  }
  const rows = parseFacebookLeadAdsCsv(text)
  return {
    valid: true,
    rowCount: rows.length,
    message: `${rows.length} lead(s) ready to import.`,
  }
}
