import { VOLTRIX_INSTALLERS_LEADS_CSV_FILENAME } from "@/lib/voltrix-installers-leads-csv"

/** Public URL for the bundled Facebook installers export (served from /public). */
export function installersLeadsCsvPublicUrl(): string {
  return `/${VOLTRIX_INSTALLERS_LEADS_CSV_FILENAME.split("/").map(encodeURIComponent).join("/")}`
}

/** Load installers CSV in the browser (works even if server fs path differs on VPS). */
export async function fetchInstallersLeadsCsvText(): Promise<string> {
  const res = await fetch(installersLeadsCsvPublicUrl(), { cache: "no-store" })
  if (!res.ok) {
    throw new Error(
      `Could not load "${VOLTRIX_INSTALLERS_LEADS_CSV_FILENAME}" (${res.status}). ` +
        "Deploy the file to public/ on the server, then try again.",
    )
  }
  const text = await res.text()
  if (!text.trim()) throw new Error("Installers CSV file is empty.")
  return text
}
