import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { normalizeSupplierBankNames } from "@/lib/supplier-bank"

function supplierPayload(s: Record<string, unknown>) {
  const bankNames = normalizeSupplierBankNames(s.bankNames as string[] | undefined)
  const legacyBank = String(s.bankAccountName ?? "").trim()
  const resolvedBanks = bankNames.length > 0 ? bankNames : legacyBank ? [legacyBank] : []
  return {
    purchaseScopeId: String(s.purchaseScopeId || "P1").trim().toUpperCase(),
    name: String(s.name ?? ""),
    type: String(s.type ?? "local"),
    contact: String(s.contact ?? ""),
    email: String(s.email ?? ""),
    address: String(s.address ?? ""),
    company: String(s.company ?? ""),
    accountTitle: String(s.accountTitle ?? ""),
    bankNames: resolvedBanks,
    bankAccountName: resolvedBanks[0] || legacyBank || null,
    bankIban: s.bankIban ? String(s.bankIban) : null,
    image: String(s.image ?? ""),
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const scope = (searchParams.get("scope") || "").trim().toUpperCase()
  const suppliers = await prisma.erpSupplier.findMany({
    where: scope ? { purchaseScopeId: scope } : undefined,
    orderBy: { name: "asc" },
  })
  return NextResponse.json(suppliers)
}

export async function POST(req: NextRequest) {
  try {
    const s = await req.json()
    const data = supplierPayload(s)
    const supplier = await prisma.erpSupplier.upsert({
      where: { id: s.id ?? "__new__" },
      update: data,
      create: {
        id: s.id,
        ...data,
      },
    })
    return NextResponse.json(supplier)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown supplier save error"
    const needsMigration =
      /account_title|bank_names|Unknown arg `accountTitle`|Unknown arg `bankNames`/i.test(message)
    return NextResponse.json(
      {
        error: needsMigration
          ? "Supplier update failed because database migration is pending. Run: npx prisma migrate deploy"
          : "Failed to save supplier.",
      },
      { status: 500 },
    )
  }
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  await prisma.erpSupplier.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
