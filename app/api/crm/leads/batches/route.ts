import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const action = String(body.action ?? "").trim()

    if (action === "rename") {
      const importBatchId = String(body.importBatchId ?? "").trim()
      const importUploaderName = String(body.importUploaderName ?? "").trim()
      if (!importBatchId || !importUploaderName) {
        return NextResponse.json(
          { error: "importBatchId and importUploaderName required" },
          { status: 400 },
        )
      }
      const result = await prisma.crmLead.updateMany({
        where: { importBatchId },
        data: { importUploaderName },
      })
      if (result.count === 0) {
        return NextResponse.json({ error: "Import batch not found" }, { status: 404 })
      }
      return NextResponse.json({ ok: true, updated: result.count, importBatchId, importUploaderName })
    }

    if (action === "merge") {
      const sourceImportBatchId = String(body.sourceImportBatchId ?? "").trim()
      const targetImportBatchId = String(body.targetImportBatchId ?? "").trim()
      if (!sourceImportBatchId || !targetImportBatchId) {
        return NextResponse.json(
          { error: "sourceImportBatchId and targetImportBatchId required" },
          { status: 400 },
        )
      }
      if (sourceImportBatchId === targetImportBatchId) {
        return NextResponse.json({ error: "Choose a different target batch" }, { status: 400 })
      }

      const targetLead = await prisma.crmLead.findFirst({
        where: { importBatchId: targetImportBatchId },
        select: { importUploaderName: true },
      })
      if (!targetLead) {
        return NextResponse.json({ error: "Target import batch not found" }, { status: 404 })
      }

      const sourceCount = await prisma.crmLead.count({ where: { importBatchId: sourceImportBatchId } })
      if (sourceCount === 0) {
        return NextResponse.json({ error: "Source import batch not found" }, { status: 404 })
      }

      const result = await prisma.crmLead.updateMany({
        where: { importBatchId: sourceImportBatchId },
        data: {
          importBatchId: targetImportBatchId,
          importUploaderName: targetLead.importUploaderName ?? "",
        },
      })

      return NextResponse.json({
        ok: true,
        merged: result.count,
        sourceImportBatchId,
        targetImportBatchId,
        importUploaderName: targetLead.importUploaderName,
      })
    }

    return NextResponse.json({ error: "action must be rename or merge" }, { status: 400 })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: "Failed to update import batch" }, { status: 500 })
  }
}
