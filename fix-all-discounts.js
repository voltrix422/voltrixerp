// Fix all orders with incorrect discount values
async function fixAllDiscounts() {
  try {
    // Get all orders
    const response = await fetch('http://localhost:3000/api/db/orders');
    const orders = await response.json();
    
    console.log(`Found ${orders.length} orders`);
    
    let fixedCount = 0;
    
    // Fix each order with incorrect discount
    for (const order of orders) {
      // Check if discount needs fixing
      const needsFix = 
        (order.discountIsPercentage && order.discount < 100 && order.discountValue === undefined) ||
        (!order.discountIsPercentage && order.discount < 1000 && order.discountValue === undefined);
      
      if (needsFix) {
        console.log(`Fixing order ${order.orderNumber}...`);
        
        // Calculate correct discount amount
        const correctDiscountValue = order.discountIsPercentage 
          ? (order.subtotal * order.discount / 100)
          : order.discount;
        
        // Update order
        const updateResponse = await fetch(`http://localhost:3000/api/db/orders`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...order,
            discountValue: correctDiscountValue
          })
        });
        
        if (updateResponse.ok) {
          fixedCount++;
          console.log(`✓ Fixed ${order.orderNumber}: discount ${order.discount}${order.discountIsPercentage ? '%' : 'PKR'} → PKR ${correctDiscountValue.toLocaleString()}`);
        } else {
          console.error(`✗ Failed to fix ${order.orderNumber}:`, await updateResponse.text());
        }
      }
    }
    
    console.log(`\n=== SUMMARY ===`);
    console.log(`Fixed ${fixedCount} orders`);
    console.log(`Total orders processed: ${orders.length}`);
    
  } catch (error) {
    console.error('Error fixing discounts:', error);
  }
}

fixAllDiscounts();
