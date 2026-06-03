#!/usr/bin/env node
/**
 * Lists product image URLs in data/products.json and whether files exist on disk.
 * Run on VPS: node scripts/check-product-images.mjs
 */
import { readFile, access } from "fs/promises"
import path from "path"
import { fileURLToPath } from "url"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
const dataFile = path.join(root, "data", "products.json")
const uploadsRoot = path.join(root, "public", "uploads")

function toDiskPath(url) {
  if (!url || typeof url !== "string") return null
  const trimmed = url.trim()
  if (!trimmed.startsWith("/uploads/")) return null
  return path.join(root, "public", trimmed.replace(/^\//, "").split("/").join(path.sep))
}

const raw = await readFile(dataFile, "utf-8")
const products = JSON.parse(raw)
let missing = 0
let ok = 0

console.log("Product image check\n")

for (const p of products) {
  const images = Array.isArray(p.images) ? p.images : []
  if (images.length === 0) {
    console.log(`[NO URLS] ${p.name} (${p.category})`)
    continue
  }
  for (const url of images) {
    const disk = toDiskPath(url)
    if (!disk) {
      console.log(`[SKIP] ${p.name} — not a local upload: ${url}`)
      continue
    }
    try {
      await access(disk)
      console.log(`[OK] ${p.name} — ${url}`)
      ok++
    } catch {
      console.log(`[MISSING] ${p.name} — ${url}`)
      missing++
    }
  }
}

console.log(`\nSummary: ${ok} file(s) found, ${missing} missing on disk under public/uploads/`)
if (missing > 0) {
  console.log("\nRe-upload images in ERP: Website → Products → edit each product → add photos → Save.")
  process.exit(1)
}
