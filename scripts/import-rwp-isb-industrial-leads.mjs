/**
 * Import RWP + ISB industrial leads from public CSV files.
 * Usage (from erpvoltrix folder): node scripts/import-rwp-isb-industrial-leads.mjs
 * Dry run: node scripts/import-rwp-isb-industrial-leads.mjs --dry-run
 */
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import { createRequire } from "module"

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, "..")

for (const f of [".env.local", ".env"]) {
  const p = path.join(root, f)
  if (!fs.existsSync(p)) continue
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m && !process.env[m[1].trim()]) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "")
  }
}

const { PrismaClient } = require("@prisma/client")

function parseCsvLine(line) {
  const result = []
  let field = ""
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        field += '"'
        i++
      } else inQuotes = !inQuotes
    } else if (!inQuotes && c === ",") {
      result.push(field.trim())
      field = ""
    } else field += c
  }
  result.push(field.trim())
  return result
}

function parseCsv(text) {
  return text
    .split(/\r?\n/)
    .filter((l) => l.trim())
    .map(parseCsvLine)
}

function normHeader(h) {
  return h.toLowerCase().replace(/[\s_-]/g, "").replace(/^\ufeff/g, "").trim()
}

function colIndex(header, ...candidates) {
  const cells = header.map(normHeader)
  for (const cand of candidates) {
    const c = normHeader(cand)
    const i = cells.indexOf(c)
    if (i >= 0) return i
  }
  return -1
}

function trimCell(row, i) {
  if (i < 0 || i >= row.length) return ""
  return (row[i] ?? "").trim()
}

function formatPhone(raw) {
  const p = (raw ?? "").trim()
  if (!p) return ""
  return p
}

function deriveIsbName(company, contactAddress) {
  const c = company.trim()
  if (c) return c
  const ca = contactAddress.trim()
  if (!ca) return "Islamabad Industrial Lead"
  const comma = ca.indexOf(",")
  if (comma > 0 && comma <= 120) return ca.slice(0, comma).trim()
  return ca.length > 120 ? `${ca.slice(0, 117)}...` : ca
}

function parseRwpLeads(text) {
  const rows = parseCsv(text.replace(/^\ufeff/, ""))
  if (rows.length < 2) return []
  const h = rows[0]
  const iCompany = colIndex(h, "company_name", "company")
  const iIndustry = colIndex(h, "industry_type", "industry")
  const iAddress = colIndex(h, "address")
  const iPhone = colIndex(h, "phone")
  const iCity = colIndex(h, "city")
  const iPriority = colIndex(h, "solar_priority", "priority")

  const out = []
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r]
    const company = trimCell(row, iCompany)
    if (!company) continue
    const industry = trimCell(row, iIndustry)
    const priority = trimCell(row, iPriority)
    const notes = [
      industry ? `Industry: ${industry}` : "",
      priority ? `Solar priority: ${priority}` : "",
      "Region: Rawalpindi (RWP)",
    ]
      .filter(Boolean)
      .join("\n")

    out.push({
      name: company,
      company,
      city: trimCell(row, iCity) || "Rawalpindi",
      address: trimCell(row, iAddress),
      phone: formatPhone(trimCell(row, iPhone)),
      notes,
      isFavorite: priority.toLowerCase() === "high",
    })
  }
  return out
}

function parseIsbLeads(text) {
  const rows = parseCsv(text.replace(/^\ufeff/, ""))
  if (rows.length < 2) return []
  const h = rows[0]
  const iCompany = colIndex(h, "company_name", "company")
  const iContact = colIndex(h, "contact_and_address", "contactaddress", "address")
  const iPhone = colIndex(h, "phone")
  const iCity = colIndex(h, "city")
  const iPriority = colIndex(h, "solar_priority", "priority")

  const out = []
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r]
    const company = trimCell(row, iCompany)
    const contactAddress = trimCell(row, iContact)
    const name = deriveIsbName(company, contactAddress)
    if (!name && !contactAddress) continue

    const priority = trimCell(row, iPriority)
    const notes = [
      priority ? `Solar priority: ${priority}` : "",
      "Region: Islamabad (ISB)",
    ]
      .filter(Boolean)
      .join("\n")

    out.push({
      name,
      company,
      city: trimCell(row, iCity) || "Islamabad",
      address: contactAddress,
      phone: formatPhone(trimCell(row, iPhone)),
      notes,
      isFavorite: priority.toLowerCase() === "high",
    })
  }
  return out
}

const rwpPath = path.join(root, "public", "leads-rwp-industrial.csv")
const isbPath = path.join(root, "public", "leads-isb-industrial.csv")

for (const p of [rwpPath, isbPath]) {
  if (!fs.existsSync(p)) {
    console.error("Missing file:", p)
    process.exit(1)
  }
}

const rwpLeads = parseRwpLeads(fs.readFileSync(rwpPath, "utf8"))
const isbLeads = parseIsbLeads(fs.readFileSync(isbPath, "utf8"))
const leads = [...rwpLeads, ...isbLeads]

if (leads.length === 0) {
  console.error("No leads parsed from CSV files")
  process.exit(1)
}

const importBatchId = process.env.IMPORT_BATCH_ID || "rwp-isb-industrial-2026-08-11"
const importUploaderName = process.env.IMPORTER_NAME || "RWP/ISB Industrial Data Aug 2026"
const createdBy = process.env.CREATED_BY || "CSV import"

if (process.argv.includes("--dry-run")) {
  console.log(`Parsed ${rwpLeads.length} RWP + ${isbLeads.length} ISB = ${leads.length} leads (dry run).`)
  console.log("Favorites (High priority):", leads.filter((l) => l.isFavorite).length)
  console.log("First RWP:", JSON.stringify(rwpLeads[0], null, 2))
  console.log("First ISB:", JSON.stringify(isbLeads[0], null, 2))
  process.exit(0)
}

const prisma = new PrismaClient()

async function main() {
  const existing = await prisma.crmLead.count({ where: { importBatchId } })
  if (existing > 0) {
    console.log(`Batch "${importBatchId}" already has ${existing} lead(s). Skipping duplicate import.`)
    console.log("Delete that batch in CRM first, or set a new IMPORT_BATCH_ID env var.")
    return
  }

  const result = await prisma.crmLead.createMany({
    data: leads.map((l) => ({
      name: l.name,
      company: l.company,
      city: l.city,
      address: l.address,
      email: "",
      phone: l.phone,
      notes: l.notes,
      source: "csv",
      createdBy,
      importBatchId,
      importUploaderName,
      isFavorite: false,
    })),
  })

  console.log(`Imported ${result.count} industrial leads (${rwpLeads.length} RWP + ${isbLeads.length} ISB).`)
  console.log(`Batch: ${importBatchId}`)
  console.log(`Importer label: ${importUploaderName}`)
  console.log("These appear under CRM → Leads → Local data (not Favorites).")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
