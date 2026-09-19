import { createRequire } from "node:module"
import { resolve } from "node:path"
import { writeFileSync } from "node:fs"

const sharp = createRequire(import.meta.url)("sharp")

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="bg" x1="120" y1="40" x2="900" y2="980" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#2ad4cc"/>
      <stop offset="1" stop-color="#0d6b67"/>
    </linearGradient>
  </defs>
  <rect width="1024" height="1024" rx="228" fill="url(#bg)"/>
  <g fill="none" stroke="#ffffff" stroke-width="118" stroke-linecap="round" stroke-linejoin="round">
    <path d="M318 318 L498 668"/>
    <path d="M706 318 L526 668"/>
  </g>
</svg>`

const out = resolve(process.cwd(), "public")
const source = Buffer.from(svg)

async function writePng(name, size) {
  const buf = await sharp(source)
    .resize(size, size, { fit: "contain" })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer()
  writeFileSync(resolve(out, name), buf)
  console.log(name, size)
}

await writePng("android-chrome-512x512.png", 512)
await writePng("android-chrome-192x192.png", 192)
await writePng("apple-touch-icon.png", 180)
await writePng("app-icon-1024.png", 1024)
await writePng("favicon-32x32.png", 32)
await writePng("favicon-16x16.png", 16)
console.log("App icons written")
