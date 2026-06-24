/** Parse OCR text from a Pakistani electricity bill photo. */

export type ParsedElectricityBill = {
  monthlyUnits: number | null
  billAmountPkr: number | null
  tariffPerUnit: number | null
  billingMonth: string | null
  consumerName: string | null
  city: string | null
  confidence: "high" | "medium" | "low"
  rawSnippets: string[]
}

const DISCO_CITY_MAP: Record<string, string> = {
  LESCO: "Lahore",
  IESCO: "Islamabad",
  MEPCO: "Multan",
  FESCO: "Faisalabad",
  PESCO: "Peshawar",
  GEPCO: "Gujranwala",
  HESCO: "Hyderabad",
  QESCO: "Quetta",
  SEPCO: "Sukkur",
  "K-ELECTRIC": "Karachi",
  KELECTRIC: "Karachi",
}

const CITY_NAMES = [
  "Lahore",
  "Islamabad",
  "Rawalpindi",
  "Karachi",
  "Peshawar",
  "Multan",
  "Faisalabad",
  "Quetta",
  "Gujranwala",
  "Hyderabad",
  "Sialkot",
  "Sargodha",
]

const MIN_TARIFF = 8
const MAX_TARIFF = 65

function parseNumber(raw: string): number | null {
  const cleaned = raw.replace(/,/g, "").replace(/\s/g, "")
  const n = Number(cleaned)
  return Number.isFinite(n) && n > 0 ? n : null
}

function normalizeText(raw: string): string {
  return raw.replace(/\r/g, "\n").replace(/[ \t]+/g, " ")
}

function numbersOnLine(line: string): number[] {
  return (line.match(/\d[\d,]*\.?\d*/g) || [])
    .map((m) => parseNumber(m))
    .filter((n): n is number => n !== null)
}

function impliedTariff(units: number, bill: number): number | null {
  if (!units || !bill) return null
  return bill / units
}

function tariffLooksValid(tariff: number | null): boolean {
  return tariff !== null && tariff >= MIN_TARIFF && tariff <= MAX_TARIFF
}

function unitsLookPlausible(units: number, bill: number | null): boolean {
  if (units < 10 || units > 50_000) return false
  if (!bill) return units <= 10_000
  return tariffLooksValid(impliedTariff(units, bill))
}

function scoreUnitsCandidate(units: number, bill: number | null, source: string): number {
  let score = 0
  if (units >= 30 && units <= 8_000) score += 8
  if (units >= 50 && units <= 3_000) score += 6

  const tariff = bill ? impliedTariff(units, bill) : null
  if (tariffLooksValid(tariff)) score += 25
  else if (tariff !== null && tariff < MIN_TARIFF) score -= 30

  if (source.includes("consumed")) score += 20
  if (source.includes("peak-sum")) score += 15
  if (source.includes("peak-offpeak-line")) score += 12
  if (source.includes("labeled")) score += 10
  if (source.includes("inferred")) score += 5
  if (source.includes("fallback")) score -= 20

  return score
}

function pickBestUnits(
  candidates: { value: number; source: string }[],
  bill: number | null,
): { value: number; source: string } | null {
  const unique = new Map<number, { value: number; source: string; score: number }>()
  for (const c of candidates) {
    if (!unitsLookPlausible(c.value, bill) && bill) continue
    const score = scoreUnitsCandidate(c.value, bill, c.source)
    const prev = unique.get(c.value)
    if (!prev || score > prev.score) {
      unique.set(c.value, { ...c, score })
    }
  }

  const ranked = [...unique.values()].sort((a, b) => b.score - a.score)
  return ranked[0] ?? null
}

