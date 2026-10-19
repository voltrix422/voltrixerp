"use client"

import { cashRequestStatusLabel, type CashRequest } from "@/lib/finance-cash-requests"

function tone(status: string) {
  if (status === "approved") return "text-emerald-600"
  if (status === "rejected") return "text-red-600"
  return "text-amber-600"
}

function fmtDay(iso: string) {
  const day = (iso || "").slice(0, 10)
  const [y, m, d] = day.split("-")
  if (!y || !m || !d) return iso || "—"
  return `${d}/${m}/${y}`
}

export function CashRequestHistory({ rows }: { rows: CashRequest[] }) {
  if (!rows.length) {
    return <p className="text-xs text-[hsl(var(--muted-foreground))]">No requests yet.</p>
  }

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold">My history</p>
      <div className="overflow-x-auto border rounded-lg">
        <table className="w-full text-xs min-w-[520px]">
          <thead>
            <tr className="text-left border-b bg-[hsl(var(--muted))]/30">
              <th className="px-2.5 py-2 font-medium">Date</th>
              <th className="px-2.5 py-2 font-medium">Amount</th>
              <th className="px-2.5 py-2 font-medium">Description</th>
              <th className="px-2.5 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b last:border-0 align-top">
                <td className="px-2.5 py-2 whitespace-nowrap">{fmtDay(r.createdAt)}</td>
                <td className="px-2.5 py-2 tabular-nums whitespace-nowrap">
                  PKR {r.amount.toLocaleString()}
                </td>
                <td className="px-2.5 py-2">
                  <p>{r.purpose}</p>
                  {r.adminNotes ? (
                    <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-0.5">Admin: {r.adminNotes}</p>
                  ) : null}
                </td>
                <td className={`px-2.5 py-2 font-medium ${tone(r.status)}`}>{cashRequestStatusLabel(r.status)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
