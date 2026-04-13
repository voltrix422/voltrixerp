// Refresh Supabase schema cache
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function refreshSchema() {
  console.log('🔄 Refreshing Supabase schema cache...');
  
  try {
    // Try to notify PostgREST to reload schema
    const { data, error } = await supabase.rpc('pg_notify', {
      channel: 'pgrst',
      payload: 'reload schema'
    });
    
    if (error) {
      console.log('RPC method not available, trying direct SQL...');
      
      // Try direct SQL approach
      const { data: sqlData, error: sqlError } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public')
        .like('table_name', 'erp_inventory%');
        
      if (sqlError) {
        console.error('❌ Error checking tables:', sqlError);
      } else {
        console.log('📋 Found inventory tables:', sqlData?.map(t => t.table_name));
      }
    } else {
      console.log('✅ Schema refresh notification sent');
    }
    
    // Wait a moment then test
    console.log('⏳ Waiting for schema refresh...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test the stock table
    const { data: testData, error: testError } = await supabase
      .from('erp_inventory_stock')
      .select('count', { count: 'exact' });
      
    if (testError) {
      console.error('❌ Stock table still not accessible:', testError.message);
    } else {
      console.log('✅ Stock table is now accessible!');
    }
    
  } catch (error) {
    console.error('❌ Error refreshing schema:', error);
  }
}

refreshSchema().catch(console.error);