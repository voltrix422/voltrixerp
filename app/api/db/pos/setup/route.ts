import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import {
  DEFAULT_POS_EMAIL,
  DEFAULT_POS_PASSWORD,
  DEFAULT_POS_NAME,
  DEFAULT_TERMINAL_CODE,
  DEFAULT_TERMINAL_NAME,
} from "@/lib/pos-defaults"

export async function POST() {
  let userCreated = false
  let terminalCreated = false

  const existingUser = await prisma.erpUser.findUnique({
    where: { email: DEFAULT_POS_EMAIL },
  })

  if (!existingUser) {
    await prisma.erpUser.create({
      data: {
        name: DEFAULT_POS_NAME,
        email: DEFAULT_POS_EMAIL,
        password: DEFAULT_POS_PASSWORD,
        role: "user",
        modules: ["pos"],
      },
    })
    userCreated = true
  } else {
    const modules = Array.isArray(existingUser.modules)
      ? (existingUser.modules as string[])
      : []
    if (!modules.includes("pos")) {
      await prisma.erpUser.update({
        where: { id: existingUser.id },
        data: { modules: [...modules, "pos"] },
      })
    }
  }

  const terminalCount = await prisma.erpPosTerminal.count()
  if (terminalCount === 0) {
    await prisma.erpPosTerminal.create({
      data: {
        name: DEFAULT_TERMINAL_NAME,
        code: DEFAULT_TERMINAL_CODE,
        location: "Head office",
        isActive: true,
      },
    })
    terminalCreated = true
  }

  return NextResponse.json({
    ok: true,
    userCreated,
    terminalCreated,
    defaultEmail: DEFAULT_POS_EMAIL,
    defaultPassword: DEFAULT_POS_PASSWORD,
  })
}
