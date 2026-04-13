import { supabase } from "@/lib/supabase"

export interface InventoryTransaction {
  id: string
  item_description: string
  transaction_type: "in" | "out"
  quantity: number
  unit: string
  reference_type: "po" | "order"
  reference_id: string
  reference_number: string
  notes?: string
  created_at: string
  created_by: string
}

export async function getInventoryHistory(): Promise<InventoryTransaction[]> {
  try {
    console.log("🔍 Attempting to fetch inventory history...")
    
    const { data, error } = await supabase
      .from("erp_inventory_history")
      .select("*")
      .order("created_at", { ascending: false })
    
    if (error) {
      console.error("❌ Error fetching inventory history:", error)
      console.error("Error code:", error.code)
      console.error("Error message:", error.message)
      
      // Check if table doesn't exist
      if (error.message?.includes("does not exist") || error.code === "42P01") {
        console.warn("❌ INVENTORY HISTORY TABLE DOES NOT EXIST!")
        console.warn("📋 Please run this SQL in your Supabase SQL Editor:")
        console.warn(`
-- Create inventory history table
CREATE TABLE IF NOT EXISTS erp_inventory_history (
  id TEXT PRIMARY KEY,
  item_description TEXT NOT NULL,
  transaction_type TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  unit TEXT NOT NULL,
  reference_type TEXT NOT NULL,
  reference_id TEXT NOT NULL,
  reference_number TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT NOT NULL
);

ALTER TABLE erp_inventory_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to read inventory history"
  ON erp_inventory_history FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert inventory history"
  ON erp_inventory_history FOR INSERT
  TO authenticated
  WITH CHECK (true);
        `)
        return []
      }
      
      // Other database errors
      console.error("❌ Database error:", error)
      return []
    }
    
    console.log("✅ Successfully fetched inventory history:", data?.length || 0, "records")
    return data || []
  } catch (err) {
    console.error("❌ Unexpected error fetching inventory history:", err)
    return []
  }
}

export async function getInventoryHistoryByItem(itemDescription: string): Promise<InventoryTransaction[]> {
  const { data, error } = await supabase
    .from("erp_inventory_history")
    .select("*")
    .eq("item_description", itemDescription)
    .order("created_at", { ascending: false })
  
  if (error) {
    console.error("Error fetching inventory history:", error)
    return []
  }
  
  return data || []
}

export async function logInventoryTransaction(
  itemDescription: string,
  transactionType: "in" | "out",
  quantity: number,
  unit: string,
  referenceType: "po" | "order",
  referenceId: string,
  referenceNumber: string,
  createdBy: string,
  notes?: string
): Promise<void> {
  try {
    const transaction: InventoryTransaction = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      item_description: itemDescription,
      transaction_type: transactionType,
      quantity,
      unit,
      reference_type: referenceType,
      reference_id: referenceId,
      reference_number: referenceNumber,
      notes,
      created_at: new Date().toISOString(),
      created_by: createdBy,
    }
    
    const { error } = await supabase
      .from("erp_inventory_history")
      .insert(transaction)
    
    if (error) {
      // Silently ignore if table doesn't exist
      if (error.message?.includes("does not exist") || error.code === "42P01") {
        return
      }
      // Silently ignore other errors too
      return
    }
  } catch (err) {
    // Silently ignore all errors
    return
  }
}
