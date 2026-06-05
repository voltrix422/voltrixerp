#!/usr/bin/env node
/**
 * Repair data/products.json after a failed git merge on the VPS.
 * Uses VPS backups only — never restores stale catalog from git.
 *
 * Run from project root: node scripts/repair-products-json.mjs
 */
import fs from "fs"
import path from "path"

const file = path.join(process.cwd(), "data", "products.json")
const backupDir = path.join(process.cwd(), "data")

function hasMergeMarkers(raw) {
  return raw.includes("<<<<<<<") || raw.includes(">>>>>>>") || raw.includes("=======")
}

function tryParse(filePath) {
  const raw = fs.readFileSync(filePath, "utf8")
  if (hasMergeMarkers(raw)) {
    return { ok: false, reason: "merge markers" }
  }
  try {
    const data = JSON.parse(raw)
    if (!Array.isArray(data)) return { ok: false, reason: "not an array" }
    return { ok: true, data }
  } catch (e) {
    return { ok: false, reason: e.message }
  }
}

function imageUrlCount(products) {
  return products.reduce((n, p) => n + (Array.isArray(p.images) ? p.images.filter(Boolean).length : 0), 0)
}

function listBackups() {
  if (!fs.existsSync(backupDir)) return []
  return fs
    .readdirSync(backupDir)
    .filter((n) => n.startsWith("products.json.vps-backup-"))
    .map((n) => path.join(backupDir, n))
}

function pickBestBackup() {
  const candidates = []
  for (const bk of listBackups()) {
    const r = tryParse(bk)
    if (!r.ok) continue
    candidates.push({
      path: bk,
      data: r.data,
      count: r.data.length,
      images: imageUrlCount(r.data),
      mtime: fs.statSync(bk).mtimeMs,
    })
  }
  if (candidates.length === 0) return null
  candidates.sort((a, b) => b.mtime - a.mtime || b.count - a.count || b.images - a.images)
  return candidates[0]
}

let products = null
let source = null

if (fs.existsSync(file)) {
  const main = tryParse(file)
  if (main.ok) {
    console.log("OK: products.json is already valid (", main.data.length, "products)")
    process.exit(0)
  }
  console.log("Current file invalid:", main.reason)
}

const bestBackup = pickBestBackup()
if (bestBackup) {
  source = bestBackup.path
  products = bestBackup.data
  console.log(
    "Using backup:",
    path.basename(bestBackup.path),
    "→",
    products.length,
    "products",
  )
}

if (!products) {
  source = "empty catalog"
  products = []
  console.log("No valid backup — initializing empty catalog []")
}

const archive = path.join(backupDir, `products.json.repaired-${Date.now()}.json`)
if (fs.existsSync(file)) {
  try {
    fs.copyFileSync(file, archive)
    console.log("Archived broken file:", archive)
  } catch {
    // ignore
  }
}
fs.writeFileSync(file, JSON.stringify(products, null, 2))
console.log("Wrote:", file, "(from", source + ")")
console.log("Restart: pm2 restart voltrix-erp")
