/** Parse OCR text from a Pakistani electricity bill photo. */

export type ParsedElectricityBill = {
  monthlyUnits: number | null
  billAmountPkr: number | null
  tariffPerUnit: number | null
  billingMonth: string | null
  consumerName: string | null
  confidence: "high" | "medium" | "low"
  rawSnippets: string[]
}

function parseNumber(raw: string): number | null {
  const cleaned = raw.replace(/,/g, "").replace(/\s/g, "")
  const n = Number(cleaned)
  return Number.isFinite(n) && n > 0 ? n : null
}

function pickLargestInRange(nums: number[], min: number, max: number): number | null {
  const inRange = nums.filter((n) => n >= min && n <= max)
  if (!inRange.length) return null
  return Math.max(...inRange)
}

function extractAllNumbers(text: string): number[] {
  const matches = text.match(/\d[\d,]*\.?\d*/g) || []
  return matches
    .map((m) => parseNumber(m))
    .filter((n): n is number => n !== null)
}

const UNIT_LABEL_PATTERNS = [
  /units?\s*(?:consumed|used|billed)?[:\s]*([\d,]+(?:\.\d+)?)/i,
  /(?:consumed|billed)\s*units?[:\s]*([\d,]+(?:\.\d+)?)/i,
  /kwh[:\s]*([\d,]+(?:\.\d+)?)/i,
  /energy\s*charges?[:\s]*([\d,]+(?:\.\d+)?)\s*(?:kwh|units?)?/i,
  /(?:off[- ]?peak|peak)\s*units?[:\s]*([\d,]+(?:\.\d+)?)/gi,
]

const AMOUNT_LABEL_PATTERNS = [
  /(?:amount\s*payable|payable\s*amount|total\s*(?:bill|amount|payable)|net\s*amount|bill\s*amount)[:\s]*(?:rs\.?|pkr)?\s*([\d,]+(?:\.\d+)?)/i,
  /(?:rs\.?|pkr)\s*([\d,]+(?:\.\d+)?)\s*(?:amount\s*payable|payable)/i,
  /(?:after\s*due\s*date|within\s*due\s*date)[:\s]*(?:rs\.?|pkr)?\s*([\d,]+(?:\.\d+)?)/i,
]

const MONTH_PATTERNS = [
  /billing\s*month[:\s]*([A-Za-z]+\s*\d{4})/i,
  /(?:for\s*month\s*of|month)[:\s]*([A-Za-z]+\s*\d{4})/i,
  /(\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s*[-/]?\s*\d{4})/i,
]

export function parseElectricityBillOcr(rawText: string): ParsedElectricityBill {
  const text = rawText.replace(/\r/g, "\n")
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean)
  const snippets: string[] = []

  let monthlyUnits: number | null = null
  for (const pattern of UNIT_LABEL_PATTERNS) {
    const match = text.match(pattern)
    if (match?.[1]) {
      const val = parseNumber(match[1])
      if (val && val >= 10 && val <= 50000) {
        monthlyUnits = monthlyUnits ? Math.max(monthlyUnits, val) : val
        snippets.push(`Units: ${match[0].trim()}`)
      }
    }
  }

  // Sum off-peak + peak if listed separately
  const peakOffPeak = [...text.matchAll(/(?:off[- ]?peak|peak)\s*units?[:\s]*([\d,]+(?:\.\d+)?)/gi)]
  if (peakOffPeak.length >= 2) {
    const sum = peakOffPeak.reduce((acc, m) => acc + (parseNumber(m[1]) || 0), 0)
    if (sum >= 10 && sum <= 50000) {
      monthlyUnits = sum
      snippets.push(`Peak/off-peak sum: ${sum}`)
    }
  }

  let billAmountPkr: number | null = null
  for (const pattern of AMOUNT_LABEL_PATTERNS) {
    const match = text.match(pattern)
    if (match?.[1]) {
      const val = parseNumber(match[1])
      if (val && val >= 500 && val <= 50_000_000) {
        billAmountPkr = billAmountPkr ? Math.max(billAmountPkr, val) : val
        snippets.push(`Amount: ${match[0].trim()}`)
      }
    }
  }

  if (!billAmountPkr) {
    billAmountPkr = pickLargestInRange(extractAllNumbers(text), 1_000, 5_000_000)
    if (billAmountPkr) snippets.push(`Largest amount-like value: ${billAmountPkr}`)
  }

  if (!monthlyUnits) {
    monthlyUnits = pickLargestInRange(extractAllNumbers(text), 50, 20000)
    if (monthlyUnits) snippets.push(`Largest unit-like value: ${monthlyUnits}`)
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

  let tariffPerUnit: number | null = null
  if (monthlyUnits && billAmountPkr && monthlyUnits > 0) {
    tariffPerUnit = Math.round((billAmountPkr / monthlyUnits) * 100) / 100
  }

  const tariffMatch = text.match(/(?:tariff|rate|per\s*unit)[:\s]*(?:rs\.?|pkr)?\s*([\d.]+)/i)
  if (tariffMatch?.[1]) {
    const t = parseNumber(tariffMatch[1])
    if (t && t >= 5 && t <= 80) tariffPerUnit = t
  }

  let confidence: ParsedElectricityBill["confidence"] = "low"
  if (monthlyUnits && billAmountPkr) confidence = "high"
  else if (monthlyUnits || billAmountPkr) confidence = "medium"

  return {
    monthlyUnits,
    billAmountPkr,
    tariffPerUnit,
    billingMonth,
    consumerName,
    confidence,
    rawSnippets: snippets.slice(0, 6),
  }
}
