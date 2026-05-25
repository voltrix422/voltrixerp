import { NextResponse } from "next/server"

export function acctError(e: unknown, status = 500) {
  const message = e instanceof Error ? e.message : String(e)
  const needsMigration =
    /does not exist|relation.*acct_|P2021|P2010|Unknown table/i.test(message)
  return NextResponse.json(
    {
      error: message,
      needsMigration,
      hint: needsMigration
        ? "On the server run: cd /var/www/erpvoltrix && npx prisma migrate deploy && pm2 restart voltrix-erp"
        : undefined,
    },
    { status }
  )
}

export async function withAcctApi(handler: () => Promise<NextResponse>) {
  try {
    return await handler()
  } catch (e) {
    return acctError(e)
  }
}
