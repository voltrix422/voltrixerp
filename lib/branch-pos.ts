export type BranchPosAccount = {
  branchId: string
  branchName: string
  branchCode: string
  email: string
  password: string
  terminalId?: string
  terminalCode?: string
  loginUrl: string
}

export function branchPosEmail(branchCode: string): string {
  return `pos-${branchCode.trim().toLowerCase()}@branch.voltrix`
}

export function branchPosPassword(branchCode: string): string {
  return `Branch${branchCode.trim().toUpperCase()}26`
}

export function branchPosTerminalCode(branchCode: string): string {
  return `POS-${branchCode.trim().toUpperCase()}`
}

export function branchPosLoginUrl(): string {
  return "/pos/login"
}

export function branchPosCashierName(branchName: string): string {
  return `${branchName.trim()} POS`
}

export function branchCodeFromPosEmail(email: string | undefined | null): string | null {
  if (!email) return null
  const m = email.trim().toLowerCase().match(/^pos-(.+)@branch\.voltrix$/)
  return m ? m[1].toUpperCase() : null
}

export function branchPosNotesTag(branchName: string): string {
  return `Branch POS · ${branchName.trim()}`
}

export function isBranchPosDoc(
  doc: { notes?: string; createdBy?: string },
  branchName: string,
  userName: string,
): boolean {
  if (doc.createdBy === userName) return true
  return !!doc.notes?.includes(branchPosNotesTag(branchName))
}
