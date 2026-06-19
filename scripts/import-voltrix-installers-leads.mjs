/**
 * One-time import: public/Voltrix installers Leads 19 May 2026.csv
 * Usage (from erpvoltrix folder): node scripts/import-voltrix-installers-leads.mjs
 * Optional: IMPORTER_NAME="installers may 2026" node scripts/import-voltrix-installers-leads.mjs
 */
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import { createRequire } from "module"

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, "..")

// Load .env for DATABASE_URL
for (const f of [".env.local", ".env"]) {
  const p = path.join(root, f)
  if (!fs.existsSync(p)) continue
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m && !process.env[m[1].trim()]) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "")
  }
}

const { PrismaClient } = require("@prisma/client")

// Dynamic import of compiled TS is awkward; inline minimal parser hooks via tsx alternative:
// Run with: npx tsx scripts/import-voltrix-installers-leads.ts if this fails.

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

function formatMetaLeadPhone(raw) {
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
  return p
}

function buildCsvExtraNotes(row, h, skipIndices) {
  const skip = new Set(skipIndices.filter((i) => i >= 0))
  const parts = []
  for (let i = 0; i < h.length; i++) {
    if (skip.has(i)) continue
    const label = (h[i] ?? "").trim()
    if (!label) continue
    const val = trimCell(row, i)
    if (!val) continue
    parts.push(`${label}: ${val}`)
  }
  return parts.join("\n")
}

function parseMetaLeads(text) {
  const rows = parseCsv(text.replace(/^\ufeff/, ""))
  if (rows.length < 2) return []
  const h = rows[0]
  const iFull = colIndex(h, "fullname", "full_name")
  const iPhone = colIndex(h, "phone")
  const iCompany = colIndex(h, "companyname", "company_name", "company")
  const iCity = colIndex(h, "city")
  const iAddress = colIndex(h, "address")
  if (iFull < 0 || iPhone < 0 || iCompany < 0) {
    throw new Error("Not a Meta Lead Ads CSV (need FULL_NAME, PHONE, COMPANY_NAME)")
  }

  const out = []
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r]
    const fullName = trimCell(row, iFull)
    const companyName = trimCell(row, iCompany)
    const name = fullName || companyName
    if (!name) continue
    const phone = formatMetaLeadPhone(trimCell(row, iPhone))
    const city = trimCell(row, iCity)
    const address = trimCell(row, iAddress)
    const notes = buildCsvExtraNotes(row, h, [iFull, iPhone, iCompany, iCity, iAddress])
    out.push({ name, company: companyName, city, address, email: "", phone, notes })
  }
  return out
}

const csvPath = path.join(root, "public", "Voltrix installers Leads 19 May 2026.csv") // keep in sync with lib/voltrix-installers-leads-csv.ts
if (!fs.existsSync(csvPath)) {
  console.error("Missing file:", csvPath)
  process.exit(1)
}

const leads = parseMetaLeads(fs.readFileSync(csvPath, "utf8"))
if (leads.length === 0) {
  console.error("No leads parsed from CSV")
  process.exit(1)
}

const importBatchId = `voltrix-installers-2026-05-19`
const importUploaderName = process.env.IMPORTER_NAME || "Voltrix installers May 2026"
const createdBy = process.env.CREATED_BY || "CSV import"

if (process.argv.includes("--dry-run")) {
  console.log(`Parsed ${leads.length} leads (dry run, no database).`)
  console.log("First row:", JSON.stringify(leads[0], null, 2))
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
      email: l.email,
      phone: l.phone,
      notes: l.notes,
      source: "csv",
      createdBy,
      importBatchId,
      importUploaderName,
    })),
  })

  console.log(`Imported ${result.count} installer leads.`)
  console.log(`Batch: ${importBatchId}`)
  console.log(`Importer label: ${importUploaderName}`)
}

function normalizeLeadMatchText(value) {
  return value.trim().toLowerCase().replace(/\s+/g, " ")
}

function buildLookupFromCsv(text) {
  const rows = parseCsv(text.replace(/^\ufeff/, ""))
  const h = rows[0]
  const iFull = colIndex(h, "fullname", "full_name")
  const iPhone = colIndex(h, "phone")
  const iCompany = colIndex(h, "companyname", "company_name", "company")
  const map = new Map()
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

function resolvePhone(lookup, name, company) {
  const n = normalizeLeadMatchText(name)
  const c = normalizeLeadMatchText(company)
  return (
    (n && c ? lookup.get(`pair:${n}|||${c}`) : undefined) ??
    (n && c ? lookup.get(`pair:${c}|||${n}`) : undefined) ??
    (n ? lookup.get(`name:${n}`) : undefined) ??
    (c ? lookup.get(`name:${c}`) : undefined)
  )
}

async function repairPhones(batchId) {
  const where = batchId ? { importBatchId: batchId } : {}
  const dbLeads = await prisma.crmLead.findMany({
    where,
    select: { id: true, name: true, company: true, phone: true },
  })
  const lookup = buildLookupFromCsv(fs.readFileSync(csvPath, "utf8"))
  let updated = 0
  let notMatched = 0
  for (const lead of dbLeads) {
    if (lead.phone?.trim()) continue
    const phone = resolvePhone(lookup, lead.name, lead.company)
    if (!phone) {
      notMatched += 1
      continue
    }
    await prisma.crmLead.update({ where: { id: lead.id }, data: { phone } })
    updated += 1
  }
  console.log(
    `Repaired phones on ${updated} of ${dbLeads.length} leads (${notMatched} not matched).` +
      (batchId ? ` Batch: ${batchId}` : " All leads."),
  )
}

const repairIdx = process.argv.indexOf("--repair-phones")
if (repairIdx >= 0) {
  const next = process.argv[repairIdx + 1]
  const batchId = next && !next.startsWith("--") ? next : ""
  repairPhones(batchId)
    .catch((e) => {
      console.error(e)
      process.exit(1)
    })
    .finally(() => prisma.$disconnect())
} else {
  main()
    .catch((e) => {
      console.error(e)
      process.exit(1)
    })
    .finally(() => prisma.$disconnect())
}
