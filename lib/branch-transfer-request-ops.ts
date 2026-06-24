import { prisma } from "@/lib/db"
import {
  executeBatchBranchInventoryTransfer,
  type BatchTransferRequestBody,
} from "@/lib/branch-inventory-batch-execute"
import {
  notifyOnBranchTransferRequest,
  notifyOnBranchTransferReviewed,
} from "@/lib/notifications-server"

export type BranchTransferRequestLine = {
  productDescription: string
  quantity: number
  unit: string
  userNote?: string
}

export type BranchTransferRequestRow = {
  id: string
  status: "pending" | "approved" | "rejected"
  mode: "dispatch" | "transfer"
  fromBranchId: string | null
  fromBranchName: string
  fromBranchCode: string
  toBranchId: string
  toBranchName: string
  toBranchCode: string
  lineCount: number
  totalQuantity: number
  summary: string
  lines: BranchTransferRequestLine[]
  requestedBy: string
  requestedAt: string
  reviewedBy: string | null
  reviewedAt: string | null
  reviewNote: string
  transferBatchId: string | null
}

type PayloadLine = BatchTransferRequestBody["lines"][number] & {
  productName?: string
  unit?: string
}

async function resolveRequestLines(payloadJson: string): Promise<BranchTransferRequestLine[]> {
  let body: BatchTransferRequestBody
  try {
    body = JSON.parse(payloadJson) as BatchTransferRequestBody
  } catch {
    return []
  }
  if (!Array.isArray(body.lines) || body.lines.length === 0) return []

  const branchInvIds = body.lines
    .map((line) => ("fromBranchInventoryId" in line ? line.fromBranchInventoryId : undefined))
    .filter((id): id is string => Boolean(id?.trim()))

  const branchRows =
    branchInvIds.length > 0
      ? await prisma.erpBranchInventory.findMany({
          where: { id: { in: branchInvIds } },
          select: { id: true, productDescription: true, unit: true },
        })
      : []
  const branchById = new Map(branchRows.map((row) => [row.id, row]))

  return body.lines.map((raw) => {
    const line = raw as PayloadLine
    const branchInv =
      "fromBranchInventoryId" in line && line.fromBranchInventoryId
        ? branchById.get(line.fromBranchInventoryId)
        : undefined
    const productDescription =
      line.productName?.trim() ||
      ("model" in line && line.model?.trim()) ||
      branchInv?.productDescription?.trim() ||
      "Unknown item"
    return {
      productDescription,
      quantity: line.quantity,
      unit: line.unit?.trim() || branchInv?.unit || "pcs",
      userNote: line.userNote?.trim() || undefined,
    }
  })
}

async function mapRow(r: {
  id: string
  status: string
  mode: string
  fromBranchId: string | null
  fromBranchName: string
  fromBranchCode: string
  toBranchId: string
  toBranchName: string
  toBranchCode: string
  lineCount: number
  totalQuantity: number
  summary: string
  payloadJson: string
  requestedBy: string
  requestedAt: Date
  reviewedBy: string | null
  reviewedAt: Date | null
  reviewNote: string
  transferBatchId: string | null
}): Promise<BranchTransferRequestRow> {
  return {
    id: r.id,
    status: r.status as BranchTransferRequestRow["status"],
    mode: r.mode as BranchTransferRequestRow["mode"],
    fromBranchId: r.fromBranchId,
    fromBranchName: r.fromBranchName,
    fromBranchCode: r.fromBranchCode,
    toBranchId: r.toBranchId,
    toBranchName: r.toBranchName,
    toBranchCode: r.toBranchCode,
    lineCount: r.lineCount,
    totalQuantity: r.totalQuantity,
    summary: r.summary,
    lines: await resolveRequestLines(r.payloadJson),
    requestedBy: r.requestedBy,
    requestedAt: r.requestedAt.toISOString(),
    reviewedBy: r.reviewedBy,
    reviewedAt: r.reviewedAt?.toISOString() ?? null,
    reviewNote: r.reviewNote,
    transferBatchId: r.transferBatchId,
  }
}

