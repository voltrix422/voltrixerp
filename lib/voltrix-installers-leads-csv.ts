import path from "path"

/** Bundled Meta/Facebook installer leads export (also in public/ for static download). */
export const VOLTRIX_INSTALLERS_LEADS_CSV_FILENAME = "Voltrix installers Leads 19 May 2026.csv"

export const VOLTRIX_INSTALLERS_LEADS_IMPORT_BATCH_ID = "voltrix-installers-2026-05-19"

export const VOLTRIX_INSTALLERS_LEADS_IMPORTER_NAME = "Voltrix installers May 2026"

export function getVoltrixInstallersLeadsCsvPath(): string {
  return path.join(process.cwd(), "public", VOLTRIX_INSTALLERS_LEADS_CSV_FILENAME)
}
