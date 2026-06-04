import { NextRequest, NextResponse } from 'next/server'
import { DEFAULT_PRODUCT_TERMS_CONTENT } from '@/lib/default-product-terms'
import {
  readProductsCatalog,
  sanitizeSpecsForSave,
  writeProductsCatalog,
} from '@/lib/products-catalog-server'

async function resetAllProductTermsInFile() {
  const read = await readProductsCatalog()
  if (!read.ok) throw new Error(read.error)
  const products = read.products
  let updated = 0
  for (const product of products) {
    const hadTerms = Boolean(String(product.terms || '').trim())
    const hadCustom = Boolean(product.termsUseCustom)
    if (hadTerms || hadCustom || product.termsTemplateId || product.termsFile) {
      product.terms = ''
      product.termsUseCustom = false
      product.termsTemplateId = ''
      product.termsFile = ''
      updated += 1
    }
  }
  await writeProductsCatalog(products)
  return { total: products.length, updated, defaultTerms: DEFAULT_PRODUCT_TERMS_CONTENT }
}

export async function GET() {
  const read = await readProductsCatalog()
  if (!read.ok) {
    return NextResponse.json({ error: read.error }, { status: read.status })
  }
  return NextResponse.json(read.products)
}

export async function POST(request: NextRequest) {
  const url = new URL(request.url)
  const action = url.searchParams.get('action')

  if (action === 'reset-all-terms') {
    try {
      const result = await resetAllProductTermsInFile()
      return NextResponse.json({ success: true, ...result })
    } catch (error) {
      console.error('Error resetting product terms:', error)
      const msg = error instanceof Error ? error.message : 'Failed to reset product terms'
      return NextResponse.json({ error: msg }, { status: 500 })
    }
  }

  if (action === 'reorder') {
    try {
      const read = await readProductsCatalog()
      if (!read.ok) {
        return NextResponse.json({ error: read.error }, { status: read.status })
      }
      const { productIds } = await request.json()
      const products = read.products

      const updatedProducts = productIds.map((id: string, index: number) => {
        const product = products.find((p) => p.id === id)
        if (product) product.order = index
        return product
      }).filter(Boolean)

      const allProducts = products
        .map((p) => {
          const updated = updatedProducts.find((up) => up.id === p.id)
          return updated || p
        })
        .sort((a, b) => Number(a.order || 0) - Number(b.order || 0))

      await writeProductsCatalog(allProducts)
      return NextResponse.json({ success: true })
    } catch (error) {
      console.error('Error reordering products:', error)
      return NextResponse.json({ error: 'Failed to reorder products' }, { status: 500 })
    }
  }

  try {
    const read = await readProductsCatalog()
    if (!read.ok) {
      return NextResponse.json({ error: read.error }, { status: read.status })
    }

    const product = await request.json()
    const products = read.products

    product.id = product.id || crypto.randomUUID()
    product.created_at = product.created_at || new Date().toISOString()
    product.order = product.order ?? products.length
    product.specs = sanitizeSpecsForSave(product.specs)
    if (product.termsUseCustom !== true) {
      product.terms = ''
      product.termsUseCustom = false
      product.termsTemplateId = ''
      product.termsFile = ''
    }

    products.unshift(product)
    await writeProductsCatalog(products)

    return NextResponse.json(product)
  } catch (error) {
    console.error('Error creating product:', error)
    const msg = error instanceof Error ? error.message : 'Failed to create product'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const read = await readProductsCatalog()
    if (!read.ok) {
      return NextResponse.json({ error: read.error }, { status: read.status })
    }

    const updatedProduct = await request.json()
    updatedProduct.specs = sanitizeSpecsForSave(updatedProduct.specs)
    const products = read.products

    const index = products.findIndex((p) => p.id === updatedProduct.id)
    if (index === -1) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    products[index] = { ...products[index], ...updatedProduct }
    await writeProductsCatalog(products)

    return NextResponse.json(products[index])
  } catch (error) {
    console.error('Error updating product:', error)
    const msg = error instanceof Error ? error.message : 'Failed to update product'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const read = await readProductsCatalog()
    if (!read.ok) {
      return NextResponse.json({ error: read.error }, { status: read.status })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Product ID required' }, { status: 400 })
    }

    const filtered = read.products.filter((p) => p.id !== id)
    await writeProductsCatalog(filtered)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting product:', error)
    return NextResponse.json({ error: 'Failed to delete product' }, { status: 500 })
  }
}
