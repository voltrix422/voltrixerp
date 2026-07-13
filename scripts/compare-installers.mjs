import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")
const ERP_CSV = path.join(ROOT, "public", "Voltrix installers Leads 19 May 2026.csv")
const AGENT_TOOLS = "C:\\Users\\HP\\.cursor\\projects\\c-Users-HP-Desktop-erpvoltrix\\agent-tools"
const C3_TXT = path.join(AGENT_TOOLS, "b15bfb07-7948-4a17-96f5-b3af02e3b43a.txt")
const C1_TXT = path.join(AGENT_TOOLS, "6f3ad720-1cc7-4687-b9aa-9ca758081ebe.txt")

function parseCSVLine(line) {
  const result = []
  let cur = ""
  let inQ = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') {
      inQ = !inQ
      continue
    }
    if (c === "," && !inQ) {
      result.push(cur)
      cur = ""
      continue
    }
    cur += c
  }
  result.push(cur)
  return result
}

function normalize(name) {
  return name
    .toLowerCase()
    .replace(/\(private\)|\(pvt\)|\(smc[^)]*\)|\(smc-private\)|limited|ltd\.?|co\.?|company|international|engineering|services|solutions|energy|solar|enterprises|traders|&|and/gi, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function tokenSet(name) {
  const n = normalize(name)
  return new Set(n.split(" ").filter((t) => t.length > 2))
}

function isMatch(erpName, officialName) {
  const a = normalize(erpName)
  const b = normalize(officialName)
  if (!a || !b) return false
  if (a.includes(b) || b.includes(a)) return true
  const ta = tokenSet(erpName)
  const tb = tokenSet(officialName)
  if (ta.size === 0 || tb.size === 0) return false
  let overlap = 0
  for (const t of ta) if (tb.has(t)) overlap++
  return overlap / Math.min(ta.size, tb.size) >= 0.6
}

function loadErpCompanies() {
  const csv = fs.readFileSync(ERP_CSV, "utf8")
  const lines = csv.split(/\r?\n/).slice(1).filter(Boolean)
  const companies = []
  for (const line of lines) {
    const cols = parseCSVLine(line)
    const company = (cols[14] || "").trim()
    const city = (cols[15] || "").trim()
    const phone = (cols[13] || "").replace(/^p:/i, "").trim()
    const contact = (cols[12] || "").trim()
    if (company) companies.push({ company, city, phone, contact })
  }
  return companies
}

function cleanCompanyName(name) {
  return name
    .replace(/^\d+\.\s*/, "")
    .replace(/\s+CR\/.*$/, "")
    .replace(/^ICT,?\s*(Punjab|Sindh|KPK|Balochistan|&).*$/i, "")
    .trim()
}

const JUNK = new Set([
  "brothers", "construction", "constructions", "builders", "engineering", "engineers",
  "energy", "energy solutions", "solutions", "services", "enterprises", "company",
  "diwan", "grand trunk", "delta energy", "dynamic green", "elahi energy",
])

function isValidCompany(name) {
  const n = cleanCompanyName(name)
  if (n.length < 5 || n.length > 100) return false
  if (/^(Cell|Tel|Email|Fax|ICT|Punjab|Sindh|KPK|Balochistan|Solar|Wind|\d)/i.test(n)) return false
  if (/ICT\s*&/i.test(n)) return false
  if (/\(SMC-$|\sand$/.test(n) && !/Limited|LLP/i.test(n)) return false
  if (JUNK.has(n.toLowerCase())) return false
  const words = n.split(/\s+/).filter(Boolean)
  if (words.length < 2 && !/Limited|LLP|Co\.|Corporation/i.test(n)) return false
  return true
}

/** Lines immediately before CR/xx/xxx/C-3 are company names in PPIB C-3 PDF text */
function extractPpibCompanies(text) {
  const companies = []
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)

  for (let i = 0; i < lines.length; i++) {
    const next = lines[i + 1] || ""
    if (/^CR\/\d+\/\d+\/C-[123]/.test(next)) {
      let name = lines[i]
        .replace(/^\d+\.\s*/, "")
        .replace(/\s+CR\/.*$/, "")
        .trim()
      if (name.length >= 3 && name.length <= 120 && isValidCompany(name)) {
        companies.push(cleanCompanyName(name))
      }
    }
  }

  // C-1 dense text: "Company Name CR/..."
  const inline = text.matchAll(/([A-Z][A-Za-z0-9 &.'()-]{4,90}?)\s+CR\/\d+\/\d+\/C-1/g)
  for (const m of inline) {
    const name = cleanCompanyName(m[1].trim().replace(/\d+\.\s*$/, ""))
    if (name.length >= 5 && isValidCompany(name)) companies.push(name)
  }

  return [...new Set(companies)].sort((a, b) => a.localeCompare(b))
}

function findNotInErp(officialList, erpCompanies) {
  return officialList.filter((official) => !erpCompanies.some((e) => isMatch(e.company, official)))
}

const erp = loadErpCompanies()
const erpUnique = [...new Set(erp.map((e) => e.company))]

let allOfficial = []
if (fs.existsSync(C3_TXT)) allOfficial.push(...extractPpibCompanies(fs.readFileSync(C3_TXT, "utf8")))
if (fs.existsSync(C1_TXT)) allOfficial.push(...extractPpibCompanies(fs.readFileSync(C1_TXT, "utf8")))
allOfficial = [...new Set(allOfficial)].sort((a, b) => a.localeCompare(b))

const notInErp = findNotInErp(allOfficial, erp)
const inErp = allOfficial.filter((o) => !notInErp.includes(o))

const outPath = path.join(ROOT, "scripts", "installers-not-in-erp.json")
fs.writeFileSync(
  outPath,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      source: "PPIB certified installers C-1 & C-3 (Pakistan nationwide)",
      erpSource: "Voltrix installers Leads 19 May 2026.csv",
      erpLeadCount: erp.length,
      erpUniqueCompanies: erpUnique.length,
      officialCertifiedCount: allOfficial.length,
      matchedInErp: inErp.length,
      notInErpCount: notInErp.length,
      notInErp,
      erpCompanies: erpUnique.sort(),
      matchedExamples: inErp.slice(0, 30),
    },
    null,
    2
  )
)

console.log(`ERP leads: ${erp.length} | ERP unique companies: ${erpUnique.length}`)
console.log(`PPIB certified extracted: ${allOfficial.length}`)
console.log(`Already in ERP (fuzzy match): ${inErp.length}`)
console.log(`NOT in ERP: ${notInErp.length}`)
console.log(`\nSaved full list to: ${outPath}`)
console.log(`\n--- First 80 NOT in ERP ---\n`)
notInErp.slice(0, 80).forEach((n, i) => console.log(`${i + 1}. ${n}`))
