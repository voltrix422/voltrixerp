import type { PrismaClient } from "@prisma/client"
import {
  buildFacebookLeadPhoneLookup,
  resolvePhoneFromFacebookLookup,
} from "@/lib/csv-leads"

export type SyncPhonesFromCsvResult = {
  total: number
  updated: number
  alreadyHad: number
  notMatched: number
  lookupSize: number
}

/** Fill empty phone fields on leads using PHONE column from an uploaded Facebook CSV. */
export async function syncPhonesFromCsv(
  prisma: PrismaClient,
  csvText: string,
  options?: { importBatchId?: string },
): Promise<SyncPhonesFromCsvResult> {
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
