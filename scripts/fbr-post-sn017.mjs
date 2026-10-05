/**
 * Post FBR sandbox SN017 (FED in ST Mode).
 * Working combo (FBR sandbox, Sep 2026): hsCode 2710.1240,
 * rate "18% and Rs. 80 per Liter", uoM Liter.
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

const payload = {
  invoiceType: "Sale Invoice",
  invoiceDate: new Date().toISOString().slice(0, 10),
  sellerNTNCNIC: String(env.FBR_SELLER_NTN || "").trim(),
  sellerBusinessName: String(env.FBR_SELLER_NAME || "").trim(),
  sellerProvince: String(env.FBR_SELLER_PROVINCE || "CAPITAL TERRITORY").trim() || "CAPITAL TERRITORY",
  sellerAddress: String(env.FBR_SELLER_ADDRESS || "").trim(),
  buyerNTNCNIC: "7000009",
  buyerBusinessName: "Walk-in customer",
  buyerProvince: "PUNJAB",
  buyerAddress: "Lahore",
  buyerRegistrationType: "Unregistered",
  invoiceRefNo: "",
  scenarioId: "SN017",
  items: [
    {
      hsCode: "2710.1240",
      productDescription: "White Spirit SN017 FED in ST Mode",
      rate: "18% and Rs. 80 per Liter",
      uoM: "Liter",
      quantity: 1,
      valueSalesExcludingST: 100,
      fixedNotifiedValueOrRetailPrice: 0,
      salesTaxApplicable: 118,
      salesTaxWithheldAtSource: 0,
      extraTax: 0,
      furtherTax: 0,
      fedPayable: 0,
      discount: 0,
      totalValues: 0,
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
console.log(JSON.stringify({ http: res.status, invoice, status, body }, null, 2))
process.exit(invoice && status.toLowerCase() !== "invalid" ? 0 : 1)
