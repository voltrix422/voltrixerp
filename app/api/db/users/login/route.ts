import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

function mapRow(row: Record<string, unknown>): any {
  let modules: string[] = []
  if (row.modules) {
    try {
      if (typeof row.modules === 'string') {
        modules = JSON.parse(row.modules as string)
      } else {
        modules = row.modules as string[]
      }
    } catch (e) {
      modules = []
    }
  }

  return {
    id: row.id as string,
    name: row.name as string,
    email: row.email as string,
    password: row.password as string,
    role: row.role as string,
    modules,
    managerId: row.managerId ?? null,
    branchId: row.branchId ?? null,
    location: row.location ?? "",
    jobTitle: row.jobTitle ?? "",
    baseSalary: row.baseSalary ?? 0,
    commissionPercent: row.commissionPercent ?? 0,
  }
}

export async function POST(req: NextRequest) {
  const { email, password } = await req.json()
  const user = await prisma.erpUser.findFirst({
    where: {
      email: { equals: String(email || "").trim(), mode: "insensitive" },
      password: String(password || ""),
    },
  })
  if (!user) return NextResponse.json(null)
  return NextResponse.json(mapRow(user))
}
