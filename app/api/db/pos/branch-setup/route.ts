import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import {
  branchPosCashierName,
  branchPosEmail,
  branchPosLoginUrl,
  branchPosPassword,
  branchPosTerminalCode,
  type BranchPosAccount,
} from "@/lib/branch-pos"

async function ensureBranchPos(branch: {
  id: string
  name: string
  code: string
  status: string
}): Promise<BranchPosAccount> {
  const email = branchPosEmail(branch.code)
  const password = branchPosPassword(branch.code)
  const terminalCode = branchPosTerminalCode(branch.code)

  let user = await prisma.erpUser.findUnique({ where: { email } })
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
        name: branchPosCashierName(branch.name),
        password,
        modules: ["pos"],
        branchId: branch.id,
        location: branch.name,
      },
    })
  }

  let terminal = await prisma.erpPosTerminal.findFirst({
    where: { branchId: branch.id },
  })
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
  } else {
    terminal = await prisma.erpPosTerminal.update({
      where: { id: terminal.id },
      data: {
        name: `${branch.name} Counter`,
        location: branch.name,
        isActive: branch.status === "active",
      },
    })
  }

  return {
    branchId: branch.id,
    branchName: branch.name,
    branchCode: branch.code,
    email,
    password,
    terminalId: terminal.id,
    terminalCode: terminal.code,
    loginUrl: branchPosLoginUrl(),
  }
}

export async function GET() {
  const branches = await prisma.erpBranch.findMany({
    where: { status: "active" },
    orderBy: { name: "asc" },
  })

  const accounts: BranchPosAccount[] = []
  for (const branch of branches) {
    const email = branchPosEmail(branch.code)
    const user = await prisma.erpUser.findUnique({ where: { email } })
    const terminal = await prisma.erpPosTerminal.findFirst({
      where: { branchId: branch.id },
    })
    accounts.push({
      branchId: branch.id,
      branchName: branch.name,
      branchCode: branch.code,
      email,
      password: user?.password ?? branchPosPassword(branch.code),
      terminalId: terminal?.id,
      terminalCode: terminal?.code,
      loginUrl: branchPosLoginUrl(),
    })
  }

  return NextResponse.json(accounts)
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const branchId = typeof body.branchId === "string" ? body.branchId.trim() : ""
  const branchCode = typeof body.branchCode === "string" ? body.branchCode.trim().toUpperCase() : ""

  const branches = branchId || branchCode
    ? await prisma.erpBranch.findMany({
        where: branchId ? { id: branchId } : { code: branchCode },
      })
    : await prisma.erpBranch.findMany({
        where: { status: "active" },
        orderBy: { name: "asc" },
      })

  if (branches.length === 0) {
    return NextResponse.json({ error: "No matching branches found" }, { status: 404 })
  }

  const accounts: BranchPosAccount[] = []
  for (const branch of branches) {
    accounts.push(await ensureBranchPos(branch))
  }

  return NextResponse.json({ ok: true, accounts })
}
