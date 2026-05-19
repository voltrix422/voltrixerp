import type { CrmLeadRow } from "./crm-leads"

export type LeadCsvRow = {
  name: string
  company: string
  email: string
  phone: string
  notes: string
}

function parseCsvLine(line: string): string[] {
  const result: string[] = []
  let field = ""
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        field += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (!inQuotes && c === ",") {
      result.push(field.trim())
      field = ""
    } else {
      field += c
    }
  }
  result.push(field.trim())
  return result
}

export function parseCsv(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map(parseCsvLine)
}

function normHeader(h: string) {
  return h.toLowerCase().replace(/[\s_-]/g, "").replace(/^\ufeff/g, "").trim()
}

function stripBom(text: string) {
  return text.replace(/^\ufeff/, "")
}

/**
 * Resolve column index for known export aliases. Uses exact header match first, then
 * prefix match only (never substring-in-the-middle): e.g. "firstname" must not match
 * "phoneticfirstname" (Google Contacts), which caused bogus 3-letter "lead" names.
 */
function colIndex(header: string[], ...candidates: string[]): number {
  const cells = header.map(normHeader)
  for (const cand of candidates) {
    const c = normHeader(cand)
    const exact = cells.indexOf(c)
    if (exact >= 0) return exact
  }
  for (const cand of candidates) {
    const c = normHeader(cand)
    if (c.length < 4) continue
    const i = cells.findIndex((n) => {
      if (!n || n === c) return false
      if (n.startsWith("phonetic")) return false
      return n.startsWith(c)
    })
    if (i >= 0) return i
  }
  return -1
}

function trimCell(row: string[], i: number): string {
  if (i < 0 || i >= row.length) return ""
  return (row[i] ?? "").trim()
}

/** Google Contacts / Outlook-style "Organizati" (truncated) or Organization * columns — preserve column order. */
function orgColumnIndices(h: string[]): number[] {
  const out: number[] = []
  for (let i = 0; i < h.length; i++) {
    const raw = (h[i] ?? "").trim()
    const n = normHeader(raw)
    if (!n) continue
    if (n === "organizati" || n.startsWith("organizati")) {
      out.push(i)
      continue
    }
    if (n.includes("organization") || n.includes("organisation")) {
      out.push(i)
    }
  }
  return out
}

/**
 * Display name: single **name** column, or First + Middle + Last, else File As / Nickname; optional Name Pre / Suf.
 * Matches Google Contacts CSV exports (First Name, Last Name, Name Pre, Organizati, Phone 1 - Value, …).
 */
function buildLeadDisplayName(row: string[], h: string[]): string {
  const iName = colIndex(h, "name", "fullname", "leadname", "displayname", "contactname")
  const single = trimCell(row, iName)
  if (single) return single

  const iFirst = colIndex(h, "firstname", "first name", "givenname", "given name")
  const iMid = colIndex(h, "middlename", "middle name")
  const iLast = colIndex(h, "lastname", "last name", "surname", "familyname", "family name")
  const iFileAs = colIndex(h, "fileas", "file as")
  const iNick = colIndex(h, "nickname")

  const parts = [trimCell(row, iFirst), trimCell(row, iMid), trimCell(row, iLast)].filter(Boolean)
  let core = parts.join(" ")
  if (!core) core = trimCell(row, iFileAs)
  if (!core) core = trimCell(row, iNick)
  if (!core) return ""

  const iPre = colIndex(h, "namepre", "nameprefix", "honorificprefix", "prefix")
  const iSuf = colIndex(h, "namesuf", "namesuffix", "honorificsuffix", "suffix")
  const pre = trimCell(row, iPre)
  const suf = trimCell(row, iSuf)
  return [pre, core, suf].filter(Boolean).join(" ")
}

function headerSupportsLeadName(h: string[]): boolean {
  if (isMetaLeadAdsExport(h)) return true
  if (colIndex(h, "name", "fullname", "leadname", "displayname", "contactname") >= 0) return true
  if (colIndex(h, "firstname", "first name", "givenname", "given name") >= 0) return true
  if (colIndex(h, "lastname", "last name", "surname", "familyname", "family name") >= 0) return true
  if (colIndex(h, "fileas", "file as") >= 0) return true
  if (colIndex(h, "nickname") >= 0) return true
  return false
}

/** Meta / Facebook Lead Ads CSV (FULL_NAME, PHONE, COMPANY_NAME, City, Address, …). */
export function isMetaLeadAdsExport(h: string[]): boolean {
  const hasPerson = colIndex(h, "fullname", "full_name") >= 0
  const hasPhone = colIndex(h, "phone") >= 0
  const hasCompany = colIndex(h, "companyname", "company_name", "company") >= 0
  return hasPerson && hasPhone && hasCompany
}

