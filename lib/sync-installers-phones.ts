import { promises as fs } from "fs"
import type { PrismaClient } from "@prisma/client"
import { syncPhonesFromCsv } from "@/lib/sync-phones-from-csv"
import { getVoltrixInstallersLeadsCsvPath } from "@/lib/voltrix-installers-leads-csv"

export async function readInstallersLeadsCsv(): Promise<string> {
  return fs.readFile(getVoltrixInstallersLeadsCsvPath(), "utf-8")
}

export type SyncInstallersPhonesResult = {
  total: number
  updated: number
  alreadyHad: number
  notMatched: number
  lookupSize: number
}

/** Fill missing phones on CRM leads from the hardcoded Facebook installers CSV. */
export async function syncInstallersPhones(
  prisma: PrismaClient,
  options?: { importBatchId?: string },
): Promise<SyncInstallersPhonesResult> {
  const csvText = await readInstallersLeadsCsv()
  return syncPhonesFromCsv(prisma, csvText, options)
}
