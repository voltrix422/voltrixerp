#!/usr/bin/env node
/**
 * Repair data/products.json after a failed git merge on the VPS.
 * Run from project root: node scripts/repair-products-json.mjs
 */
import fs from "fs"
import path from "path"

const file = path.join(process.cwd(), "data", "products.json")
const backupDir = path.join(process.cwd(), "data")

function listBackups() {
  return fs
    .readdirSync(backupDir)
    .filter((n) => n.startsWith("products.json.vps-backup-"))
    .map((n) => path.join(backupDir, n))
    .sort()
    .reverse()
}

function tryParse(filePath) {
  const raw = fs.readFileSync(filePath, "utf8")
  if (raw.includes("<<<<<<<") || raw.includes(">>>>>>>")) {
    return { ok: false, reason: "merge markers" }
  }
  try {
    const data = JSON.parse(raw)
    if (!Array.isArray(data)) return { ok: false, reason: "not an array" }
    return { ok: true, data, raw }
  } catch (e) {
    return { ok: false, reason: e.message }
  }
}

let source = null
let products = null

const main = tryParse(file)
if (main.ok) {
  source = file
  products = main.data
  console.log("OK: products.json is already valid (", products.length, "products)")
} else {
  console.log("Current file invalid:", main.reason)
  for (const bk of listBackups()) {
    const r = tryParse(bk)
    if (r.ok) {
      source = bk
      products = r.data
      console.log("Using backup:", bk, "→", products.length, "products")
      break
    }
  }
}

if (!products) {
  console.error("No valid backup found. Restore products.json manually or copy from GitHub.")
  process.exit(1)
}

const out = path.join(backupDir, `products.json.repaired-${Date.now()}.json`)
fs.writeFileSync(out, JSON.stringify(products, null, 2))
fs.copyFileSync(out, file)
console.log("Wrote:", file)
console.log("Archive copy:", out)
console.log("Restart app: pm2 restart voltrix-erp")
