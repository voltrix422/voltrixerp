#!/usr/bin/env node
/**
 * Repair data/products.json after a failed git merge on the VPS.
 * Run from project root: node scripts/repair-products-json.mjs
 */
import fs from "fs"
import path from "path"
import { execSync } from "child_process"

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

function listBackups() {
  if (!fs.existsSync(backupDir)) return []
  return fs
    .readdirSync(backupDir)
    .filter((n) => n.startsWith("products.json.vps-backup-"))
    .map((n) => path.join(backupDir, n))
    .sort()
    .reverse()
}

function fromGitMain() {
  try {
    const raw = execSync("git show origin/main:data/products.json", {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    })
    return tryParseFromRaw(raw)
  } catch {
    return { ok: false, reason: "git show failed" }
  }
}

function tryParseFromRaw(raw) {
  if (hasMergeMarkers(raw)) return { ok: false, reason: "merge markers" }
  try {
    const data = JSON.parse(raw)
    if (!Array.isArray(data)) return { ok: false, reason: "not an array" }
    return { ok: true, data }
  } catch (e) {
    return { ok: false, reason: e.message }
  }
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

for (const bk of listBackups()) {
  const r = tryParse(bk)
  if (r.ok) {
    source = bk
    products = r.data
    console.log("Using backup:", bk, "→", products.length, "products")
    break
  }
}

if (!products) {
  const git = fromGitMain()
  if (git.ok) {
    source = "origin/main:data/products.json"
    products = git.data
    console.log("Using git catalog from origin/main →", products.length, "products")
  }
}

if (!products) {
  console.error("No valid products.json source found. Check data/products.json.vps-backup-* manually.")
  process.exit(1)
}

const archive = path.join(backupDir, `products.json.repaired-${Date.now()}.json`)
fs.writeFileSync(archive, JSON.stringify(products, null, 2))
fs.writeFileSync(file, JSON.stringify(products, null, 2))
console.log("Wrote:", file, "(from", source + ")")
console.log("Archive:", archive)
console.log("Restart: pm2 restart voltrix-erp")
