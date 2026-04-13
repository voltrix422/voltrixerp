#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load environment variables from .env.local
const envPath = join(__dirname, '.env.local')
const envContent = readFileSync(envPath, 'utf-8')
const envVars = {}
envContent.split('\n').forEach(line => {
  line = line.trim()
  if (line && !line.startsWith('#')) {
    const match = line.match(/^([^=]+)=(.*)$/)
    if (match) {
      envVars[match[1].trim()] = match[2].trim()
    }
  }
})

console.log('🔑 Loaded environment variables')

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env.local')
  console.error('URL:', supabaseUrl ? 'Found' : 'Missing')
  console.error('Key:', supabaseKey ? 'Found' : 'Missing')
  process.exit(1)
}

console.log('✅ Supabase credentials loaded')
const supabase = createClient(supabaseUrl, supabaseKey)

async function getPOs() {
  const { data, error } = await supabase
    .from('erp_purchase_orders')
    .select('*')
    .order('created_at', { ascending: false })
  
  if (error) throw error
  return data || []
}

async function addStockFromPO(poId, poNumber, items, supplierName, poType) {
  console.log(`📦 Adding stock from PO: ${poNumber} (${items.length} items)`)
  
  for (const item of items) {
    const stockId = `${poId}-${item.id || Date.now()}`
    
    console.log(`  ➕ ${item.description}: ${item.qty} ${item.unit} @ PKR ${item.unitPrice.toFixed(2)}`)
    
    const { error } = await supabase
      .from('erp_inventory_stock')
      .insert({
        id: stockId,
        po_id: poId,
        po_number: poNumber,
        item_id: item.id || stockId,
        description: item.description,
        unit: item.unit,
        received_qty: item.qty,
        available_qty: item.qty,
        allocated_qty: 0,
        cost_price: item.unitPrice || 0,
        supplier_name: supplierName,
        po_type: poType
      })
    
    if (error) {
      console.error(`  ❌ Error adding stock for ${item.description}:`, error.message)
    } else {
      console.log(`  ✅ Added successfully`)
    }
  }
}

async function backfillInventoryStock() {
  console.log('🚀 Starting inventory stock backfill...\n')
  
  // Get all POs
  const allPOs = await getPOs()
  console.log(`📋 Found ${allPOs.length} total POs\n`)
  
  // Filter received POs
  const receivedPOs = allPOs.filter(po => 
    po.flow_history?.some(h => h.step === 'Items Received')
  )
  
  console.log(`✅ Found ${receivedPOs.length} received POs to backfill\n`)
  
  if (receivedPOs.length === 0) {
    console.log('ℹ️  No received POs found. Make sure to receive POs in the Inventory page first.')
    return
  }
  
  for (const po of receivedPOs) {
    try {
      console.log(`\n📦 Processing PO: ${po.po_number}`)
      
      if (po.type === 'imported') {
        await addStockFromPO(
          po.id,
          po.po_number,
          po.imported_items,
          po.imported_supplier_name || '',
          'imported'
        )
      } else {
        // For direct POs, calculate landed cost per item
        const quote = po.quotes?.find(q => q.supplierId === po.finalized_supplier_id)
        
        if (!quote) {
          console.log(`  ⚠️  No quote found for PO ${po.po_number}, skipping`)
          continue
        }
        
        // Calculate total items cost
        const itemsTotal = po.items.reduce((sum, item) => {
          const qi = quote.items?.find(q => q.itemId === item.id)
          return sum + (qi ? qi.unitPrice * item.qty : 0)
        }, 0)
        
        // Calculate additional costs
        const additionalCosts = (quote.taxPct || 0) + (quote.transportCost || 0) + (quote.otherCost || 0)
        
        console.log(`  💰 Items Total: PKR ${itemsTotal.toFixed(2)}`)
        console.log(`  💰 Additional Costs: PKR ${additionalCosts.toFixed(2)}`)
        
        // Calculate proportional landed cost per item
        const itemsWithLandedCost = po.items.map(item => {
          const qi = quote.items?.find(q => q.itemId === item.id)
          const basePrice = qi?.unitPrice || 0
          const itemTotal = basePrice * item.qty
          
          // Proportional share of additional costs
          const proportionalAdditionalCost = itemsTotal > 0 ? (itemTotal / itemsTotal) * additionalCosts : 0
          
          // Landed cost per unit
          const landedCostPerUnit = basePrice + (item.qty > 0 ? proportionalAdditionalCost / item.qty : 0)
          
          return {
            ...item,
            unitPrice: landedCostPerUnit
          }
        })
        
        await addStockFromPO(
          po.id,
          po.po_number,
          itemsWithLandedCost,
          po.supplier_names?.[0] || '',
          'local'
        )
      }
      
      console.log(`✅ Successfully backfilled PO: ${po.po_number}`)
    } catch (error) {
      console.error(`❌ Error backfilling PO ${po.po_number}:`, error.message)
    }
  }
  
  console.log('\n\n🎉 Inventory stock backfill completed!')
  console.log('✅ You can now deliver orders and inventory will be properly deducted.')
}

// Run the backfill
backfillInventoryStock()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Backfill failed:', error)
    process.exit(1)
  })
