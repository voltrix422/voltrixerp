import { promises as fs } from "fs"
import path from "path"
import { DEFAULT_PRODUCT_TERMS_CONTENT, DEFAULT_PRODUCT_TERMS_NAME } from "@/lib/default-product-terms"

export type ProductTermsTemplate = {
  id: string
  name: string
  content: string
  fileUrl?: string | null
  isDefault?: boolean
  created_at: string
}

export type ProductTermsDisplay = {
  content: string
  fileUrl?: string | null
}

const DATA_FILE = path.join(process.cwd(), "data", "product-terms-templates.json")

export function createDefaultProductTermsTemplate(): ProductTermsTemplate {
  return {
    id: "default-product-terms",
    name: DEFAULT_PRODUCT_TERMS_NAME,
    content: DEFAULT_PRODUCT_TERMS_CONTENT,
    fileUrl: null,
    isDefault: true,
    created_at: new Date().toISOString(),
  }
}

export async function loadProductTermsTemplates(): Promise<ProductTermsTemplate[]> {
  try {
    await fs.access(DATA_FILE)
    const data = await fs.readFile(DATA_FILE, "utf-8")
    const templates = JSON.parse(data) as ProductTermsTemplate[]
    if (!Array.isArray(templates) || templates.length === 0) {
      return [createDefaultProductTermsTemplate()]
    }
    return templates
  } catch {
    return [createDefaultProductTermsTemplate()]
  }
}

export function resolveProductTermsDisplay(
  product: {
    terms?: string | null
    termsFile?: string | null
    termsTemplateId?: string | null
  },
  _templates?: ProductTermsTemplate[],
): ProductTermsDisplay {
  const content = (product.terms || "").trim() || DEFAULT_PRODUCT_TERMS_CONTENT
  return { content, fileUrl: null }
}
