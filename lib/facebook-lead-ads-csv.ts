import { isMetaLeadAdsExport, parseCsv, parseLeadImportCsv, type LeadCsvRow } from "@/lib/csv-leads"

/** Expected Facebook / Meta Lead Ads export columns. */
export const FACEBOOK_LEAD_ADS_HEADERS = [
  "id",
  "created_time",
  "ad_id",
  "ad_name",
  "adset_id",
  "adset_name",
  "campaign_id",
  "campaign_name",
  "form_id",
  "form_name",
  "is_organic",
  "platform",
  "FULL_NAME",
  "PHONE",
  "COMPANY_NAME",
  "City",
  "Address",
  "lead_status",
] as const

function escCsvSampleCell(value: string): string {
  const s = String(value ?? "")
  if (/[,"\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function sampleCsvRow(values: string[]): string {
  return values.map(escCsvSampleCell).join(",")
}

/** Downloadable template matching Meta / Facebook Lead Ads export columns. */
export const FACEBOOK_LEAD_ADS_SAMPLE_CSV = [
  FACEBOOK_LEAD_ADS_HEADERS.join(","),
  sampleCsvRow([
    "l:sample001",
    "2026-06-19T10:00:00+05:00",
    "ag:120245380065400072",
    "Voltrix lead form promo",
    "as:120245380065370072",
    "Installers campaign",
    "c:120245380065120072",
    "Installers campaign",
    "f:1333129181993129",
    "Voltrix installer form",
    "FALSE",
    "fb",
    "Ali Ahmed",
    "p:+923001234567",
    "Green Sun Solar",
    "Multan",
    "Model Town Multan",
    "complete",
  ]),
  sampleCsvRow([
    "l:sample002",
    "2026-06-19T11:30:00+05:00",
    "ag:120245380065400072",
    "Voltrix lead form promo",
    "as:120245380065370072",
    "Installers campaign",
    "c:120245380065120072",
    "Installers campaign",
    "f:1333129181993129",
    "Voltrix installer form",
    "FALSE",
    "fb",
    "Sara Khan",
    "p:+923339876543",
    "Sunbright Energy",
    "Lahore",
    "Gulberg Lahore",
    "complete",
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