function extractUnitsCandidates(text: string, lines: string[]): { value: number; source: string }[] {
  const candidates: { value: number; source: string }[] = []

  const consumedPatterns = [
    /units\s*consumed[^\d]{0,24}(\d[\d,]*)/i,
    /consumed\s*units?[^\d]{0,24}(\d[\d,]*)/i,
    /total\s*units?[^\d]{0,24}(\d[\d,]*)/i,
    /energy\s*kwh[^\d]{0,24}(\d[\d,]*)/i,
    /kwh\s*consumed[^\d]{0,24}(\d[\d,]*)/i,
  ]
  for (const pattern of consumedPatterns) {
    const match = text.match(pattern)
    if (match?.[1]) {
      const val = parseNumber(match[1])
      if (val) candidates.push({ value: val, source: "units-consumed" })
    }
  }

  for (const line of lines) {
    if (/units\s*consumed|consumed\s*units/i.test(line)) {
      for (const n of numbersOnLine(line)) {
        if (n <= 20_000) candidates.push({ value: n, source: "units-consumed-line" })
      }
    }
  }

  let offPeak: number | null = null
  let peak: number | null = null
  for (const line of lines) {
    if (/off\s*[- ]?peak/i.test(line)) {
      const nums = numbersOnLine(line).filter((n) => n <= 20_000)
      if (nums.length) offPeak = nums[nums.length - 1]
    } else if (/\bpeak\b/i.test(line) && !/off\s*[- ]?peak/i.test(line)) {
      const nums = numbersOnLine(line).filter((n) => n <= 20_000)
      if (nums.length) peak = nums[nums.length - 1]
    }
  }
  if (offPeak && peak) {
    candidates.push({ value: offPeak + peak, source: "peak-sum" })
  }

  const peakMatches = [...text.matchAll(/(?:off\s*[- ]?peak|peak)\s*units?[^\d]{0,20}(\d[\d,]*)/gi)]
  if (peakMatches.length >= 2) {
    const sum = peakMatches.reduce((acc, m) => acc + (parseNumber(m[1]) || 0), 0)
    if (sum > 0) candidates.push({ value: sum, source: "peak-offpeak-regex" })
  }

  const labeledPatterns = [
    /units?\s*(?:consumed|used|billed)?[:\s]+([\d,]+(?:\.\d+)?)/i,
    /(?:consumed|billed)\s*units?[:\s]+([\d,]+(?:\.\d+)?)/i,
  ]
  for (const pattern of labeledPatterns) {
    const match = text.match(pattern)
    if (match?.[1]) {
      const val = parseNumber(match[1])
      if (val) candidates.push({ value: val, source: "labeled" })
    }
  }

  return candidates
}

function extractBillAmount(text: string, lines: string[]): number | null {
  const withinPatterns = [
    /payable\s*within\s*due\s*date[^\d]{0,30}(\d[\d,]*)/i,
    /within\s*due\s*date[^\d]{0,30}(\d[\d,]*)/i,
    /amount\s*payable\s*within[^\d]{0,30}(\d[\d,]*)/i,
  ]
  for (const pattern of withinPatterns) {
    const match = text.match(pattern)
    if (match?.[1]) {
      const val = parseNumber(match[1])
      if (val && val >= 200 && val <= 5_000_000) return val
    }
  }

  for (const line of lines) {
    if (/within\s*due\s*date|payable\s*within/i.test(line)) {
      const nums = numbersOnLine(line).filter((n) => n >= 200 && n <= 5_000_000)
      if (nums.length) return nums[nums.length - 1]
    }
  }

  const amountPatterns = [
    /(?:amount\s*payable|payable\s*amount|net\s*amount|bill\s*amount)[^\d]{0,20}(\d[\d,]*)/i,
    /(?:total\s*amount|total\s*payable)[^\d]{0,20}(\d[\d,]*)/i,
  ]
  for (const pattern of amountPatterns) {
    const match = text.match(pattern)
    if (match?.[1]) {
      const val = parseNumber(match[1])
      if (val && val >= 200 && val <= 5_000_000) return val
    }
  }

  const afterDue = text.match(/after\s*due\s*date[^\d]{0,30}(\d[\d,]*)/i)?.[1]
  const afterDueVal = afterDue ? parseNumber(afterDue) : null

  const all = (text.match(/\d[\d,]*\.?\d*/g) || [])
    .map((m) => parseNumber(m))
    .filter((n): n is number => n !== null && n >= 500 && n <= 500_000)

  if (!all.length) return null

  const plausible = all.filter((n) => n !== afterDueVal)
  if (plausible.length) {
    return Math.min(...plausible.filter((n) => n >= 1_000 && n <= 200_000))
      ?? plausible.sort((a, b) => a - b)[Math.floor(plausible.length / 2)]
      ?? null
  }

  return null
}

