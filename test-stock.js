// Test script to check and fix stock levels
import { supabase } from './lib/supabase.js';
import { backfillInventoryStock } from './lib/backfill-inventory-stock.js';

async function checkAndFixStock() {
  console.log('🔍 Checking current stock levels...');
  
  // Check current stock table
  const { data: stockData, error: stockError } = await supabase
    .from('erp_inventory_stock')
    .select('*');
    
  if (stockError) {
    console.error('❌ Error checking stock:', stockError);
    return;
  }
  
  console.log(`📊 Current stock entries: ${stockData?.length || 0}`);
  
  if (!stockData || stockData.length === 0) {
    console.log('🔄 Stock table is empty, running backfill...');
    try {
      await backfillInventoryStock();
      console.log('✅ Backfill completed!');
      
      // Check again
      const { data: newStockData } = await supabase
        .from('erp_inventory_stock')
        .select('*');
      console.log(`📊 Stock entries after backfill: ${newStockData?.length || 0}`);
      
      if (newStockData && newStockData.length > 0) {
        console.log('📋 Stock items:');
        newStockData.forEach(item => {
          console.log(`  - ${item.description}: ${item.available_qty} ${item.unit} (PO: ${item.po_number})`);
        });
      }
    } catch (error) {
      console.error('❌ Backfill failed:', error);
    }
  } else {
    console.log('📋 Current stock items:');
    stockData.forEach(item => {
      console.log(`  - ${item.description}: ${item.available_qty} ${item.unit} (PO: ${item.po_number})`);
    });
  }
}

checkAndFixStock().catch(console.error);