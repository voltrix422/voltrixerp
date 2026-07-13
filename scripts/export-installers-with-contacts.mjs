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
  for (const c of line) {
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

function isMatch(a, b) {
  const na = normalize(a)
  const nb = normalize(b)
  if (!na || !nb) return false
  if (na.includes(nb) || nb.includes(na)) return true
  const ta = new Set(na.split(" ").filter((t) => t.length > 2))
  const tb = new Set(nb.split(" ").filter((t) => t.length > 2))
  if (!ta.size || !tb.size) return false
  let overlap = 0
  for (const t of ta) if (tb.has(t)) overlap++
  return overlap / Math.min(ta.size, tb.size) >= 0.6
}

function loadErpCompanies() {
  const csv = fs.readFileSync(ERP_CSV, "utf8")
  return csv
    .split(/\r?\n/)
    .slice(1)
    .filter(Boolean)
    .map((line) => (parseCSVLine(line)[14] || "").trim())
    .filter(Boolean)
}

function isSkipLine(line) {
  const t = line.trim()
  if (!t) return true
  if (/^\d+\.?$/.test(t)) return true
  if (/^CR\//.test(t)) return true
  if (/^\d{2}-\d{2}-\d{4}/.test(t)) return true
  if (/^(Solar|Wind)(?:\s*&\s*(?:Solar|Wind))?$/i.test(t)) return true
  if (/^ICT,?\s/i.test(t)) return true
  if (/^(Punjab|Sindh|KPK|Balochistan)\b/i.test(t) && !/[A-Z]{2,}/.test(t.replace(/ICT|Punjab|Sindh|KPK|Balochistan/gi, ""))) return true
  if (/^(Tel:|Cell:|Email:|Fax:|UAN:|Office No|House No|Plot No|Shop No|Suite|Flat |Ground Floor|Mezzanine|Basement|Street No|Sector |Commercial|Floor,|nd Floor|st Floor|th Floor)/i.test(t)) return true
  if (/^\|/.test(t)) return true
  if (/Certificate|Validity|Technology|Category|Regulations|Company Name|Registered Address|Contact Details/i.test(t)) return true
  return false
}

function isNamePartLine(line) {
  const t = line.trim().replace(/^\d+\.\s*/, "")
  if (!t || t.length > 80) return false
  if (isSkipLine(t)) return false
  if (/^[\d\s./,-]+$/.test(t)) return false
  if (/Tel:|Cell:|Email:|@/.test(t)) return false
  return true
}

/** Build official company name from lines immediately before certificate */
function extractOfficialName(lines, certLineIdx) {
  const inline = lines[certLineIdx].trim()
  const inlineMatch = inline.match(/(?:\|\s*)?(?:\d+\.\s*)?(.+?)\s+CR\/\d+\/\d+\/C-[123]/i)
  if (inlineMatch?.[1]?.trim()) {
    const n = inlineMatch[1].trim()
    if (n.length >= 3 && !/^\d{2}-\d{2}-\d{4}/.test(n)) return n
  }

  const parts = []
  for (let i = certLineIdx - 1; i >= Math.max(0, certLineIdx - 8); i--) {
    const raw = lines[i].trim()
    if (!raw) {
      if (parts.length) break
      continue
    }
    if (/^CR\//.test(raw)) break
    if (/^\d+\.\s*$/.test(raw)) continue
    if (isSkipLine(raw)) {
      if (parts.length) break
      continue
    }
    if (!isNamePartLine(raw)) {
      if (parts.length) break
      continue
    }
    parts.unshift(raw.replace(/^\d+\.\s*/, ""))
  }

  const name = parts.join(" ").replace(/\s+/g, " ").trim()
  const cleaned = name.replace(/^\|+\s*/, "").replace(/^\d+\.\s*/, "").trim()
  return cleaned.length >= 3 ? cleaned : null
}

function isGoodOfficialName(name) {
  if (!name || name.length < 4 || name.length > 120) return false
  if (/^\(SMC/i.test(name) && name.length < 22) return false
  if (/^(Energy|Solutions|Engineering)\s*\(Private\)/i.test(name)) return false
  if (/^\d+\.\s/.test(name)) return false
  if (!/^[A-Za-z0-9(]/.test(name)) return false
  if (/^(Private|Limited|SMC|SMC-Private)$/i.test(name)) return false
  return true
}

function parseContactFields(text) {
  const mobile = [...text.matchAll(/\bCell:\s*([^|\n]+?)(?=\s*(?:Tel:|Fax:|Email:|UAN:|CR\/|\n\d+\.|$))/gi)]
    .map((m) => m[1].trim().replace(/\s+/g, " "))
    .filter((s) => s.length > 6 && !/Email/i.test(s))
  const telephone = [...text.matchAll(/\bTel:\s*([^|\n]+?)(?=\s*(?:Cell:|Fax:|Email:|UAN:|CR\/|$))/gi)]
    .map((m) => m[1].trim().replace(/\s+/g, " "))
    .filter((s) => s.length > 6)
  const fax = [...text.matchAll(/\bFax:\s*([^|\n]+?)(?=\s*(?:Cell:|Tel:|Email:|UAN:|CR\/|$))/gi)].map((m) =>
    m[1].trim().replace(/\s+/g, " ")
  )
  const uan = [...text.matchAll(/\bUAN:\s*([^|\n]+?)(?=\s*(?:Cell:|Tel:|Fax:|Email:|CR\/|$))/gi)].map((m) =>
    m[1].trim().replace(/\s+/g, " ")
  )
  const emails = [...text.matchAll(/\bEmail:\s*([^|\n]+)/gi)].flatMap((m) =>
    m[1]
      .split(/\s+/)
      .map((e) => e.replace(/[,;]$/, "").trim())
      .filter((e) => e.includes("@") && !e.includes("[Link]"))
  )
  const phones = [...new Set([...mobile, ...telephone, ...uan])].filter(Boolean)
  return {
    mobile: mobile.join("; ") || null,
    telephone: telephone.join("; ") || null,
    fax: fax.join("; ") || null,
    uan: uan.join("; ") || null,
    email: [...new Set(emails)].join("; ") || null,
    primaryPhone: phones[0] || null,
  }
}

function parseAreas(block) {
  const m = block.match(/\n(ICT[^|\n]{5,120})\n/i)
  return m ? m[1].replace(/\s+/g, " ").trim() : null
}

function parseAddress(block) {
  const lines = block.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const parts = []
  for (const line of lines) {
    if (isSkipLine(line)) continue
    if (line.length < 12 || line.length > 130) continue
    if (/Limited|Private|Brothers|Solutions|Energy|Engineering|International|Corporation|Company|Traders|Enterprises|LLP/i.test(line) && !/Road|Town|Block|Floor|Plot|Office|House|Shop|Sector|Market|Colony|Phase|Karachi|Lahore|Islamabad/i.test(line)) continue
    if (/Road|Town|Block|Floor|Plot|Office|House|Shop|Sector|Market|Colony|Phase|Karachi|Lahore|Islamabad|Rawalpindi|Peshawar|Multan|Faisalabad|Hyderabad|Quetta|Sukkur|DHA|Cantt|Boulevard|Bazaar|Area|Industrial|Society|Ground|Basement|Mezzanine/i.test(line)) {
      parts.push(line.replace(/\|.*$/g, ""))
    }
    if (parts.join(" ").length > 220) break
  }
  const addr = parts.slice(0, 4).join(", ").replace(/\s+/g, " ").trim()
  return addr || null
}

function parseC3Records(text) {
  const records = []
  const lines = text.split(/\r?\n/)
  const certIndices = []
  for (let i = 0; i < lines.length; i++) {
    if (/CR\/\d+\/\d+\/C-3/.test(lines[i])) certIndices.push(i)
  }

  for (let c = 0; c < certIndices.length; c++) {
    const ci = certIndices[c]
    const nextCi = certIndices[c + 1] ?? lines.length
    const block = lines.slice(Math.max(0, ci - 12), nextCi).join("\n")
    const after = lines.slice(ci, Math.min(nextCi, ci + 25)).join("\n")

    const companyName = extractOfficialName(lines, ci)
    if (!companyName || !isGoodOfficialName(companyName)) continue

    const certMatch = lines[ci].match(/CR\/\d+\/\d+\/C-3[^(\s]*(?:\([^)]*\))?/)
    const cert = certMatch?.[0] || lines[ci].trim().split(/\s+/)[0]
    const contacts = parseContactFields(block)
    if (!contacts.primaryPhone && !contacts.email) continue

    const areas = parseAreas(after)
    const address = parseAddress(after)
    const validityMatch = (lines[ci] + after).match(/(\d{2}-\d{2}-\d{4})\s+(Solar(?:\s*&\s*Wind)?|Wind(?:\s*&\s*Solar)?)/i)

    records.push({
      companyName,
      certificateNo: cert,
      category: "C-3",
      validityDate: validityMatch?.[1] || null,
      technology: validityMatch?.[2] || "Solar",
      areas,
      address,
      ...contacts,
      source: "PPIB C-3 (upto 250 kW)",
    })
  }
  return records
}

function parseC1Records(text) {
  const records = []
  const re =
    /(\d+\.\s*)?([A-Z][A-Za-z0-9&.'()/-]{2,70}(?:\s+[A-Za-z0-9&.'()/-]{2,40}){0,8}(?:\(Private\)\s*Limited|\(SMC-Private\)\s*Limited|\(SMC Private\)\s*Limited|\(Private\)\s*Limited|\(SMC-Private\)|\(Private\)|Limited|LLP|Co\.|Brothers|Sons|International|Corporation|Company|Energies|Energy))\s+CR\/(\d+\/\d+\/C-1[^)\s]*(?:\([^)]*\))?)/g

  const matches = [...text.matchAll(re)]
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i]
    const companyName = m[2].replace(/\s+/g, " ").trim()
    if (!isGoodOfficialName(companyName)) continue

    const start = m.index
    const end = i + 1 < matches.length ? matches[i + 1].index : Math.min(text.length, start + 900)
    const chunk = text.slice(start, end)
    const contacts = parseContactFields(chunk)
    if (!contacts.primaryPhone && !contacts.email) continue

    records.push({
      companyName,
      certificateNo: `CR/${m[3]}`,
      category: "C-1",
      validityDate: chunk.match(/(\d{2}-\d{2}-\d{4})\s+Solar/i)?.[1] || null,
      technology: "Solar",
      areas: chunk.match(/ICT[^A-Z]{0,120}(?:Balochistan|Punjab|Sindh|KPK)/i)?.[0]?.trim() || null,
      address: chunk.match(/(?:Office No\.|House No\.|Plot No\.|Shop No\.|Suite|Flat)[^.]{10,120}\./i)?.[0]?.trim() || null,
      ...contacts,
      source: "PPIB C-1 (500 kW+)",
    })
  }
  return records
}

