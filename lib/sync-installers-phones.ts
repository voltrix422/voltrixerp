import { promises as fs } from "fs"
import type { PrismaClient } from "@prisma/client"
import {
  buildFacebookLeadPhoneLookup,
  resolvePhoneFromFacebookLookup,
} from "@/lib/csv-leads"
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
  const lookup = buildFacebookLeadPhoneLookup(csvText)

  const leads = await prisma.crmLead.findMany({
    where: options?.importBatchId ? { importBatchId: options.importBatchId } : undefined,
    select: { id: true, name: true, company: true, phone: true },
  })

  let updated = 0
  let alreadyHad = 0
  let notMatched = 0

  for (const lead of leads) {
    const phone = resolvePhoneFromFacebookLookup(lookup, lead.name, lead.company)
    if (!phone) {
      notMatched += 1
      continue
    }
    if (lead.phone?.trim() === phone) {
      alreadyHad += 1
      continue
    }
    if (lead.phone?.trim()) {
      alreadyHad += 1
      continue
    }
    await prisma.crmLead.update({ where: { id: lead.id }, data: { phone } })
    updated += 1
  }

  return {
    total: leads.length,
    updated,
    alreadyHad,
    notMatched,
    lookupSize: lookup.size,
  }
}
