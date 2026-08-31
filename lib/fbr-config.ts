export type FbrEnv = "sandbox" | "production"

export type FbrConfig = {
  token: string
  env: FbrEnv
  configured: boolean
  postUrl: string
  sellerNTN: string
  sellerBusinessName: string
  sellerProvince: string
  sellerAddress: string
  defaultHsCode: string
  sandboxScenarioId: string
}

const SANDBOX_POST_URL = "https://gw.fbr.gov.pk/di_data/v1/di/postinvoicedata_sb"
const PRODUCTION_POST_URL = "https://gw.fbr.gov.pk/di_data/v1/di/postinvoicedata"

export function getFbrConfig(): FbrConfig {
  const token = String(process.env.FBR_TOKEN || "").trim()
  const env: FbrEnv =
    String(process.env.FBR_ENV || "").trim().toLowerCase() === "production"
      ? "production"
      : "sandbox"
  const sellerNTN = String(process.env.FBR_SELLER_NTN || process.env.FBR_NTN || "").trim()
  return {
    token,
    env,
    configured: Boolean(token && sellerNTN),
    postUrl: env === "production" ? PRODUCTION_POST_URL : SANDBOX_POST_URL,
    sellerNTN,
    sellerBusinessName:
      String(process.env.FBR_SELLER_NAME || "").trim() ||
      "VOLTRIX BATTERIES (PRIVATE) LIMITED",
    sellerProvince:
      String(process.env.FBR_SELLER_PROVINCE || "").trim() ||
      "Islamabad Capital Territory",
    sellerAddress:
      String(process.env.FBR_SELLER_ADDRESS || "").trim() ||
      "Plot 73, Street 14, I-9/2, Islamabad",
    defaultHsCode: String(process.env.FBR_DEFAULT_HS_CODE || "").trim() || "8507.6000",
    sandboxScenarioId: String(process.env.FBR_SANDBOX_SCENARIO_ID || "").trim(),
  }
}

export function fbrNotConfiguredReason(config: FbrConfig): string {
  if (!config.token) return "FBR not configured (missing FBR_TOKEN)"
  if (!config.sellerNTN) return "FBR not configured (missing FBR_SELLER_NTN)"
  return "FBR not configured"
}
