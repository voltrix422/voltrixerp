import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { normalizeSupplierBankAccounts, parseSupplierBankAccounts } from "@/lib/supplier-bank"

function supplierPayload(s: Record<string, unknown>) {
  const legacyBank = String(s.bankAccountName ?? "").trim()
  const bankAccounts = normalizeSupplierBankAccounts(
    Array.isArray(s.bankAccounts)
      ? s.bankAccounts as Array<{ accountTitle?: string; bankName?: string; bankIban?: string }>
      : parseSupplierBankAccounts(s.bankNames, {
          accountTitle: String(s.accountTitle ?? ""),
          bankAccountName: legacyBank,
          bankIban: s.bankIban ? String(s.bankIban) : "",
        }),
  )
  const resolvedBanks = bankAccounts.length > 0
    ? bankAccounts
    : parseSupplierBankAccounts(s.bankNames, {
        accountTitle: String(s.accountTitle ?? ""),
        bankAccountName: legacyBank,
        bankIban: s.bankIban ? String(s.bankIban) : "",
      })

  return {
    purchaseScopeId: String(s.purchaseScopeId || "P1").trim().toUpperCase(),
    name: String(s.name ?? ""),
    type: String(s.type ?? "local"),
    contact: String(s.contact ?? ""),
    email: String(s.email ?? ""),
    address: String(s.address ?? ""),
    company: String(s.company ?? ""),
    accountTitle: resolvedBanks[0]?.accountTitle || String(s.accountTitle ?? ""),
    bankNames: resolvedBanks,
    bankAccountName: resolvedBanks[0]?.bankName || legacyBank || null,
    bankIban: resolvedBanks[0]?.bankIban || (s.bankIban ? String(s.bankIban) : null),
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