function inferUnitsFromBill(bill: number, candidates: { value: number; source: string }[]): number | null {
  const valid = candidates
    .filter((c) => tariffLooksValid(impliedTariff(c.value, bill)))
    .sort((a, b) => scoreUnitsCandidate(b.value, bill, b.source) - scoreUnitsCandidate(a.value, bill, a.source))

  return valid[0]?.value ?? null
}

function detectCity(text: string): string | null {
  const upper = text.toUpperCase()
  for (const [disco, city] of Object.entries(DISCO_CITY_MAP)) {
    if (upper.includes(disco)) return city
  }
  for (const city of CITY_NAMES) {
    if (new RegExp(`\\b${city}\\b`, "i").test(text)) return city
  }
  return null
}

const MONTH_PATTERNS = [
  /billing\s*month[:\s]*([A-Za-z]+\s*\d{4})/i,
  /(?:for\s*month\s*of|reading\s*month)[:\s]*([A-Za-z]+\s*\d{4})/i,
  /(\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s*[-/]?\s*\d{4})/i,
]

export function parseElectricityBillOcr(rawText: string): ParsedElectricityBill {
  const text = normalizeText(rawText)
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean)
  const snippets: string[] = []

  let billAmountPkr = extractBillAmount(text, lines)
  if (billAmountPkr) snippets.push(`Payable: PKR ${billAmountPkr}`)

  const unitCandidates = extractUnitsCandidates(text, lines)
  let monthlyUnits: number | null = null

  const best = pickBestUnits(unitCandidates, billAmountPkr)
  if (best) {
    monthlyUnits = best.value
    snippets.push(`Units (${best.source}): ${best.value}`)
  }

  if (!monthlyUnits && billAmountPkr) {
    const inferred = inferUnitsFromBill(billAmountPkr, unitCandidates)
    if (inferred) {
      monthlyUnits = inferred
      snippets.push(`Units (tariff-validated): ${inferred}`)
    }
  }

  if (!monthlyUnits && billAmountPkr) {
    const rough = Math.round(billAmountPkr / 32)
    if (unitsLookPlausible(rough, billAmountPkr)) {
      monthlyUnits = rough
      snippets.push(`Units (estimated from bill): ${rough}`)
    }
  }

  let tariffPerUnit: number | null = null
  if (monthlyUnits && billAmountPkr && monthlyUnits > 0) {
    tariffPerUnit = Math.round((billAmountPkr / monthlyUnits) * 100) / 100
  }

  const tariffLabel = text.match(
    /(?:@|at|rate|tariff|per\s*unit|rs\s*\/?\s*unit)[^\d]{0,12}(\d{1,2}(?:\.\d{1,2})?)/i,
  )
  if (tariffLabel?.[1] && !tariffPerUnit) {
    const t = parseNumber(tariffLabel[1])
    if (t && t >= MIN_TARIFF && t <= MAX_TARIFF) tariffPerUnit = t
  }

  let billingMonth: string | null = null
  for (const pattern of MONTH_PATTERNS) {
    const match = text.match(pattern)
    if (match?.[1]) {
      billingMonth = match[1].trim()
      break
    }
  }

  let consumerName: string | null = null
  const nameLine = lines.find((l) => /consumer\s*name|name\s*of\s*consumer/i.test(l))
  if (nameLine) {
    consumerName = nameLine.replace(/.*?:\s*/i, "").trim() || null
  }

  const city = detectCity(text)
  if (city) snippets.push(`City: ${city}`)

  let confidence: ParsedElectricityBill["confidence"] = "low"
  if (monthlyUnits && billAmountPkr && tariffLooksValid(tariffPerUnit)) {
    confidence = "high"
  } else if (monthlyUnits && billAmountPkr) {
    confidence = "medium"
  } else if (monthlyUnits || billAmountPkr) {
    confidence = "medium"
  }

  return {
    monthlyUnits,
    billAmountPkr,
    tariffPerUnit,
    billingMonth,
    consumerName,
    city,
    confidence,
    rawSnippets: snippets.slice(0, 8),
  }
}

/** Simulate LESCO-style OCR for tests and tuning. */
export function parseElectricityBillOcrFromFixture(fixture: string): ParsedElectricityBill {
  return parseElectricityBillOcr(fixture)
}
