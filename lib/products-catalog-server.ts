import { promises as fs } from "fs"
import path from "path"

export const PRODUCTS_DATA_FILE = path.join(process.cwd(), "data", "products.json")

export type ProductsCatalogReadResult =
  | { ok: true; products: Record<string, unknown>[] }
  | { ok: false; error: string; status: number }

export async function ensureProductsDataFile(): Promise<void> {
  try {
    await fs.access(PRODUCTS_DATA_FILE)
  } catch {
    await fs.mkdir(path.dirname(PRODUCTS_DATA_FILE), { recursive: true })
    await fs.writeFile(PRODUCTS_DATA_FILE, JSON.stringify([]))
  }
}

export async function readProductsCatalog(): Promise<ProductsCatalogReadResult> {
  try {
    await ensureProductsDataFile()
    const raw = await fs.readFile(PRODUCTS_DATA_FILE, "utf-8")
    if (raw.includes("<<<<<<<") || raw.includes(">>>>>>>") || raw.includes("=======")) {
      return {
        ok: false,
        error:
          "products.json is corrupted (git merge markers). On the server run: node scripts/repair-products-json.mjs",
        status: 500,
      }
    }
    const products = JSON.parse(raw)
    if (!Array.isArray(products)) {
      return { ok: false, error: "products.json is not a valid array", status: 500 }
    }
    return { ok: true, products }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "read failed"
    return {
      ok: false,
      error: `Cannot read products catalog: ${msg}. Run: node scripts/repair-products-json.mjs`,
      status: 500,
    }
  }
}

export async function writeProductsCatalog(products: Record<string, unknown>[]): Promise<void> {
  const dir = path.dirname(PRODUCTS_DATA_FILE)
  await fs.mkdir(dir, { recursive: true })
  const tmp = path.join(dir, `.products-${Date.now()}.tmp`)
  const body = JSON.stringify(products, null, 2)
  await fs.writeFile(tmp, body, "utf-8")
  await fs.rename(tmp, PRODUCTS_DATA_FILE)
}

export function sanitizeSpecsForSave(specs: unknown): { label: string; value: string; imageUrl?: string }[] {
  if (!Array.isArray(specs)) return []
  return specs
    .filter((x): x is Record<string, unknown> => x && typeof x === "object")
    .map(x => {
      const row = {
        label: String(x.label ?? "").trim(),
        value: String(x.value ?? "").trim(),
      }
      const img = x.imageUrl ? String(x.imageUrl).trim() : ""
      return img ? { ...row, imageUrl: img } : row
    })
}
