import nodemailer from "nodemailer"
import { resolveSmtpConfig } from "@/lib/smtp-config"

export type EmailPayload = {
  to: string[]
  subject: string
  title: string
  message: string
  link?: string
}

export type SendEmailResult = {
  ok: boolean
  error?: string
}

function buildHtml(payload: EmailPayload) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"
  const link = payload.link
    ? payload.link.startsWith("http")
      ? payload.link
      : `${baseUrl}${payload.link}`
    : baseUrl

  return `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
      <div style="border-bottom:3px solid #1a9f9a;padding-bottom:12px;margin-bottom:20px;">
        <strong style="font-size:18px;color:#111;">Voltrix ERP</strong>
      </div>
      <h2 style="margin:0 0 12px;font-size:16px;color:#111;">${payload.title}</h2>
      <p style="margin:0 0 16px;font-size:14px;color:#444;line-height:1.5;">${payload.message}</p>
      ${
        payload.link
          ? `<a href="${link}" style="display:inline-block;background:#1a9f9a;color:#fff;text-decoration:none;padding:10px 16px;border-radius:6px;font-size:13px;">Open in ERP</a>`
          : ""
      }
      <p style="margin:24px 0 0;font-size:11px;color:#999;">This is an automated notification from Voltrix ERP.</p>
    </div>
  `
}

export async function sendNotificationEmail(payload: EmailPayload): Promise<SendEmailResult> {
  const recipients = payload.to
    .map(e => e.trim().toLowerCase())
    .filter(Boolean)

  if (!recipients.length) {
    return { ok: false, error: "No recipient emails provided" }
  }

  const smtp = resolveSmtpConfig()
  if (!smtp) {
    return {
      ok: false,
      error: "SMTP is not configured. Set SMTP_PROVIDER and SMTP_USER / SMTP_PASS in .env",
    }
  }

  try {
    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: {
        user: smtp.user,
        pass: smtp.pass,
      },
    })

    await transporter.sendMail({
      from: `Voltrix ERP <${smtp.from}>`,
      to: recipients.join(", "),
      subject: payload.subject,
      html: buildHtml(payload),
      text: `${payload.title}\n\n${payload.message}${payload.link ? `\n\n${payload.link}` : ""}`,
    })
    return { ok: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown email error"
    console.error("[email] send failed:", err)
    return { ok: false, error: message }
  }
}

export function isSmtpConfigured() {
  return resolveSmtpConfig() !== null
}
