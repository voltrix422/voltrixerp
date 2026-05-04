// Script to fix discount for order ORD-00005 using API
async function fixOrderDiscount() {
  try {
    // Get the order from API
    const response = await fetch('http://localhost:3000/api/db/orders');
    const orders = await response.json();
    
    console.log('Total orders found:', orders.length);
    console.log('Order numbers:', orders.map(o => o.orderNumber));
    
    // Try to find by order number first
    let order = orders.find(o => o.orderNumber === 'ORD-00005');
    
    if (!order) {
      console.log('Order ORD-00005 not found, searching for order with 5kw item and PKR 560,000...');
      // Find order with matching item description and price
      order = orders.find(o => 
        o.items && 
        o.items.some(item => 
          item.description.toLowerCase().includes('5kw') && 
          item.unitPrice === 560000
        )
      );
      
      if (order) {
        console.log('Found matching order:', order.orderNumber);
      } else {
        console.log('No matching order found');
        return;
      }
    }

    console.log('Current order data:', {
      discount: order.discount,
      discountIsPercentage: order.discountIsPercentage,
      discountValue: order.discountValue
    });

    // Update with correct discount values
    const updateResponse = await fetch(`http://localhost:3000/api/db/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...order,
        discount: 20, // 20% discount
        discountIsPercentage: true,
        discountValue: 112000, // 20% of 560,000
        total: 560000 - 112000 + 100800 + 500 // Recalculate total: subtotal - discount + tax + transport
      })
    });

    if (updateResponse.ok) {
      console.log('Order discount fixed successfully!');
      console.log('Updated values:', {
        discount: 20,
        discountIsPercentage: true,
        discountValue: 112000,
        total: 549300
      });
    } else {
      console.error('Failed to update order:', await updateResponse.text());
    }
  } catch (error) {
    console.error('Error fixing order discount:', error);
  }
}

fixOrderDiscount();
