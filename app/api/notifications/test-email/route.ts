import { NextRequest, NextResponse } from "next/server"
import { sendNotificationEmail } from "@/lib/email"

export async function POST(req: NextRequest) {
  const body = await req.json()
  const emails = Array.isArray(body.emails)
    ? body.emails.map((e: unknown) => String(e).trim()).filter(Boolean)
    : []

  if (!emails.length) {
    return NextResponse.json({ error: "At least one email is required" }, { status: 400 })
  }

  const result = await sendNotificationEmail({
    to: emails,
    subject: "[Voltrix ERP] Test notification",
    title: "Test notification",
    message:
      "If you received this email, SMTP is working. Alerts will be delivered to your custom notification addresses — Gmail, Hostinger, Outlook, or any other provider.",
    link: "/settings",
  })

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 })
  }

  return NextResponse.json({
    ok: true,
    sentTo: emails,
    message: `Test email sent to ${emails.join(", ")}`,
  })
}
