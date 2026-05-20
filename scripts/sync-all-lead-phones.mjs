/**
 * Backfill empty phone fields on CRM leads from the Facebook installers CSV.
 *
 * Usage (from erpvoltrix app folder):
 *   node scripts/sync-all-lead-phones.mjs
 *   node scripts/sync-all-lead-phones.mjs --batch <importBatchId>
 *   node scripts/sync-all-lead-phones.mjs --dry-run
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

const CSV_FILENAME = "Voltrix installers Leads 19 May 2026.csv"
const csvPath = path.join(root, "public", CSV_FILENAME)

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
    const i = cells.indexOf(normHeader(cand))
    if (i >= 0) return i
  }
  return -1
}

function trimCell(row, i) {
  if (i < 0 || i >= row.length) return ""
  return (row[i] ?? "").trim()
}

function normalizeLeadMatchText(value) {
  return value.trim().toLowerCase().replace(/\s+/g, " ")
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

function buildFacebookLeadPhoneLookup(csvText) {
  const rows = parseCsv(csvText.replace(/^\ufeff/, ""))
  if (rows.length < 2) return new Map()
  const h = rows[0]
  const iFull = colIndex(h, "fullname", "full_name")
  const iPhone = colIndex(h, "phone")
  const iCompany = colIndex(h, "companyname", "company_name", "company")
  if (iFull < 0 || iPhone < 0) {
    console.error("CSV missing FULL_NAME or PHONE columns")
    process.exit(1)
  }

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

const dryRun = process.argv.includes("--dry-run")
const batchIdx = process.argv.indexOf("--batch")
const importBatchId = batchIdx >= 0 ? process.argv[batchIdx + 1] : ""

if (!fs.existsSync(csvPath)) {
  console.error("Missing file:", csvPath)
  process.exit(1)
}

const csvText = fs.readFileSync(csvPath, "utf8")
const lookup = buildFacebookLeadPhoneLookup(csvText)
console.log(`Phone lookup entries: ${lookup.size}`)

if (lookup.size === 0) {
  console.error("No phones parsed from CSV")
  process.exit(1)
}

const prisma = new PrismaClient()

async function main() {
  const where = importBatchId ? { importBatchId } : {}
  const dbLeads = await prisma.crmLead.findMany({
    where,
    select: { id: true, name: true, company: true, phone: true },
  })

  let updated = 0
  let alreadyHad = 0
  let notMatched = 0

  for (const lead of dbLeads) {
    const phone = resolvePhone(lookup, lead.name, lead.company)
    if (!phone) {
      notMatched += 1
      continue
    }
    if (lead.phone?.trim()) {
      alreadyHad += 1
      continue
    }
    if (dryRun) {
      console.log(`Would set ${lead.name} / ${lead.company} -> ${phone}`)
      updated += 1
      continue
    }
    await prisma.crmLead.update({ where: { id: lead.id }, data: { phone } })
    updated += 1
  }

  console.log(
    dryRun ? "[dry-run] " : "",
    `Updated ${updated}, already had phone ${alreadyHad}, not matched ${notMatched}, total ${dbLeads.length}`,
  )
  if (importBatchId) console.log(`Batch filter: ${importBatchId}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
