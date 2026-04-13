import { supabase } from "@/lib/supabase"
import { getPOs } from "@/lib/purchase"
import { addStockFromPO } from "@/lib/inventory"

/**
 * Backfill the inventory stock table from existing received POs
 * This is a one-time migration function to populate the stock table
 */
export async function backfillInventoryStock(): Promise<void> {
  console.log("Starting inventory stock backfill...")
  
  // Get all POs that have been received but might not be in stock table
  const allPOs = await getPOs()
  const receivedPOs = allPOs.filter(po => 
    po.flowHistory?.some(h => h.step === "Items Received")
  )
  
  console.log(`Found ${receivedPOs.length} received POs to backfill`)
  
  for (const po of receivedPOs) {
    try {
      console.log(`Backfilling PO: ${po.poNumber}`)
      
      if (po.type === "imported") {
        await addStockFromPO(
          po.id,
          po.poNumber,
          po.importedItems,
          po.importedSupplierName || "",
          "imported"
        )
      } else {
        // For direct POs, calculate landed cost per item
        const quote = po.quotes.find(q => q.supplierId === po.finalizedSupplierId)
        
        // Calculate total items cost
        const itemsTotal = po.items.reduce((sum, item) => {
          const qi = quote?.items.find(q => q.itemId === item.id)
          return sum + (qi ? qi.unitPrice * item.qty : 0)
        }, 0)
        
        // Calculate additional costs (tax, transport, other)
        const additionalCosts = (quote?.taxPct || 0) + (quote?.transportCost || 0) + (quote?.otherCost || 0)
        
        // Calculate proportional additional cost per item based on its value
        const itemsWithLandedCost = po.items.map(item => {
          const qi = quote?.items.find(q => q.itemId === item.id)
          const basePrice = qi?.unitPrice || 0
          const itemTotal = basePrice * item.qty
          
          // Proportional share of additional costs
          const proportionalAdditionalCost = itemsTotal > 0 ? (itemTotal / itemsTotal) * additionalCosts : 0
          
          // Landed cost per unit = base price + (proportional additional costs / quantity)
          const landedCostPerUnit = basePrice + (item.qty > 0 ? proportionalAdditionalCost / item.qty : 0)
          
          return {
            ...item,
            unitPrice: landedCostPerUnit
          }
        })
        
        await addStockFromPO(
          po.id,
          po.poNumber,
          itemsWithLandedCost,
          po.supplierNames[0] || "",
          "local"
        )
      }
      
      console.log(`Successfully backfilled PO: ${po.poNumber}`)
    } catch (error) {
      console.error(`Error backfilling PO ${po.poNumber}:`, error)
    }
  }
  
  console.log("Inventory stock backfill completed")
}