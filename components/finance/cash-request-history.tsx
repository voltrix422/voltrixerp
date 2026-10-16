"use client"

import { cashRequestStatusLabel, paymentMethodLabel, type CashRequest } from "@/lib/finance-cash-requests"

function tone(status: string) {
  if (status === "approved") return "text-emerald-600"
  if (status === "rejected") return "text-red-600"
  return "text-amber-600"
}

export function CashRequestHistory({ rows }: { rows: CashRequest[] }) {
  if (!rows.length) {
    return <p className="text-xs text-[hsl(var(--muted-foreground))]">No cash requests yet.</p>
  }

  return (
    <div className="overflow-x-auto border rounded-lg">
      <table className="w-full text-xs min-w-[720px]">
        <thead>
          <tr className="text-left border-b bg-[hsl(var(--muted))]/30">
            <th className="px-2.5 py-2 font-medium">Needed</th>
            <th className="px-2.5 py-2 font-medium">Amount</th>
            <th className="px-2.5 py-2 font-medium">Purpose</th>
            <th className="px-2.5 py-2 font-medium">Details</th>
            <th className="px-2.5 py-2 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b last:border-0 align-top">
              <td className="px-2.5 py-2 whitespace-nowrap">
                {r.neededOn}
                <div className="text-[10px] text-[hsl(var(--muted-foreground))]">
                  {paymentMethodLabel(r.paymentMethod)}
                </div>
              </td>
              <td className="px-2.5 py-2 tabular-nums whitespace-nowrap">
                {r.currency} {r.amount.toLocaleString()}
              </td>
              <td className="px-2.5 py-2">
                <p>{r.purpose}</p>
                <p className="text-[10px] text-[hsl(var(--muted-foreground))]">{r.category}</p>
              </td>
              <td className="px-2.5 py-2">
                {r.itemBreakdown.map((l) => (
                  <p key={l.id}>
                    {l.description} — {r.currency} {l.amount.toLocaleString()}
                  </p>
                ))}
                {r.adminNotes ? (
                  <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-1">Admin: {r.adminNotes}</p>
                ) : null}
              </td>
              <td className={`px-2.5 py-2 font-medium ${tone(r.status)}`}>{cashRequestStatusLabel(r.status)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
