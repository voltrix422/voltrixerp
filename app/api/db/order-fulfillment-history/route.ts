import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

async function ensureTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS erp_order_fulfillment_history (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      order_number TEXT NOT NULL,
      client_name TEXT NOT NULL,
      dispatcher_name TEXT NOT NULL,
      receiver_name TEXT NOT NULL,
      receiver_cnic TEXT NOT NULL,
      vehicle_number TEXT NOT NULL,
      receiver_image_url TEXT NULL,
      receiver_cnic_image_url TEXT NULL,
      vehicle_image_url TEXT NULL,
      product_image_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
      fulfilled_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      fulfilled_by TEXT NOT NULL,
      notes TEXT NULL DEFAULT '',
      created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `)
}

export async function GET(req: NextRequest) {
  try {
    await ensureTable()
    const { searchParams } = new URL(req.url)
    const orderId = searchParams.get("orderId")
    const orderNumber = searchParams.get("orderNumber")

    const conditions: string[] = []
    const params: string[] = []
    if (orderId) {
      params.push(orderId)
      conditions.push(`order_id = $${params.length}`)
    }
    if (orderNumber) {
      params.push(orderNumber)
      conditions.push(`order_number = $${params.length}`)
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : ""
    const query = `
      SELECT
        id,
        order_id AS "orderId",
        order_number AS "orderNumber",
        client_name AS "clientName",
        dispatcher_name AS "dispatcherName",
        receiver_name AS "receiverName",
        receiver_cnic AS "receiverCnic",
        vehicle_number AS "vehicleNumber",
        receiver_image_url AS "receiverImageUrl",
        receiver_cnic_image_url AS "receiverCnicImageUrl",
        vehicle_image_url AS "vehicleImageUrl",
        product_image_urls AS "productImageUrls",
        fulfilled_at AS "fulfilledAt",
        fulfilled_by AS "fulfilledBy",
        notes,
        created_at AS "createdAt"
      FROM erp_order_fulfillment_history
      ${whereClause}
      ORDER BY fulfilled_at DESC
    `
    const rows = await prisma.$queryRawUnsafe(query, ...params)
    return NextResponse.json(rows)
  } catch (error) {
    console.error("Failed to fetch order fulfillment history:", error)
    return NextResponse.json([], { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureTable()
    const body = await req.json()
    const id = body.id || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
    const fulfilledAt = body.fulfilledAt ? new Date(body.fulfilledAt) : new Date()

    await prisma.$executeRawUnsafe(
      `
      INSERT INTO erp_order_fulfillment_history (
        id, order_id, order_number, client_name, dispatcher_name, receiver_name, receiver_cnic,
        vehicle_number, receiver_image_url, receiver_cnic_image_url, vehicle_image_url,
        product_image_urls, fulfilled_at, fulfilled_by, notes
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11,
        $12::jsonb, $13, $14, $15
      )
      `,
      id,
      body.orderId,
      body.orderNumber,
      body.clientName,
      body.dispatcherName,
      body.receiverName,
      body.receiverCnic,
      body.vehicleNumber,
      body.receiverImageUrl || null,
      body.receiverCnicImageUrl || null,
      body.vehicleImageUrl || null,
      JSON.stringify(Array.isArray(body.productImageUrls) ? body.productImageUrls : []),
      fulfilledAt,
      body.fulfilledBy || "System",
      body.notes || ""
    )

    return NextResponse.json({ ok: true, id })
  } catch (error) {
    console.error("Failed to write order fulfillment history:", error)
    return NextResponse.json({ error: "failed_to_create_history" }, { status: 500 })
  }
}
