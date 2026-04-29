import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

function mapDispatch(d: any) {
  return {
    id: d.id,
    order_id: d.orderId,
    customer_name: d.customerName,
    customer_phone: d.customerPhone,
    delivery_address: d.deliveryAddress,
    items: d.items,
    dispatch_date: d.dispatchDate,
    expected_delivery: d.expectedDelivery,
    status: d.status,
    courier_service: d.courierService,
    driver_name: d.driverName,
    driver_phone: d.driverPhone,
    vehicle_number: d.vehicleNumber,
    tracking_id: d.trackingId,
    notes: d.notes,
    created_by: d.createdBy,
    created_at: d.createdAt?.toISOString() || "",
  }
}

export async function GET() {
  const dispatches = await prisma.erpDispatch.findMany({ orderBy: { createdAt: "desc" } })
  return NextResponse.json(dispatches.map(mapDispatch))
}

export async function POST(req: NextRequest) {
  const body = await req.json()

  try {
    const dispatch = await prisma.erpDispatch.upsert({
      where: { id: body.id ?? "__new__" },
      update: {
        orderId: body.order_id,
        customerName: body.customer_name,
        customerPhone: body.customer_phone,
        deliveryAddress: body.delivery_address,
        items: body.items,
        dispatchDate: body.dispatch_date,
        expectedDelivery: body.expected_delivery,
        status: body.status,
        courierService: body.courier_service,
        driverName: body.driver_name,
        driverPhone: body.driver_phone,
        vehicleNumber: body.vehicle_number,
        trackingId: body.tracking_id,
        notes: body.notes,
        createdBy: body.created_by,
      },
      create: {
        id: body.id,
        orderId: body.order_id,
        customerName: body.customer_name,
        customerPhone: body.customer_phone || "",
        deliveryAddress: body.delivery_address,
        items: body.items,
        dispatchDate: body.dispatch_date || "",
        expectedDelivery: body.expected_delivery || "",
        status: body.status || "pending",
        courierService: body.courier_service || "own_driver",
        driverName: body.driver_name || "",
        driverPhone: body.driver_phone || "",
        vehicleNumber: body.vehicle_number || "",
        trackingId: body.tracking_id || "",
        notes: body.notes || "",
        createdBy: body.created_by,
        createdAt: body.created_at ? new Date(body.created_at) : undefined,
      },
    })
    return NextResponse.json(mapDispatch(dispatch))
  } catch (error) {
    console.error("Error saving dispatch:", error)
    return NextResponse.json({ error: "Failed to save dispatch", details: String(error) }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get("id")

  if (!id) {
    return NextResponse.json({ error: "Missing id parameter" }, { status: 400 })
  }

  try {
    await prisma.erpDispatch.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Error deleting dispatch:", error)
    return NextResponse.json({ error: "Failed to delete dispatch" }, { status: 500 })
  }
}
