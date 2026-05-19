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

function parseMetaLeads(text) {
  const rows = parseCsv(text.replace(/^\ufeff/, ""))
  if (rows.length < 2) return []
  const h = rows[0]
  const iFull = colIndex(h, "fullname", "full_name")
  const iPhone = colIndex(h, "phone")
  const iCompany = colIndex(h, "companyname", "company_name", "company")
  const iCity = colIndex(h, "city")
  const iAddress = colIndex(h, "address")
  const iPlatform = colIndex(h, "platform")
  if (iFull < 0 || iPhone < 0 || iCompany < 0) {
    throw new Error("Not a Meta Lead Ads CSV (need FULL_NAME, PHONE, COMPANY_NAME)")
  }

  const out = []
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r]
    const fullName = trimCell(row, iFull)
    const companyName = trimCell(row, iCompany)
    const name = companyName || fullName
    if (!name) continue
    const company =
      companyName && fullName && companyName.toLowerCase() !== fullName.toLowerCase() ? fullName : ""
    const phone = formatMetaLeadPhone(trimCell(row, iPhone))
    const city = trimCell(row, iCity)
    const address = trimCell(row, iAddress)
    const platform = trimCell(row, iPlatform)
    const noteParts = []
    if (city) noteParts.push(`Labels: ${city}`)
    if (address) noteParts.push(`Address: ${address}`)
    if (platform) noteParts.push(`Platform: ${platform}`)
    out.push({ name, company, email: "", phone, notes: noteParts.join("\n") })
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

async function repairPhones(batchId) {
  const dbLeads = await prisma.crmLead.findMany({
    where: { importBatchId: batchId },
    select: { id: true, name: true, company: true, phone: true },
  })
  const lookup = new Map()
  for (const row of leads) {
    if (!row.phone) continue
    const n = row.name.trim().toLowerCase()
    const c = row.company.trim().toLowerCase()
    lookup.set(`${n}|||${c}`, row.phone)
    lookup.set(`${c}|||${n}`, row.phone)
  }
  let updated = 0
  for (const lead of dbLeads) {
    if (lead.phone?.trim()) continue
    const key = `${lead.name.trim().toLowerCase()}|||${lead.company.trim().toLowerCase()}`
    const alt = `${lead.company.trim().toLowerCase()}|||${lead.name.trim().toLowerCase()}`
    const phone = lookup.get(key) ?? lookup.get(alt)
    if (!phone) continue
    await prisma.crmLead.update({ where: { id: lead.id }, data: { phone } })
    updated += 1
  }
  console.log(`Repaired phones on ${updated} of ${dbLeads.length} leads (batch: ${batchId}).`)
}

const repairIdx = process.argv.indexOf("--repair-phones")
if (repairIdx >= 0) {
  const batchId = process.argv[repairIdx + 1] || importBatchId
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
