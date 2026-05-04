// Fix existing order ORD-00005 discount
async function fixExistingOrder() {
  try {
    // Get all orders
    const response = await fetch('http://localhost:3000/api/db/orders');
    const orders = await response.json();
    
    // Find ORD-00005
    const order = orders.find(o => o.orderNumber === 'ORD-00005');
    
    if (!order) {
      console.log('Order ORD-00005 not found');
      return;
    }

    console.log('Found order:', order.orderNumber);
    console.log('Current discount data:', {
      discount: order.discount,
      discountIsPercentage: order.discountIsPercentage,
      discountValue: order.discountValue
    });

    // Update the order with correct discount values
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
        total: 560000 - 112000 + 95200 + 0 // Recalculate total
      })
    });

    if (updateResponse.ok) {
      console.log('Order ORD-00005 fixed successfully!');
      console.log('Updated discount to: 20% = PKR 112,000');
    } else {
      console.error('Failed to update order:', await updateResponse.text());
    }
  } catch (error) {
    console.error('Error fixing order:', error);
  }
}

fixExistingOrder();
