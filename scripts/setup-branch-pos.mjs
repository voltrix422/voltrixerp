#!/usr/bin/env node
/**
 * Create or refresh branch POS cashier accounts and terminals.
 * Usage: node scripts/setup-branch-pos.mjs [--branch BR011]
 */
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

function branchPosEmail(code) {
  return `pos-${code.trim().toLowerCase()}@branch.voltrix`
}

function branchPosPassword(code) {
  return `Branch${code.trim().toUpperCase()}26`
}

function branchPosTerminalCode(code) {
  return `POS-${code.trim().toUpperCase()}`
}

async function ensureBranchPos(branch) {
  const email = branchPosEmail(branch.code)
  const password = branchPosPassword(branch.code)
  const terminalCode = branchPosTerminalCode(branch.code)

  let user = await prisma.erpUser.findUnique({ where: { email } })
  if (!user) {
    user = await prisma.erpUser.create({
      data: {
        name: `${branch.name} POS`,
        email,
        password,
        role: "user",
        modules: ["pos"],
        branchId: branch.id,
        location: branch.name,
      },
    })
    console.log(`  + user ${email}`)
  } else {
    await prisma.erpUser.update({
      where: { id: user.id },
      data: { password, branchId: branch.id, modules: ["pos"], location: branch.name },
    })
    console.log(`  ~ user ${email}`)
  }

  let terminal = await prisma.erpPosTerminal.findFirst({ where: { branchId: branch.id } })
  if (!terminal) {
    const byCode = await prisma.erpPosTerminal.findUnique({ where: { code: terminalCode } })
    if (byCode) {
      terminal = await prisma.erpPosTerminal.update({
        where: { id: byCode.id },
        data: { branchId: branch.id, name: `${branch.name} Counter`, location: branch.name },
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
    console.log(`  + terminal ${terminal.code}`)
  } else {
    console.log(`  = terminal ${terminal.code}`)
  }

  return { email, password, terminalCode: terminal.code }
}

async function main() {
  const branchArg = process.argv.find((a) => a.startsWith("--branch="))?.split("=")[1]
    || (process.argv.includes("--branch") ? process.argv[process.argv.indexOf("--branch") + 1] : null)

  const branches = branchArg
    ? await prisma.erpBranch.findMany({ where: { code: branchArg.toUpperCase() } })
    : await prisma.erpBranch.findMany({ where: { status: "active" }, orderBy: { name: "asc" } })

  if (branches.length === 0) {
    console.error("No branches found.")
    process.exit(1)
  }

  console.log(`Setting up POS for ${branches.length} branch(es)…`)
  for (const branch of branches) {
    console.log(`\n${branch.name} (${branch.code})`)
    const creds = await ensureBranchPos(branch)
    console.log(`  Login: ${creds.email} / ${creds.password}`)
  }
  console.log("\nDone.")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
