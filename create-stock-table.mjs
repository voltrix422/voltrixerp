// Create erp_inventory_stock table in Supabase
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createStockTable() {
  console.log('📦 Creating erp_inventory_stock table...');
  
  try {
    // Read the SQL schema file
    const sql = readFileSync('./supabase-inventory-stock-schema.sql', 'utf-8');
    
    console.log('📄 SQL Schema loaded');
    console.log('⚠️  Please run this SQL in your Supabase SQL Editor:');
    console.log('');
    console.log('='.repeat(80));
    console.log(sql);
    console.log('='.repeat(80));
    console.log('');
    console.log('Steps:');
    console.log('1. Go to your Supabase Dashboard');
    console.log('2. Click on "SQL Editor" in the left sidebar');
    console.log('3. Click "New Query"');
    console.log('4. Copy the SQL above and paste it');
    console.log('5. Click "Run" or press Ctrl+Enter');
    console.log('');
    console.log('After running the SQL, the table will be created and ready to use!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

createStockTable();
