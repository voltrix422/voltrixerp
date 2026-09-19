import { createRequire } from "node:module"
const { generateVAPIDKeys } = createRequire(import.meta.url)("web-push")
import { existsSync, readFileSync, appendFileSync } from "node:fs"
import { resolve } from "node:path"

const envPath = resolve(process.cwd(), ".env")
if (!existsSync(envPath)) {
  console.log("No .env — skip VAPID keys")
  process.exit(0)
}

const env = readFileSync(envPath, "utf8")
if (/NEXT_PUBLIC_VAPID_PUBLIC_KEY=/.test(env) && /VAPID_PRIVATE_KEY=/.test(env)) {
  console.log("VAPID keys already set")
  process.exit(0)
}

const keys = generateVAPIDKeys()
appendFileSync(
  envPath,
  `\n# Web Push (generated ${new Date().toISOString()})\nNEXT_PUBLIC_VAPID_PUBLIC_KEY=${keys.publicKey}\nVAPID_PRIVATE_KEY=${keys.privateKey}\nVAPID_SUBJECT=mailto:hello@voltrixbatteries.com\n`,
)
console.log("Generated Web Push VAPID keys in .env")