function buildSummary(body: BatchTransferRequestBody) {
  const qty = body.lines.reduce((s, l) => s + (l.quantity || 0), 0)
  const count = body.lines.length
  const verb = body.mode === "dispatch" ? "Dispatch" : "Transfer"
  return `${verb}: ${count} line(s), ${qty} unit(s) total`
}

export async function createPendingBranchTransferRequest(
  body: BatchTransferRequestBody,
  requestedBy: string,
) {
  const destinationBranch = await prisma.erpBranch.findUnique({
    where: { id: body.toBranchId },
  })
  if (!destinationBranch) {
    throw new Error("Destination branch not found")
  }

  const sourceBranch = body.fromBranchId
    ? await prisma.erpBranch.findUnique({ where: { id: body.fromBranchId } })
    : null

  const lineCount = body.lines.length
  const totalQuantity = body.lines.reduce((s, l) => s + (l.quantity || 0), 0)

  const row = await prisma.erpBranchTransferRequest.create({
    data: {
      status: "pending",
      mode: body.mode,
      fromBranchId: body.fromBranchId || null,
      fromBranchName: sourceBranch?.name || body.fromBranchName || "Main warehouse",
      fromBranchCode: sourceBranch?.code || body.fromBranchCode || "MAIN",
      toBranchId: destinationBranch.id,
      toBranchName: destinationBranch.name,
      toBranchCode: destinationBranch.code,
      payloadJson: JSON.stringify(body),
      lineCount,
      totalQuantity,
      summary: buildSummary(body),
      requestedBy,
    },
  })

  void notifyOnBranchTransferRequest(row.id, buildSummary(body), requestedBy)
  return await mapRow(row)
}

export async function listBranchTransferRequests(options?: {
  status?: string
  branchId?: string
}) {
  const status = options?.status || "pending"
  const branchId = options?.branchId

  const rows = await prisma.erpBranchTransferRequest.findMany({
    where: {
      status,
      ...(branchId
        ? {
            OR: [{ fromBranchId: branchId }, { toBranchId: branchId }],
          }
        : {}),
    },
    orderBy: { requestedAt: "desc" },
    take: 100,
  })

  return Promise.all(rows.map(mapRow))
}

export async function approveBranchTransferRequest(id: string, reviewedBy: string) {
  const request = await prisma.erpBranchTransferRequest.findUnique({ where: { id } })
  if (!request) throw new Error("Request not found")
  if (request.status !== "pending") throw new Error("Request is no longer pending")

  const body = JSON.parse(request.payloadJson) as BatchTransferRequestBody
  const result = await executeBatchBranchInventoryTransfer({
    ...body,
    assignedBy: reviewedBy,
  })

  const updated = await prisma.erpBranchTransferRequest.update({
    where: { id },
    data: {
      status: "approved",
      reviewedBy,
      reviewedAt: new Date(),
      transferBatchId: result.transferBatchId,
    },
  })

  void notifyOnBranchTransferReviewed(request.summary, true, request.requestedBy)
  return { request: await mapRow(updated), result }
}

export async function rejectBranchTransferRequest(
  id: string,
  reviewedBy: string,
  reviewNote?: string,
) {
  const request = await prisma.erpBranchTransferRequest.findUnique({ where: { id } })
  if (!request) throw new Error("Request not found")
  if (request.status !== "pending") throw new Error("Request is no longer pending")

  const updated = await prisma.erpBranchTransferRequest.update({
    where: { id },
    data: {
      status: "rejected",
      reviewedBy,
      reviewedAt: new Date(),
      reviewNote: reviewNote?.trim() || "",
    },
  })

  void notifyOnBranchTransferReviewed(request.summary, false, request.requestedBy)
  return await mapRow(updated)
}
