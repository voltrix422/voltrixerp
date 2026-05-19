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
