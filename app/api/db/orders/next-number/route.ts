import { NextResponse } from "next/server"
import {
  generateNextOrderNumber,
  repairDuplicateOrderNumbers,
} from "@/lib/order-number-server"

export async function GET() {
  const repaired = await repairDuplicateOrderNumbers()
  const orderNumber = await generateNextOrderNumber()
  return NextResponse.json({ orderNumber, repaired })
}