/** Normalize Meta `p:+923001234567` style numbers for display (e.g. 0300 1234567). */
export function formatMetaLeadPhone(raw: string): string {
  let p = (raw ?? "").trim()
  if (!p) return ""
  if (p.toLowerCase().startsWith("p:")) p = p.slice(2).trim()
  const digits = p.replace(/\D/g, "")
  if (digits.startsWith("92") && digits.length >= 12) {
    const local = `0${digits.slice(2)}`
    if (local.length >= 11) return `${local.slice(0, 4)} ${local.slice(4)}`
    return local
  }
  if (digits.length === 11 && digits.startsWith("0")) {
    return `${digits.slice(0, 4)} ${digits.slice(4)}`
  }
  if (digits.length === 10) {
    return `${digits.slice(0, 4)} ${digits.slice(4)}`
  }
  return p
}

function parseMetaLeadAdsRows(rows: string[][], h: string[]): LeadCsvRow[] {
  const iFull = colIndex(h, "fullname", "full_name")
  const iPhone = colIndex(h, "phone")
  const iCompany = colIndex(h, "companyname", "company_name", "company")
  const iCity = colIndex(h, "city")
  const iAddress = colIndex(h, "address")
  const iPlatform = colIndex(h, "platform")
  const iCreated = colIndex(h, "createdtime", "created_time")
  const iStatus = colIndex(h, "leadstatus", "lead_status")

  const out: LeadCsvRow[] = []
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r]
    const fullName = trimCell(row, iFull)
    const companyName = trimCell(row, iCompany)
    const name = fullName || companyName
    if (!name) continue

    const company =
      fullName && companyName && fullName.toLowerCase() !== companyName.toLowerCase() ? companyName : ""

    const phone = formatMetaLeadPhone(trimCell(row, iPhone))
    const city = trimCell(row, iCity)
    const address = trimCell(row, iAddress)
    const platform = trimCell(row, iPlatform)
    const createdTime = trimCell(row, iCreated)
    const leadStatus = trimCell(row, iStatus)

    const noteParts: string[] = []
    if (city) noteParts.push(`Labels: ${city}`)
    if (address) noteParts.push(`Address: ${address}`)
    if (platform) noteParts.push(`Platform: ${platform}`)
    if (leadStatus) noteParts.push(`Lead status: ${leadStatus}`)
    if (createdTime) noteParts.push(`Submitted: ${createdTime}`)

    out.push({
      name,
      company,
      email: "",
      phone,
      notes: noteParts.join("\n"),
    })
  }
  return out
}

/**
 * Parse uploaded CSV into lead rows. First row = headers.
 * Supports:
 * - Simple export: **name**, company, email, phone, notes
 * - Google Contacts–style: First Name, Middle Name, Last Name, Name Pre, Name Suf, Nickname, File As,
 *   Organizati (×3 truncated), Birthday, Notes, Labels, Phone 1 - Value, E-mail 1 - Value, …
 */
export function parseLeadImportCsv(text: string): LeadCsvRow[] {
  const rows = parseCsv(stripBom(text))
  if (rows.length < 2) return []
  const h = rows[0]
  if (isMetaLeadAdsExport(h)) return parseMetaLeadAdsRows(rows, h)
  if (!headerSupportsLeadName(h)) return []

  const orgIdx = orgColumnIndices(h)
  const iEmail = colIndex(
    h,
    "email1value",
    "email1-value",
    "e-mail1value",
    "e-mail1-value",
    "emailaddress",
    "email",
    "e-mail"
  )
  const iPhone = colIndex(
    h,
    "phone",
    "phone1value",
    "phone1-value",
    "phonework",
    "phone2value",
    "mobile",
    "mobilephone",
    "phonenumber",
    "cellphone",
    "telephone",
    "tel"
  )
  const iNotes = colIndex(h, "notes", "remarks", "comments", "description")
  const iBirth = colIndex(h, "birthday", "birthdate")
  const iLabels = colIndex(h, "labels", "groups", "categories")
  const iCompany = colIndex(h, "companyname", "company_name", "company", "business", "employer")

  const out: LeadCsvRow[] = []
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r]
    const name = buildLeadDisplayName(row, h)
    if (!name) continue

    const orgVals = orgIdx.map((i) => trimCell(row, i)).filter(Boolean)
    let company = orgVals[0] ?? ""
    if (!company && iCompany >= 0) company = trimCell(row, iCompany)

    const email = iEmail >= 0 ? trimCell(row, iEmail) : ""
    const phoneRaw = iPhone >= 0 ? trimCell(row, iPhone) : ""
    const phone = phoneRaw ? formatMetaLeadPhone(phoneRaw) : ""

    let notes = iNotes >= 0 ? trimCell(row, iNotes) : ""
    const birth = trimCell(row, iBirth)
    if (birth) notes = [notes, `Birthday: ${birth}`].filter(Boolean).join("\n")
    const labels = trimCell(row, iLabels)
    if (labels) notes = [notes, `Labels: ${labels}`].filter(Boolean).join("\n")

    const orgRest = orgVals.slice(1)
    if (orgRest.length) {
      const orgLines = orgRest.map((v, j) => `Organization ${j + 2}: ${v}`).join("\n")
      notes = [notes, orgLines].filter(Boolean).join("\n")
    }

    out.push({
      name,
      company,
      email,
      phone,
      notes,
    })
  }
  return out
}

