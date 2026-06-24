/**
 * Backfill outreach logs for leads whose status was changed before we
 * auto-logged status updates (non-"new" status but zero contact logs).
 *
 * Usage (from erpvoltrix app folder):
 *   node scripts/backfill-lead-status-outreach.mjs --dry-run
 *   node scripts/backfill-lead-status-outreach.mjs --by Furqan --date 2026-06-23
 *   node scripts/backfill-lead-status-outreach.mjs --import-name "Lahore Expo" --by Furqan --date 2026-06-23
 *   node scripts/backfill-lead-status-outreach.mjs --import-batch-id <uuid> --by Furqan
 */
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import { createRequire } from "module"

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, "..")

for (const f of [".env.local", ".env"]) {
  const p = path.join(root, f)
  if (!fs.existsSync(p)) continue
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m && !process.env[m[1].trim()]) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "")
  }
}

const { PrismaClient } = require("@prisma/client")

const STATUS_LABELS = {
  new: "New",
  contacted: "Contacted",
  interested: "Interested",
  not_interested: "Not interested",
  price_negotiable: "Price negotiable",
  not_closed: "Not closed",
  on_hold: "Not closed",
  pending: "Pending",
  not_responded: "Not responded",
  responded: "Responded",
  closed: "Closed",
}

function parseArgs(argv) {
  const out = {
    dryRun: false,
    by: null,
    userId: null,
    date: null,
    importBatchId: null,
    importName: null,
    all: false,
  }
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    if (a === "--dry-run") out.dryRun = true
    else if (a === "--all") out.all = true
    else if (a === "--by" && argv[i + 1]) out.by = argv[++i]
    else if (a === "--user-id" && argv[i + 1]) out.userId = argv[++i]
    else if (a === "--date" && argv[i + 1]) out.date = argv[++i]
    else if (a === "--import-batch-id" && argv[i + 1]) out.importBatchId = argv[++i]
    else if (a === "--import-name" && argv[i + 1]) out.importName = argv[++i]
    else if (a === "--help" || a === "-h") out.help = true
  }
  return out
}

function statusLabel(status) {
  return STATUS_LABELS[status] ?? status.replace(/_/g, " ")
}

function contactedAtForLead(lead, dateArg) {
  if (dateArg) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateArg.trim())
    if (!m) throw new Error(`Invalid --date ${dateArg} (use YYYY-MM-DD)`)
    const y = Number(m[1])
    const mo = Number(m[2])
    const d = Number(m[3])
    // Stagger by lead id hash so bulk backfill does not collapse to one timestamp.
    const slot = [...lead.id].reduce((n, c) => n + c.charCodeAt(0), 0) % (8 * 60)
    const hour = 9 + Math.floor(slot / 60)
    const minute = slot % 60
    return new Date(Date.UTC(y, mo - 1, d, hour, minute, 0, 0))
  }
  return lead.importedAt
}

function printHelp() {
  console.log(`Backfill outreach logs for old status-only lead updates.

Targets leads where status is not "new" but there are zero outreach logs.

Options:
  --dry-run                 Preview only; no database writes
  --all                     All matching leads (default without batch filter)
  --by <name>               Attributed team member (default: lead.createdBy)
  --user-id <id>            ErpUser id for contactedById (auto-resolved from --by if omitted)
  --date YYYY-MM-DD         contactedAt day for stats (default: lead.importedAt)
  --import-batch-id <id>    Limit to one CSV import batch
  --import-name <text>      Limit to imports whose name contains this text

Examples:
  node scripts/backfill-lead-status-outreach.mjs --dry-run --import-name "Lahore Expo"
  node scripts/backfill-lead-status-outreach.mjs --import-name "Lahore Expo" --by Furqan --date 2026-06-23
`)
}

async function resolveUserId(prisma, byName, explicitId) {
  if (explicitId) return explicitId
  if (!byName) return null
  const user = await prisma.erpUser.findFirst({
    where: { name: { equals: byName, mode: "insensitive" } },
    select: { id: true, name: true },
  })
  return user?.id ?? null
}

async function main() {
  const args = parseArgs(process.argv)
  if (args.help) {
    printHelp()
    return
  }

  const prisma = new PrismaClient()
  try {
    const where = {
      status: { not: "new" },
      contacts: { none: {} },
    }
    if (args.importBatchId) where.importBatchId = args.importBatchId
    if (args.importName) {
      where.importUploaderName = { contains: args.importName, mode: "insensitive" }
    }

    const leads = await prisma.crmLead.findMany({
      where,
      orderBy: { importedAt: "asc" },
      select: {
        id: true,
        name: true,
        status: true,
        importedAt: true,
        createdBy: true,
        createdById: true,
        importUploaderName: true,
        importBatchId: true,
      },
    })

    if (leads.length === 0) {
      console.log("No leads need backfill (non-new status with zero outreach logs).")
      return
    }

    const defaultUserId = await resolveUserId(prisma, args.by, args.userId)
    const byPreview = args.by ?? "(lead.createdBy per row)"

    console.log(`Found ${leads.length} lead(s) to backfill.`)
    console.log(`Attributed to: ${byPreview}${defaultUserId ? ` (user id ${defaultUserId})` : ""}`)
    console.log(`Date: ${args.date ?? "(each lead importedAt)"}`)
    if (args.dryRun) console.log("DRY RUN — no writes.\n")

    let created = 0
    for (const lead of leads) {
      const contactedBy = (args.by ?? lead.createdBy ?? "Unknown").trim() || "Unknown"
      const contactedById = defaultUserId ?? lead.createdById ?? null
      const contactedAt = contactedAtForLead(lead, args.date)
      const notes = `Status backfill: ${statusLabel(lead.status)}`

      console.log(
        `- ${lead.name} | ${statusLabel(lead.status)} | ${lead.importUploaderName ?? "—"} | ${contactedBy} @ ${contactedAt.toISOString()}`,
      )

      if (!args.dryRun) {
        await prisma.crmLeadContact.create({
          data: {
            leadId: lead.id,
            contactedBy,
            contactedById,
            contactedAt,
            notes,
          },
        })
        created++
      }
    }

    console.log(args.dryRun ? `\nWould create ${leads.length} outreach log(s).` : `\nCreated ${created} outreach log(s).`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
