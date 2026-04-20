import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

const DATA_FILE = path.join(process.cwd(), 'data', 'products.json')

async function ensureDataFile() {
  try {
    await fs.access(DATA_FILE)
  } catch {
    await fs.mkdir(path.dirname(DATA_FILE), { recursive: true })
    await fs.writeFile(DATA_FILE, JSON.stringify([]))
  }
}

export async function GET() {
  try {
    await ensureDataFile()
    const data = await fs.readFile(DATA_FILE, 'utf-8')
    const products = JSON.parse(data)
    return NextResponse.json(products)
  } catch (error) {
    console.error('Error reading products:', error)
    return NextResponse.json([])
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureDataFile()
    const product = await request.json()
    const data = await fs.readFile(DATA_FILE, 'utf-8')
    const products = JSON.parse(data)
    
    product.id = product.id || crypto.randomUUID()
    product.created_at = product.created_at || new Date().toISOString()
    
    products.unshift(product)
    await fs.writeFile(DATA_FILE, JSON.stringify(products, null, 2))
    
    return NextResponse.json(product)
  } catch (error) {
    console.error('Error creating product:', error)
    return NextResponse.json({ error: 'Failed to create product' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    await ensureDataFile()
    const updatedProduct = await request.json()
    const data = await fs.readFile(DATA_FILE, 'utf-8')
    const products = JSON.parse(data)
    
    const index = products.findIndex((p: any) => p.id === updatedProduct.id)
    if (index === -1) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }
    
    products[index] = { ...products[index], ...updatedProduct }
    await fs.writeFile(DATA_FILE, JSON.stringify(products, null, 2))
    
    return NextResponse.json(products[index])
  } catch (error) {
    console.error('Error updating product:', error)
    return NextResponse.json({ error: 'Failed to update product' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await ensureDataFile()
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    if (!id) {
      return NextResponse.json({ error: 'Product ID required' }, { status: 400 })
    }
    
    const data = await fs.readFile(DATA_FILE, 'utf-8')
    const products = JSON.parse(data)
    
    const filtered = products.filter((p: any) => p.id !== id)
    await fs.writeFile(DATA_FILE, JSON.stringify(filtered, null, 2))
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting product:', error)
    return NextResponse.json({ error: 'Failed to delete product' }, { status: 500 })
  }
}
