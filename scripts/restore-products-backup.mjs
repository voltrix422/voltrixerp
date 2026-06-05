#!/usr/bin/env node
/**
 * List or restore data/products.json from VPS backups.
 *
 * List backups (newest first, with product counts):
 *   node scripts/restore-products-backup.mjs --list
 *
 * Restore newest backup with the most products:
 *   node scripts/restore-products-backup.mjs --best
 *
 * Restore a specific file:
 *   node scripts/restore-products-backup.mjs data/products.json.vps-backup-20260605-181754
 */
import fs from "fs"
import path from "path"

const dataDir = path.join(process.cwd(), "data")
const target = path.join(dataDir, "products.json")

function hasMergeMarkers(raw) {
  return raw.includes("<<<<<<<") || raw.includes(">>>>>>>") || raw.includes("=======")
}

function tryParse(filePath) {
  try {
    const raw = fs.readFileSync(filePath, "utf8")
    if (hasMergeMarkers(raw)) return null
    const data = JSON.parse(raw)
    if (!Array.isArray(data)) return null
    return data
  } catch {
    return null
  }
}

function imageCount(products) {
  return products.reduce((n, p) => n + (Array.isArray(p.images) ? p.images.filter(Boolean).length : 0), 0)
}

function listBackups() {
  if (!fs.existsSync(dataDir)) return []
  return fs
    .readdirSync(dataDir)
    .filter((n) => n.startsWith("products.json.vps-backup-"))
    .map((n) => path.join(dataDir, n))
    .sort()
    .reverse()
}

function scoreBackup(filePath) {
  const products = tryParse(filePath)
  if (!products) return null
  const mtime = fs.statSync(filePath).mtimeMs
  return {
    filePath,
    products,
    count: products.length,
    images: imageCount(products),
    mtime,
  }
}

function formatRow(row) {
  const name = path.basename(row.filePath)
  const sample = row.products[0]?.name || "(empty)"
  return `${row.count} products, ${row.images} image URL(s) — ${name} — e.g. ${sample}`
}

const args = process.argv.slice(2)

if (args.includes("--list") || args.length === 0) {
  const rows = listBackups().map(scoreBackup).filter(Boolean)
  if (rows.length === 0) {
    console.log("No backups found in data/products.json.vps-backup-*")
    process.exit(1)
  }
  console.log("Available product catalog backups (newest first):\n")
  for (const row of rows) console.log(" ", formatRow(row))
  console.log("\nRestore best:  node scripts/restore-products-backup.mjs --best")
  console.log("Restore file:  node scripts/restore-products-backup.mjs <backup-path>")
  process.exit(0)
}

if (args.includes("--best")) {
  const rows = listBackups().map(scoreBackup).filter(Boolean)
  if (rows.length === 0) {
    console.error("No valid backups found.")
    process.exit(1)
  }
  rows.sort((a, b) => b.count - a.count || b.images - a.images || b.mtime - a.mtime)
  const best = rows[0]
  console.log("Best backup:", formatRow(best))
  fs.copyFileSync(best.filePath, target)
  console.log("Restored:", target)
  console.log("Run: node scripts/check-products-catalog.mjs && pm2 restart voltrix-erp")
  process.exit(0)
}

const source = path.resolve(args[0])
const products = tryParse(source)
if (!products) {
  console.error("Invalid backup file:", source)
  process.exit(1)
}

fs.copyFileSync(source, target)
console.log("Restored", products.length, "products from", source)
console.log("Run: node scripts/check-products-catalog.mjs && pm2 restart voltrix-erp")
