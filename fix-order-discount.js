// Script to fix discount for order ORD-00005
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function fixOrderDiscount() {
  try {
    // Find the order with orderNumber ORD-00005
    const order = await prisma.order.findFirst({
      where: { orderNumber: 'ORD-00005' }
    });

    if (!order) {
      console.log('Order ORD-00005 not found');
      return;
    }

    console.log('Current order data:', {
      discount: order.discount,
      discountIsPercentage: order.discountIsPercentage,
      discountValue: order.discountValue
    });

    // Update with correct discount values
    const updatedOrder = await prisma.order.update({
      where: { id: order.id },
      data: {
        discount: 20, // 20% discount
        discountIsPercentage: true,
        discountValue: 112000, // 20% of 560,000
        total: 560000 - 112000 + 100800 + 500 // Recalculate total: subtotal - discount + tax + transport
      }
    });

    console.log('Updated order data:', {
      discount: updatedOrder.discount,
      discountIsPercentage: updatedOrder.discountIsPercentage,
      discountValue: updatedOrder.discountValue,
      total: updatedOrder.total
    });

    console.log('Order discount fixed successfully!');
  } catch (error) {
    console.error('Error fixing order discount:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixOrderDiscount();
