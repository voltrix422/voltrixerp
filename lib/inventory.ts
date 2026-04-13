import { supabase } from "@/lib/supabase"
import { type Order, type OrderItem } from "@/lib/orders"
import { logInventoryTransaction } from "@/lib/inventory-history"

/**
 * Deduct inventory quantities from PO items when order is delivered
 * This reduces the available quantity by tracking usedQty in PO items
 */
export async function deductInventoryForOrder(order: Order): Promise<void> {
  console.log("🔄 Deducting inventory for delivered order:", order.orderNumber)
  
  // Get all received POs
  const { getPOs, savePO } = await import("@/lib/purchase")
  const allPOs = await getPOs()
  const receivedPOs = allPOs.filter(p => 
    p.flowHistory?.some(h => h.step === "Items Received")
  )
  
  console.log(`📦 Found ${receivedPOs.length} received POs to check`)
  
  for (const orderItem of order.items) {
    let remainingQty = orderItem.qty
    console.log(`🔍 Looking to deduct ${remainingQty} ${orderItem.unit} of "${orderItem.description}"`)
    
    // Find POs with matching items (FIFO - First In, First Out)
    for (const po of receivedPOs) {
      if (remainingQty <= 0) break
      
      if (po.type === "imported") {
        // Check imported items
        for (const poItem of po.importedItems) {
          if (poItem.description === orderItem.description && remainingQty > 0) {
            const usedQty = (poItem as any).usedQty || 0
            const availableQty = poItem.qty - usedQty
            
            if (availableQty > 0) {
              const deductQty = Math.min(remainingQty, availableQty)
              const newUsedQty = usedQty + deductQty
              
              // Update the PO item with new usedQty
              ;(poItem as any).usedQty = newUsedQty
              await savePO(po)
              
              remainingQty -= deductQty
              console.log(`✅ Deducted ${deductQty} from PO ${po.poNumber} item "${poItem.description}": ${availableQty} → ${availableQty - deductQty} available`)
              
              // Log the transaction
              try {
                await logInventoryTransaction(
                  orderItem.description,
                  "out",
                  deductQty,
                  orderItem.unit,
                  "order",
                  order.id,
                  order.orderNumber,
                  order.createdBy || "System",
                  `Delivered to ${order.clientName} from PO ${po.poNumber}`
                )
              } catch (e) {
                // Silently ignore logging errors
              }
            }
          }
        }
      } else {
        // Check direct PO items
        for (const poItem of po.items) {
          if (poItem.description === orderItem.description && remainingQty > 0) {
            const usedQty = (poItem as any).usedQty || 0
            const availableQty = poItem.qty - usedQty
            
            if (availableQty > 0) {
              const deductQty = Math.min(remainingQty, availableQty)
              const newUsedQty = usedQty + deductQty
              
              // Update the PO item with new usedQty
              ;(poItem as any).usedQty = newUsedQty
              await savePO(po)
              
              remainingQty -= deductQty
              console.log(`✅ Deducted ${deductQty} from PO ${po.poNumber} item "${poItem.description}": ${availableQty} → ${availableQty - deductQty} available`)
              
              // Log the transaction
              try {
                await logInventoryTransaction(
                  orderItem.description,
                  "out",
                  deductQty,
                  orderItem.unit,
                  "order",
                  order.id,
                  order.orderNumber,
                  order.createdBy || "System",
                  `Delivered to ${order.clientName} from PO ${po.poNumber}`
                )
              } catch (e) {
                // Silently ignore logging errors
              }
            }
          }
        }
      }
    }
    
    if (remainingQty > 0) {
      console.warn(`⚠️ Insufficient inventory for ${orderItem.description}. Could not deduct: ${remainingQty}`)
    }
  }
  
  console.log("✅ Inventory deduction completed for order:", order.orderNumber)
}

/**
 * Restore inventory quantities to stock table when a delivered order is cancelled/deleted
 */
export async function restoreInventoryForOrder(order: Order): Promise<void> {
  console.log("Restoring inventory to stock for order:", order.orderNumber)
  
  // Only restore if order was delivered
  if (order.status !== "delivered") {
    console.log("Order was not delivered, no restoration needed")
    return
  }
  
  for (const item of order.items) {
    // Find the most recent stock item for this description to restore to
    const { data: stockItems } = await supabase
      .from("erp_inventory_stock")
      .select("*")
      .eq("description", item.description)
      .order("updated_at", { ascending: false })
      .limit(1)
    
    if (!stockItems || stockItems.length === 0) {
      console.warn(`No stock items found for restoration: ${item.description}`)
      continue
    }
    
    const stockItem = stockItems[0]
    const newAvailableQty = stockItem.available_qty + item.qty
    
    // Restore the quantity to the stock item
    await supabase
      .from("erp_inventory_stock")
      .update({ 
        available_qty: newAvailableQty,
        updated_at: new Date().toISOString()
      })
      .eq("id", stockItem.id)
    
    console.log(`Restored ${item.qty} to stock ${stockItem.id} (${stockItem.description}): ${stockItem.available_qty} -> ${newAvailableQty}`)
    
    // Log the restoration transaction
    await logInventoryTransaction(
      item.description,
      "in",
      item.qty,
      item.unit,
      "order",
      order.id,
      order.orderNumber,
      order.createdBy || "System",
      `Restored from cancelled/deleted order ${order.orderNumber} to stock ${stockItem.po_number}`
    )
  }
  
  console.log("Stock restoration completed for order:", order.orderNumber)
}

/**
 * Add stock when PO items are received in inventory
 */
export async function addStockFromPO(poId: string, poNumber: string, items: any[], supplierName: string = "", poType: string = "local"): Promise<void> {
  console.log("🔄 Adding stock from PO:", poNumber, "Items:", items.length)
  
  for (const item of items) {
    const stockId = `${poId}-${item.id || Date.now()}`
    
    console.log(`📦 Adding stock item: ${item.description} (${item.qty} ${item.unit})`)
    
    // Add to inventory stock table
    const { error } = await supabase
      .from("erp_inventory_stock")
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
      console.error("❌ Error adding stock:", error)
      continue
    }
    
    console.log(`✅ Added stock: ${item.qty} ${item.unit} of ${item.description} from PO ${poNumber}`)
    
    // Log the stock addition to inventory history (ignore errors)
    try {
      await logInventoryTransaction(
        item.description,
        "in",
        item.qty,
        item.unit,
        "po",
        poId,
        poNumber,
        "System",
        `Stock added from PO ${poNumber} (${supplierName})`
      )
      console.log(`📝 Logged inventory history for: ${item.description}`)
    } catch (historyError) {
      // Silently ignore logging errors
    }
  }
  
  console.log("✅ Stock addition completed for PO:", poNumber)
}

/**
 * Get current stock levels for items
 */
export async function getStockLevels(itemDescriptions: string[]): Promise<Record<string, number>> {
  const { data: stockItems } = await supabase
    .from("erp_inventory_stock")
    .select("description, available_qty")
    .in("description", itemDescriptions)
  
  const stockLevels: Record<string, number> = {}
  
  if (stockItems) {
    for (const item of stockItems) {
      stockLevels[item.description] = (stockLevels[item.description] || 0) + item.available_qty
    }
  }
  
  return stockLevels
}
