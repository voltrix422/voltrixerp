import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { ensureDefaultInvestorUser } from "@/lib/ensure-investor-user"
import {
  investorRoiEndDate,
  normalizeInvestorInvestedAt,
  normalizeInvestorRoiPeriod,
} from "@/lib/investor-payout"

function normalizeEmail(raw: unknown) {
  return String(raw ?? "").trim().toLowerCase()
}

export async function GET() {
  await ensureDefaultInvestorUser()
  const users = await prisma.erpUser.findMany({ orderBy: { id: "asc" } })
  return NextResponse.json(users)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const role = String(body.role || "user").trim()
    if (role.toLowerCase() === "investor") {
      body.modules = ["dashboard", "crm"]
    }
    if (
      role.toLowerCase() === "installments" ||
      role.toLowerCase() === "china_money_admin" ||
      role.toLowerCase() === "china_money_view"
    ) {
      body.modules = []
    }

    const email = normalizeEmail(body.email)
    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 })
    }

    const investedAt = normalizeInvestorInvestedAt(body.investorInvestedAt)
    let investedUntil = normalizeInvestorInvestedAt(body.investorInvestedUntil)
    const roiPeriod = normalizeInvestorRoiPeriod(body.investorRoiPeriod)
    if (investedAt && !investedUntil) {
      investedUntil = investorRoiEndDate(investedAt, roiPeriod)
    }

    const payload = {
      name: String(body.name || "").trim() || email,
      email,
      password: String(body.password ?? ""),
      role,
      modules: body.modules ?? [],
      managerId: body.managerId ?? null,
      location: body.location ?? "",
      jobTitle: body.jobTitle ?? "field_sales_officer",
      baseSalary: body.baseSalary ?? 25000,
      commissionPercent: body.commissionPercent ?? 0.5,
      notificationEmails: body.notificationEmails ?? [],
      emailNotificationsEnabled: body.emailNotificationsEnabled !== false,
      branchId: body.branchId ?? null,
      purchaseScopes: body.purchaseScopes ?? [],
      investorInvestment: Number(body.investorInvestment) || 0,
      investorRoiPercent: Number(body.investorRoiPercent) || 0,
      investorRoiPeriod: roiPeriod,
      investorInvestedAt: investedAt,
      investorInvestedUntil: investedUntil,
    }

    const bodyId = String(body.id || "").trim()
    const existingById = bodyId
      ? await prisma.erpUser.findUnique({ where: { id: bodyId } })
      : null
    const existingByEmail = await prisma.erpUser.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
    })

    // Same email already exists under another id → convert that account (keeps email/password login).
    if (existingByEmail && (!existingById || existingByEmail.id !== existingById.id)) {
      if (existingById && existingById.id !== existingByEmail.id) {
        return NextResponse.json(
          {
            error: `Email ${email} is already used by ${existingByEmail.name}. Use that account or pick another email.`,
            existingUserId: existingByEmail.id,
          },
          { status: 409 },
        )
      }
      const converted = await prisma.erpUser.update({
        where: { id: existingByEmail.id },
        data: payload,
      })
      return NextResponse.json({ ...converted, _converted: true })
    }

    if (existingById) {
      const user = await prisma.erpUser.update({
        where: { id: existingById.id },
        data: payload,
      })
      return NextResponse.json(user)
    }

    const user = await prisma.erpUser.create({
      data: {
        id: bodyId || undefined,
        ...payload,
      },
    })
    return NextResponse.json(user)
  } catch (err) {
    console.error("users POST", err)
    const message = err instanceof Error ? err.message : "Failed to save user"
    if (/unique|email/i.test(message)) {
      return NextResponse.json(
        { error: "That email is already in use. Pick another or convert the existing account." },
        { status: 409 },
      )
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  await prisma.erpUser.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
