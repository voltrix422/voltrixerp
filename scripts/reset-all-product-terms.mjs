/**
 * Clears saved per-product terms so every product uses lib/default-product-terms.ts on the site.
 * Run on VPS: node scripts/reset-all-product-terms.mjs
 */
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_FILE = path.join(__dirname, "..", "data", "products.json")

const raw = fs.readFileSync(DATA_FILE, "utf8")
const products = JSON.parse(raw)
let updated = 0

for (const product of products) {
  const had =
    Boolean(String(product.terms || "").trim()) ||
    product.termsUseCustom ||
    product.termsTemplateId ||
    product.termsFile
  if (had) {
    product.terms = ""
    product.termsUseCustom = false
    product.termsTemplateId = ""
    product.termsFile = ""
    updated += 1
  }
}

fs.writeFileSync(DATA_FILE, JSON.stringify(products, null, 2))
console.log(`Reset terms on ${updated} of ${products.length} products.`)