function dedupeByCert(records) {
  const byCert = new Map()
  for (const r of records) {
    const key = r.certificateNo.replace(/\s+/g, "")
    const existing = byCert.get(key)
    if (!existing) {
      byCert.set(key, r)
      continue
    }
    const score = (x) =>
      x.companyName.length +
      (/\(Private\)|Limited|LLP|Corporation/i.test(x.companyName) ? 20 : 0) +
      (x.primaryPhone ? 5 : 0) +
      (x.email ? 3 : 0)
    if (score(r) > score(existing)) byCert.set(key, r)
  }
  return [...byCert.values()]
}

function cityFromRecord(r) {
  const hay = `${r.address || ""} ${r.areas || ""}`
  const cities = [
    "Lahore", "Karachi", "Islamabad", "Rawalpindi", "Peshawar", "Multan", "Faisalabad",
    "Hyderabad", "Quetta", "Sukkur", "Sialkot", "Gujranwala", "Bahawalpur", "Abbottabad",
    "Mardan", "Dera Ismail Khan", "Nawabshah", "Larkana", "Dadu", "Layyah", "Vehari",
  ]
  for (const c of cities) {
    if (new RegExp(c, "i").test(hay)) return c
  }
  const prov = hay.match(/Punjab|Sindh|KPK|Balochistan|ICT/i)
  return prov ? prov[0] : null
}

