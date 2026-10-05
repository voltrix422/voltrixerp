/**
 * Post FBR sandbox SN017 (FED in ST Mode), trying HS codes until one validates.
 * Run on VPS: node scripts/fbr-post-sn017.mjs
 */
import { readFileSync } from "node:fs"

function loadEnv(path) {
  const env = {}
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith("#")) continue
    const i = t.indexOf("=")
    if (i < 1) continue
    env[t.slice(0, i)] = t.slice(i + 1)
  }
  return env
}

const env = loadEnv(".env")
const token = String(env.FBR_TOKEN || "").trim()
if (!token) {
  console.error("Missing FBR_TOKEN in .env")
  process.exit(1)
}

const seller = {
  invoiceType: "Sale Invoice",
  invoiceDate: new Date().toISOString().slice(0, 10),
  sellerNTNCNIC: String(env.FBR_SELLER_NTN || "").trim(),
  sellerBusinessName: String(env.FBR_SELLER_NAME || "").trim(),
  sellerProvince: "CAPITAL TERRITORY",
  sellerAddress: String(env.FBR_SELLER_ADDRESS || "").trim(),
  buyerNTNCNIC: "0000000000000",
  buyerBusinessName: "Walk-in customer",
  buyerProvince: "PUNJAB",
  buyerAddress: "Lahore",
  buyerRegistrationType: "Unregistered",
  invoiceRefNo: "",
  scenarioId: "SN017",
}

const hsCandidates = [
  "2402.2000",
  "2402.1000",
  "2202.1010",
  "2202.1090",
  "2203.0000",
  "2710.1921",
  "2710.1992",
  "2523.2900",
  "8703.2329",
  "8507.6000",
  "0101.2100",
  "8471.3000",
]

async function post(hsCode) {
  const payload = {
    ...seller,
    items: [
      {
        hsCode,
        productDescription: "POS sandbox SN017 FED in ST Mode",
        rate: "8%",
        uoM: "Numbers, pieces, units",
        quantity: 1,
        valueSalesExcludingST: 100,
        fixedNotifiedValueOrRetailPrice: 0,
        salesTaxApplicable: 8,
        salesTaxWithheldAtSource: 0,
        extraTax: 0,
        furtherTax: 0,
        fedPayable: 0,
        discount: 0,
        totalValues: 108,
        saleType: "Goods (FED in ST Mode)",
        sroScheduleNo: "",
        sroItemSerialNo: "",
      },
    ],
  }
  const res = await fetch("https://gw.fbr.gov.pk/di_data/v1/di/postinvoicedata_sb", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(45000),
  })
  const text = await res.text()
  let body = text
  try {
    body = text ? JSON.parse(text) : {}
  } catch {
    body = { message: text.slice(0, 500) }
  }
  const invoice = String(body.invoiceNumber || body.InvoiceNumber || "").trim()
  const status = String(body.validationResponse?.status || "").trim()
  const error = String(
    body.validationResponse?.error ||
      body.validationResponse?.errorCode ||
      body.message ||
      "",
  ).slice(0, 240)
  return { hsCode, http: res.status, invoice, status, error, ok: Boolean(invoice) && status.toLowerCase() !== "invalid" }
}

for (const hs of hsCandidates) {
  const result = await post(hs)
  console.log([result.hsCode, result.ok ? "OK" : "FAIL", result.invoice || "-", result.error || ""].join(" | "))
  if (result.ok) {
    console.log(JSON.stringify(result, null, 2))
    process.exit(0)
  }
  await new Promise((r) => setTimeout(r, 1500))
}

process.exit(1)
