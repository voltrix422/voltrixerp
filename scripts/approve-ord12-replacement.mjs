/**
 * Approve ORD-00012 pending replacement via local API (after deploy).
 * Run on VPS: node scripts/approve-ord12-replacement.mjs
 */
const orderId = "1780324647024"
const replacementId = "repl-1791275119595"

const bases = [
  "http://127.0.0.1:3000",
  "http://127.0.0.1:3001",
  "http://localhost:3000",
]

let lastErr = ""
for (const base of bases) {
  try {
    const res = await fetch(`${base}/api/db/orders/replace-item/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId,
        replacementId,
        decision: "approved",
        reviewedBy: "system-fix-stuck",
        note: "Approved after Approvals list bug (null source excluded)",
      }),
      signal: AbortSignal.timeout(60000),
    })
    const text = await res.text()
    console.log(base, res.status, text.slice(0, 1500))
    if (res.ok) process.exit(0)
    lastErr = text
  } catch (e) {
    lastErr = e instanceof Error ? e.message : String(e)
    console.log(base, "fail", lastErr)
  }
}
console.error("Approve failed", lastErr)
process.exit(1)
