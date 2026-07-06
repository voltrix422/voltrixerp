import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import {
  branchPosEmail,
  branchPosPassword,
  branchPosTerminalCode,
  branchPosCashierName,
} from "@/lib/branch-pos"

function mapUser(row: {
  id: string
  name: string
  email: string
  password: string
  role: string
  modules: unknown
  managerId: string | null
  branchId: string | null
  location: string
  jobTitle: string
  baseSalary: number
  commissionPercent: number
}) {
  let modules: string[] = []
  if (row.modules) {
    try {
      modules = Array.isArray(row.modules)
        ? (row.modules as string[])
        : JSON.parse(row.modules as string)
    } catch {
      modules = []
    }
  }
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    password: row.password,
    role: row.role,
    modules,
    managerId: row.managerId,
    branchId: row.branchId,
    location: row.location,
    jobTitle: row.jobTitle,
    baseSalary: row.baseSalary,
    commissionPercent: row.commissionPercent,
  }
}

async function ensureBranchPos(branch: {
  id: string
  name: string
  code: string
  status: string
}) {
  const email = branchPosEmail(branch.code)
  const password = branchPosPassword(branch.code)
  const terminalCode = branchPosTerminalCode(branch.code)

  let user = await prisma.erpUser.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
  })
  if (!user) {
    user = await prisma.erpUser.create({
      data: {
        name: branchPosCashierName(branch.name),
        email,
        password,
        role: "user",
        modules: ["pos"],
        branchId: branch.id,
        location: branch.name,
      },
    })
  } else {
    user = await prisma.erpUser.update({
      where: { id: user.id },
      data: {
        password,
        modules: ["pos"],
        branchId: branch.id,
        location: branch.name,
        name: branchPosCashierName(branch.name),
      },
    })
  }

  let terminal = await prisma.erpPosTerminal.findFirst({ where: { branchId: branch.id } })
  if (!terminal) {
    const byCode = await prisma.erpPosTerminal.findUnique({ where: { code: terminalCode } })
    if (byCode) {
      terminal = await prisma.erpPosTerminal.update({
        where: { id: byCode.id },
        data: {
          name: `${branch.name} Counter`,
          location: branch.name,
          branchId: branch.id,
          isActive: branch.status === "active",
        },
      })
    } else {
      terminal = await prisma.erpPosTerminal.create({
        data: {
          name: `${branch.name} Counter`,
          code: terminalCode,
          location: branch.name,
          branchId: branch.id,
          isActive: branch.status === "active",
        },
      })
    }
  }

  return { user, terminal }
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const branchCode = String(body.branchCode || "").trim().toUpperCase()
  const email = String(body.email || "").trim().toLowerCase()
  const password = String(body.password || "")

  if (!branchCode) {
    return NextResponse.json({ error: "Branch code required" }, { status: 400 })
  }

  const branch = await prisma.erpBranch.findFirst({
    where: { code: { equals: branchCode, mode: "insensitive" } },
  })
  if (!branch) {
    return NextResponse.json({ error: "Branch not found" }, { status: 404 })
  }

  const { user } = await ensureBranchPos(branch)

  const loginEmail = email || user.email.toLowerCase()
  const loginPassword = password || branchPosPassword(branch.code)

  if (loginEmail !== user.email.toLowerCase() || loginPassword !== user.password) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 })
  }

  return NextResponse.json({
    ...mapUser(user),
    branchCode: branch.code,
    branchName: branch.name,
  })
}
