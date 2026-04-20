import { type Order, type OrderItem } from "@/lib/orders"
import { logInventoryTransaction } from "@/lib/inventory-history"

/**
 * Deduct inventory quantities from inventory-stock table when order is delivered
 * This reduces the available quantity directly from the inventory-stock table
 */
export async function deductInventoryForOrder(order: Order): Promise<void> {
  console.log("🔄 Deducting inventory for delivered order:", order.orderNumber)
  
  for (const orderItem of order.items) {
    if (orderItem.isCustom) {
      console.log(`⏭️ Skipping custom item: ${orderItem.description}`)
      continue
    }
    
    console.log(`🔍 Looking to deduct ${orderItem.qty} ${orderItem.unit} of "${orderItem.description}"`)
    
    try {
      // Fetch stock items matching this description
      const res = await fetch(`/api/db/inventory-stock?descriptions=${encodeURIComponent(orderItem.description)}`)
      if (!res.ok) {
        console.warn(`Failed to fetch inventory-stock for ${orderItem.description}`)
        continue
      }
      
      const stockItems = await res.json()
      console.log(`Found ${stockItems?.length || 0} stock items for ${orderItem.description}:`, stockItems)
      
      if (!stockItems || stockItems.length === 0) {
        console.warn(`No stock items found for ${orderItem.description}`)
        continue
      }
      
      let remainingQty = orderItem.qty
      
      // Deduct from stock items (FIFO - First In, First Out)
      for (const stockItem of stockItems) {
        if (remainingQty <= 0) break
        
        const currentQty = stockItem.availableQty || stockItem.available_qty || 0
        if (currentQty <= 0) {
          console.log(`⏭️ Skipping stock item with 0 available qty: ${stockItem.id}`)
          continue
        }
        
        const deductQty = Math.min(remainingQty, currentQty)
        const newAvailableQty = Math.max(0, currentQty - deductQty)
        
        console.log(`Updating inventory-stock ${stockItem.id} (${stockItem.description}): ${currentQty} → ${newAvailableQty} (deducting ${deductQty})`)
        
        const updateRes = await fetch("/api/db/inventory-stock", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "update", id: stockItem.id, data: { availableQty: newAvailableQty } }),
        })
        
        if (!updateRes.ok) {
          console.warn(`Failed to update inventory-stock for ${stockItem.description}`)
          continue
        }
        
        console.log(`✅ Updated inventory-stock ${stockItem.id}: ${currentQty} → ${newAvailableQty}`)
        remainingQty -= deductQty
        
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
            `Delivered to ${order.clientName} (PO: ${stockItem.poNumber || stockItem.po_number})`
          )
        } catch (e) {
          console.warn(`Failed to log inventory transaction:`, e)
        }
      }
      
      if (remainingQty > 0) {
        console.warn(`⚠️ Insufficient inventory for ${orderItem.description}. Could not deduct: ${remainingQty}`)
      } else {
        console.log(`✅ Successfully deducted ${orderItem.qty} ${orderItem.unit} of "${orderItem.description}"`)
      }
    } catch (e) {
      console.error(`Failed to deduct inventory for ${orderItem.description}:`, e)
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
    try {
      const res = await fetch(`/api/db/inventory-stock?descriptions=${encodeURIComponent(item.description)}`)
      const stockItems = await res.json()
      if (!stockItems || stockItems.length === 0) {
        console.warn(`No stock items found for restoration: ${item.description}`)
        continue
      }
      const stockItem = stockItems[0]
      const newAvailableQty = stockItem.availableQty + item.qty

      await fetch("/api/db/inventory-stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update", id: stockItem.id, data: { availableQty: newAvailableQty } }),
      })

      console.log(`Restored ${item.qty} to stock ${stockItem.id} (${stockItem.description}): ${stockItem.availableQty} -> ${newAvailableQty}`)

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
        `Restored from cancelled/deleted order ${order.orderNumber} to stock ${stockItem.poNumber}`
      )
    } catch {
      console.warn(`Failed to restore stock for: ${item.description}`)
      continue
    }
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
    const res = await fetch("/api/db/inventory-stock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "insert",
        data: {
          id: stockId,
          poId,
          poNumber,
          itemId: item.id || stockId,
          description: item.description,
          unit: item.unit,
          receivedQty: item.qty,
          availableQty: item.qty,
          allocatedQty: 0,
          costPrice: item.unitPrice || 0,
          supplierName,
          poType,
        },
      }),
    })
    if (!res.ok) {
      console.error("❌ Error adding stock")
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
  try {
    const res = await fetch(`/api/db/inventory-stock?descriptions=${encodeURIComponent(itemDescriptions.join(","))}`)
    const stockItems = await res.json()
    const stockLevels: Record<string, number> = {}
    if (stockItems) {
      for (const item of stockItems) {
        stockLevels[item.description] = (stockLevels[item.description] || 0) + item.availableQty
      }
    }
    return stockLevels
  } catch { return {} }
}
