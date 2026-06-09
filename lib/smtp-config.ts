export type SmtpProvider = "hostinger" | "gmail"

const PROVIDER_DEFAULTS: Record<SmtpProvider, { host: string; port: number }> = {
  hostinger: { host: "smtp.hostinger.com", port: 587 },
  gmail: { host: "smtp.gmail.com", port: 587 },
}

export type ResolvedSmtpConfig = {
  provider: SmtpProvider | "custom"
  host: string
  port: number
  secure: boolean
  user: string
  pass: string
  from: string
}

function normalizeProvider(raw: string | undefined): SmtpProvider | null {
  const value = raw?.trim().toLowerCase()
  if (value === "hostinger") return "hostinger"
  if (value === "gmail") return "gmail"
  return null
}

export function resolveSmtpConfig(): ResolvedSmtpConfig | null {
  const provider = normalizeProvider(process.env.SMTP_PROVIDER)
  const defaults = provider ? PROVIDER_DEFAULTS[provider] : null

  const host = process.env.SMTP_HOST?.trim() || defaults?.host || ""
  const port = Number(process.env.SMTP_PORT || defaults?.port || 587)
  const user = process.env.SMTP_USER?.trim() || ""
  const pass = process.env.SMTP_PASS || ""

  if (!host || !user || !pass) return null

  return {
    provider: provider || "custom",
    host,
    port,
    secure: port === 465,
    user,
    pass,
    from: process.env.SMTP_FROM?.trim() || user,
  }
}

export function getSmtpStatus() {
  const config = resolveSmtpConfig()
  if (!config) {
    return {
      configured: false as const,
      provider: null,
      host: null,
      port: null,
      from: null,
      user: null,
    }
  }

  const maskedUser = config.user.replace(/(^.).*(@.*$)/, "$1***$2")

  return {
    configured: true as const,
    provider: config.provider,
    host: config.host,
    port: config.port,
    from: config.from,
    user: maskedUser,
  }
}