function escapeCsv(v) {
  const s = String(v ?? "")
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

const erp = loadErpCompanies()
let allRecords = []
if (fs.existsSync(C3_TXT)) allRecords.push(...parseC3Records(fs.readFileSync(C3_TXT, "utf8")))
if (fs.existsSync(C1_TXT)) allRecords.push(...parseC1Records(fs.readFileSync(C1_TXT, "utf8")))
allRecords = dedupeByCert(allRecords)

const notInErp = allRecords
  .filter((r) => !erp.some((e) => isMatch(e, r.companyName)))
  .map((r) => ({ ...r, city: cityFromRecord(r) }))
  .sort((a, b) => a.companyName.localeCompare(b.companyName))

const jsonPath = path.join(ROOT, "scripts", "installers-not-in-erp-with-contacts.json")
const csvPath = path.join(ROOT, "scripts", "installers-not-in-erp-with-contacts.csv")

fs.writeFileSync(
  jsonPath,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      source: "PPIB certified installers — official registered names",
      note: "Company names exactly as registered on PPIB/AEDB certificate. Not in Voltrix ERP.",
      notInErpCount: notInErp.length,
      installers: notInErp,
    },
    null,
    2
  )
)

const headers = [
  "companyName",
  "primaryPhone",
  "mobile",
  "telephone",
  "email",
  "city",
  "address",
  "areas",
  "category",
  "certificateNo",
  "validityDate",
  "technology",
  "source",
]
fs.writeFileSync(
  csvPath,
  [headers.join(","), ...notInErp.map((r) => headers.map((h) => escapeCsv(r[h])).join(","))].join("\n"),
  "utf8"
)

// Also update simple name list JSON
fs.writeFileSync(
  path.join(ROOT, "scripts", "installers-not-in-erp.json"),
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      notInErpCount: notInErp.length,
      notInErp: notInErp.map((r) => ({
        companyName: r.companyName,
        phone: r.primaryPhone,
        email: r.email,
        city: r.city,
        address: r.address,
        certificateNo: r.certificateNo,
      })),
    },
    null,
    2
  )
)

console.log(`Official PPIB installers NOT in ERP: ${notInErp.length}`)
console.log(`CSV: ${csvPath}`)
notInErp.slice(0, 25).forEach((r, i) => {
  console.log(`${i + 1}. ${r.companyName} | ${r.primaryPhone} | ${r.email || "—"}`)
})
