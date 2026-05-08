import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

async function ensureTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS erp_ticket_workflows (
      ticket_id TEXT PRIMARY KEY,
      diagnosis_steps JSONB NOT NULL DEFAULT '[]'::jsonb,
      issue_found BOOLEAN NOT NULL DEFAULT FALSE,
      support_findings TEXT NULL DEFAULT '',
      support_fix TEXT NULL DEFAULT '',
      escalated_to_ground BOOLEAN NOT NULL DEFAULT FALSE,
      ground_staff_notes TEXT NULL DEFAULT '',
      ground_staff_fixed BOOLEAN NOT NULL DEFAULT FALSE,
      support_final_notes TEXT NULL DEFAULT '',
      warranty_claimed BOOLEAN NOT NULL DEFAULT FALSE,
      returned_item TEXT NULL DEFAULT '',
      replacement_item TEXT NULL DEFAULT '',
      replacement_invoice_number TEXT NULL DEFAULT '',
      replacement_dispatch_note_number TEXT NULL DEFAULT '',
      updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `)
}

export async function GET(req: NextRequest) {
  try {
    await ensureTable()
    const { searchParams } = new URL(req.url)
    const ticketId = searchParams.get("ticketId")
    if (!ticketId) return NextResponse.json({ error: "ticketId required" }, { status: 400 })

    const rows = await prisma.$queryRawUnsafe(
      `
      SELECT
        ticket_id AS "ticketId",
        diagnosis_steps AS "diagnosisSteps",
        issue_found AS "issueFound",
        support_findings AS "supportFindings",
        support_fix AS "supportFix",
        escalated_to_ground AS "escalatedToGround",
        ground_staff_notes AS "groundStaffNotes",
        ground_staff_fixed AS "groundStaffFixed",
        support_final_notes AS "supportFinalNotes",
        warranty_claimed AS "warrantyClaimed",
        returned_item AS "returnedItem",
        replacement_item AS "replacementItem",
        replacement_invoice_number AS "replacementInvoiceNumber",
        replacement_dispatch_note_number AS "replacementDispatchNoteNumber",
        updated_at AS "updatedAt"
      FROM erp_ticket_workflows
      WHERE ticket_id = $1
      LIMIT 1
      `,
      ticketId
    ) as Array<Record<string, unknown>>

    if (rows.length === 0) {
      return NextResponse.json({
        ticketId,
        diagnosisSteps: [],
        issueFound: false,
        supportFindings: "",
        supportFix: "",
        escalatedToGround: false,
        groundStaffNotes: "",
        groundStaffFixed: false,
        supportFinalNotes: "",
        warrantyClaimed: false,
        returnedItem: "",
        replacementItem: "",
        replacementInvoiceNumber: "",
        replacementDispatchNoteNumber: "",
      })
    }

    return NextResponse.json(rows[0])
  } catch (error) {
    console.error("Failed to fetch ticket workflow:", error)
    return NextResponse.json({ error: "failed_to_fetch_workflow" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureTable()
    const body = await req.json()
    if (!body.ticketId) return NextResponse.json({ error: "ticketId required" }, { status: 400 })

    await prisma.$executeRawUnsafe(
      `
      INSERT INTO erp_ticket_workflows (
        ticket_id, diagnosis_steps, issue_found, support_findings, support_fix,
        escalated_to_ground, ground_staff_notes, ground_staff_fixed, support_final_notes,
        warranty_claimed, returned_item, replacement_item, replacement_invoice_number,
        replacement_dispatch_note_number, updated_at
      ) VALUES (
        $1, $2::jsonb, $3, $4, $5,
        $6, $7, $8, $9,
        $10, $11, $12, $13,
        $14, CURRENT_TIMESTAMP
      )
      ON CONFLICT (ticket_id) DO UPDATE SET
        diagnosis_steps = EXCLUDED.diagnosis_steps,
        issue_found = EXCLUDED.issue_found,
        support_findings = EXCLUDED.support_findings,
        support_fix = EXCLUDED.support_fix,
        escalated_to_ground = EXCLUDED.escalated_to_ground,
        ground_staff_notes = EXCLUDED.ground_staff_notes,
        ground_staff_fixed = EXCLUDED.ground_staff_fixed,
        support_final_notes = EXCLUDED.support_final_notes,
        warranty_claimed = EXCLUDED.warranty_claimed,
        returned_item = EXCLUDED.returned_item,
        replacement_item = EXCLUDED.replacement_item,
        replacement_invoice_number = EXCLUDED.replacement_invoice_number,
        replacement_dispatch_note_number = EXCLUDED.replacement_dispatch_note_number,
        updated_at = CURRENT_TIMESTAMP
      `,
      body.ticketId,
      JSON.stringify(Array.isArray(body.diagnosisSteps) ? body.diagnosisSteps : []),
      Boolean(body.issueFound),
      body.supportFindings || "",
      body.supportFix || "",
      Boolean(body.escalatedToGround),
      body.groundStaffNotes || "",
      Boolean(body.groundStaffFixed),
      body.supportFinalNotes || "",
      Boolean(body.warrantyClaimed),
      body.returnedItem || "",
      body.replacementItem || "",
      body.replacementInvoiceNumber || "",
      body.replacementDispatchNoteNumber || ""
    )

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Failed to save ticket workflow:", error)
    return NextResponse.json({ error: "failed_to_save_workflow" }, { status: 500 })
  }
}
