import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const completedOrders = await prisma.erpOrder.findMany({
      where: {
        status: "delivered", // Assuming 'delivered' means completed. Adjust if your status is different.
      },
      select: {
        createdAt: true,
        total: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    const monthlySummary = completedOrders.reduce((acc, order) => {
      const date = new Date(order.createdAt);
      const year = date.getFullYear();
      const month = date.getMonth(); // 0-indexed month

      const key = `${year}-${month + 1}`; // e.g., "2023-10"

      if (!acc[key]) {
        acc[key] = { month: key, totalSales: 0 };
      }
      acc[key].totalSales += order.total;
      return acc;
    }, {} as Record<string, { month: string; totalSales: number }>);

    const data = Object.values(monthlySummary).sort((a, b) => {
      const [yearA, monthA] = a.month.split("-").map(Number);
      const [yearB, monthB] = b.month.split("-").map(Number);
      if (yearA !== yearB) return yearA - yearB;
      return monthA - monthB;
    });

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching completed orders summary:", error);
    return NextResponse.json(
      { error: "Failed to fetch completed orders summary" },
      { status: 500 }
    );
  }
}
