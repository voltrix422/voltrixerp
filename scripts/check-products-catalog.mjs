#!/usr/bin/env node
/**
 * Diagnose public product catalog on the server.
 * Run: node scripts/check-products-catalog.mjs
 */
import fs from "fs"
import path from "path"

const file = path.join(process.cwd(), "data", "products.json")

function isPublished(v) {
  if (v === false || v === "false" || v === 0 || v === "0") return false
  if (v === true || v === "true" || v === 1 || v === "1") return true
  return Boolean(v)
}

try {
  const raw = fs.readFileSync(file, "utf8")
  if (raw.includes("<<<<<<<") || raw.includes(">>>>>>>")) {
    console.error("FAIL: products.json contains git merge conflict markers")
    process.exit(1)
  }
  const products = JSON.parse(raw)
  if (!Array.isArray(products)) {
    console.error("FAIL: products.json is not an array")
    process.exit(1)
  }
  const published = products.filter((p) => isPublished(p))
  console.log("OK: valid JSON")
  console.log("Total products:", products.length)
  console.log("Published (visible on site):", published.length)
  if (published.length === 0 && products.length > 0) {
    console.log("TIP: Turn on Publish in Website → Products for each item")
  }
  if (products.length > 0) {
    console.log("Sample:", products[0].name, "| published:", products[0].published, "| category:", products[0].category)
  }
} catch (e) {
  console.error("FAIL: cannot read/parse products.json:", e.message)
  console.error("Restore: cp data/products.json.vps-backup-* data/products.json")
  process.exit(1)
}
