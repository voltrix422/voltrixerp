// Direct fix for stock issue
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixStockNow() {
  console.log('🔍 Checking for received POs...');
  
  // Get POs that have been received
  const { data: pos, error: poError } = await supabase
    .from('erp_purchase_orders')
    .select('*');
    
  if (poError) {
    console.error('
  }
  
  console.log(`📦 Found ${pos?.length || 0} total POs`);
  
  // Filter for received POs
  const receivedPOs = pos?.filter(po => {
    const flowHistory = po.flow_history || [];
    return flowHistory.some(h => h.step === 'Items Received');
  }) || [];
  
  console.log(`✅ Found ${receivedPOs.length} received POs`);
  
  // Check current stock
  const { data: currentStock } = await supabase
    .from('erp_inventory_stock')
    .select('*');
    
  console.log(`📊 Current stock entries: ${currentStock?.length || 0}`);
  
  if (receivedPOs.length > 0 && (!currentStock || currentStock.length === 0)) {
    console.log('🔄 Adding stock entries...');
    
    for (const po of receivedPOs) {
      console.log(`Processing PO: ${po.po_number}`);
      
      if (po.type === 'imported' && po.imported_items) {
        for (const item of po.imported_items) {
          const stockEntry = {
            id: `${po.id}-${item.id || Date.now()}`,
            po_id: po.id,
            po_number: po.po_number,
            item_id: item.id || `${po.id}-${Date.now()}`,
            description: item.description,
            unit: item.unit,
            received_qty: item.qty,
            available_qty: item.qty,
            allocated_qty: 0,
            cost_price: item.unitPrice || 0,
            supplier_name: po.imported_supplier_name || '',
            po_type: 'imported'
          };
          
          const { error } = await supabase
            .from('erp_inventory_stock')
            .insert(stockEntry);
            
          if (error) {
            console.error(`❌ Error adding stock for ${item.description}:`, error);
          } else {
            console.log(`✅ Added stock: ${item.qty} ${item.unit} of ${item.description}`);
          }
        }
      } else if (po.items) {
        // Handle direct POs
        const totalQty = po.items.reduce((sum, item) => sum + item.qty, 0);
        const costPerUnit = totalQty > 0 ? 100 : 0; // Default cost
        
        for (const item of po.items) {
          const stockEntry = {
            id: `${po.id}-${item.id || Date.now()}`,
            po_id: po.id,
            po_number: po.po_number,
            item_id: item.id || `${po.id}-${Date.now()}`,
            description: item.description,
            unit: item.unit,
            received_qty: item.qty,
            available_qty: item.qty,
            allocated_qty: 0,
            cost_price: costPerUnit,
            supplier_name: (po.supplier_names && po.supplier_names[0]) || '',
            po_type: 'local'
          };
          
          const { error } = await supabase
            .from('erp_inventory_stock')
            .insert(stockEntry);
            
          if (error) {
            console.error(`❌ Error adding stock for ${item.description}:`, error);
          } else {
            console.log(`✅ Added stock: ${item.qty} ${item.unit} of ${item.description}`);
          }
        }
      }
    }
    
    // Check final stock
    const { data: finalStock } = await supabase
      .from('erp_inventory_stock')
      .select('*');
      
    console.log(`🎉 Final stock entries: ${finalStock?.length || 0}`);
    if (finalStock && finalStock.length > 0) {
      console.log('📋 Stock summary:');
      finalStock.forEach(item => {
        console.log(`  - ${item.description}: ${item.available_qty} ${item.unit} (PO: ${item.po_number})`);
      });
    }
  }
}

fixStockNow().catch(console.error);