export function normalizeLeadMatchText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ")
}

/** Keys for matching DB rows to parsed CSV (name/company may be stored either way). */
export function leadPhoneLookupKeys(name: string, company: string): string[] {
  const norm = normalizeLeadMatchText
  const n = norm(name)
  const c = norm(company)
  const keys = new Set<string>()
  if (n || c) keys.add(`${n}|||${c}`)
  if (c || n) keys.add(`${c}|||${n}`)
  return [...keys]
}

export function buildLeadPhoneLookupFromCsv(text: string): Map<string, string> {
  return buildFacebookLeadPhoneLookup(text)
}

/**
 * Phone lookup keyed by FULL_NAME / COMPANY_NAME from Facebook export (matches DB either way).
 */
export function buildFacebookLeadPhoneLookup(csvText: string): Map<string, string> {
  const rows = parseCsv(stripBom(csvText))
  if (rows.length < 2) return new Map()
  const h = rows[0]

  const iFull = colIndex(h, "fullname", "full_name")
  const iPhone = colIndex(h, "phone")
  const iCompany = colIndex(h, "companyname", "company_name", "company")

  if (iFull < 0 || iPhone < 0) {
    const map = new Map<string, string>()
    for (const row of parseLeadImportCsv(csvText)) {
      if (!row.phone?.trim()) continue
      for (const key of leadPhoneLookupKeys(row.name, row.company)) {
        map.set(key, row.phone.trim())
      }
    }
    return map
  }

  const map = new Map<string, string>()
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r]
    const full = trimCell(row, iFull)
    const company = iCompany >= 0 ? trimCell(row, iCompany) : ""
    const phone = formatMetaLeadPhone(trimCell(row, iPhone))
    if (!phone) continue

    const nf = normalizeLeadMatchText(full)
    const nc = normalizeLeadMatchText(company)
    if (nf) map.set(`name:${nf}`, phone)
    if (nc) map.set(`name:${nc}`, phone)
    if (nf && nc) {
      map.set(`pair:${nf}|||${nc}`, phone)
      map.set(`pair:${nc}|||${nf}`, phone)
    }
  }
  return map
}

export function resolvePhoneFromFacebookLookup(
  lookup: Map<string, string>,
  name: string,
  company: string,
): string | undefined {
  const n = normalizeLeadMatchText(name)
  const c = normalizeLeadMatchText(company)
  return (
    (n && c ? lookup.get(`pair:${n}|||${c}`) : undefined) ??
    (n && c ? lookup.get(`pair:${c}|||${n}`) : undefined) ??
    (n ? lookup.get(`name:${n}`) : undefined) ??
    (c ? lookup.get(`name:${c}`) : undefined)
  )
}

function escCsvCell(value: string): string {
  const s = String(value ?? "").replace(/"/g, '""')
  if (/[,"\r\n]/.test(s)) return `"${s}"`
  return s
}

export type LeadsExportMeta = {
  /** Logged-in user (or chosen name) shown at the top of every export file. */
  exportedBy: string
}

/** Build CSV matching import columns plus CRM fields (UTF-8 BOM added on download for Excel). */
export function buildLeadsExportCsv(leads: CrmLeadRow[], meta?: LeadsExportMeta): string {
  const lines: string[] = []
  if (meta?.exportedBy?.trim()) {
    const when = new Date().toLocaleString(undefined, { dateStyle: "long", timeStyle: "short" })
    lines.push(`${escCsvCell("Exported by")},${escCsvCell(meta.exportedBy.trim())}`)
    lines.push(`${escCsvCell("Export time")},${escCsvCell(when)}`)
    lines.push("")
  }
  const headers = [
    "name",
    "company",
    "email",
    "phone",
    "notes",
    "status",
    "contact_logs",
    "last_outreach",
    "imported_at",
    "csv_importer",
    "import_batch_id",
    "created_by",
  ]
  lines.push(headers.join(","))
  for (const l of leads) {
    lines.push(
      [
        escCsvCell(l.name),
        escCsvCell(l.company),
        escCsvCell(l.email),
        escCsvCell(l.phone),
        escCsvCell(l.notes),
        escCsvCell(l.status),
        escCsvCell(String(l.contactCount)),
        escCsvCell(l.lastContactedAt ? new Date(l.lastContactedAt).toISOString() : ""),
        escCsvCell(l.importedAt ? new Date(l.importedAt).toISOString() : ""),
        escCsvCell(l.importUploaderName ?? ""),
        escCsvCell(l.importBatchId ?? ""),
        escCsvCell(l.createdBy),
      ].join(",")
    )
  }
  return lines.join("\r\n")
}

export function downloadLeadsCsv(leads: CrmLeadRow[], filename?: string, meta?: LeadsExportMeta) {
  if (typeof document === "undefined") return
  const csv = buildLeadsExportCsv(leads, meta)
  const name =
    filename ?? `leads-export-${new Date().toISOString().slice(0, 10)}-${Date.now().toString(36).slice(-6)}.csv`
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}
