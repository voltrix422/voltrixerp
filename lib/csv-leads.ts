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
  return h.toLowerCase().replace(/[\s_-]/g, "")
}

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
    const i = cells.findIndex((n) => n.includes(c))
    if (i >= 0) return i
  }
  return -1
}

/** Parse uploaded CSV into lead rows. First row must be headers; **name** column required. */
export function parseLeadImportCsv(text: string): LeadCsvRow[] {
  const rows = parseCsv(text)
  if (rows.length < 2) return []
  const h = rows[0]
  const iName = colIndex(h, "name", "fullname", "leadname")
  if (iName < 0) return []
  const iCompany = colIndex(h, "company", "business", "organization", "organisation")
  const iEmail = colIndex(h, "email", "e-mail")
  const iPhone = colIndex(h, "phone", "mobile", "tel", "telephone")
  const iNotes = colIndex(h, "notes", "remarks", "comments", "description")
  const out: LeadCsvRow[] = []
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r]
    const name = (row[iName] || "").trim()
    if (!name) continue
    out.push({
      name,
      company: iCompany >= 0 ? (row[iCompany] || "").trim() : "",
      email: iEmail >= 0 ? (row[iEmail] || "").trim() : "",
      phone: iPhone >= 0 ? (row[iPhone] || "").trim() : "",
      notes: iNotes >= 0 ? (row[iNotes] || "").trim() : "",
    })
  }
  return out
}
