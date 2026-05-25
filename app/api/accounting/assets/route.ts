import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { withAcctApi } from "@/lib/accounting/api-route"

export async function GET() {
  return withAcctApi(async () => {
    return NextResponse.json(await prisma.acctAsset.findMany({ orderBy: { acquisitionDate: "desc" } }))
  })
}

export async function POST(req: NextRequest) {
  return withAcctApi(async () => {
    const body = await req.json()
    const asset = await prisma.acctAsset.create({
      data: {
        name: String(body.name),
        originalValue: Number(body.originalValue),
        salvageValue: Number(body.salvageValue ?? 0),
        method: String(body.method ?? "linear"),
        durationMonths: Number(body.durationMonths ?? 36),
        acquisitionDate: new Date(body.acquisitionDate),
        assetAccountCode: String(body.assetAccountCode ?? "1510"),
        depreciationAccountCode: String(body.depreciationAccountCode ?? "5610"),
      },
    })
    return NextResponse.json(asset)
  })
}

export async function PATCH(req: NextRequest) {
  return withAcctApi(async () => {
    const body = await req.json()
    if (!body.id) return NextResponse.json({ error: "Missing id" }, { status: 400 })
    const asset = await prisma.acctAsset.update({
      where: { id: body.id },
      data: { state: body.state ?? "running" },
    })
    return NextResponse.json(asset)
  })
}
