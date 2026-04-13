// Quick script to run inventory stock backfill
const { backfillInventoryStock } = require('../lib/backfill-inventory-stock.ts');

async function runBackfill() {
  try {
    console.log('🔄 Starting inventory stock backfill...');
    await backfillInventoryStock();
    console.log('✅ Backfill completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Backfill failed:', error);
    process.exit(1);
  }
}

runBackfill();