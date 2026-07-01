"use client"
import { useState } from "react"
import { type PurchaseOrder, type PaymentRecord } from "@/lib/purchase"
import { uploadFile } from "@/lib/upload"
import { Button } from "@/components/ui/button"
import { useDialog } from "@/components/ui/dialog-provider"

interface Props {
  po: PurchaseOrder
  onUpdate: (updated: PurchaseOrder) => void
}

export function PoAdminPaymentPanel({ po, onUpdate }: Props) {
  const { alert } = useDialog()
  const [payments, setPayments] = useState<PaymentRecord[]>(po.payments || [])
  const [amount, setAmount] = useState("")
  const [method, setMethod] = useState("bank_transfer")
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState("")
  const [proofFile, setProofFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)

  async function addPayment() {
    if (!amount || Number(amount) <= 0) return
    setUploading(true)
    let proofUrl: string | undefined
    if (proofFile) {
      try {
        proofUrl = await uploadFile(proofFile, "payment-proofs")
      } catch {}
    }
    setPayments((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        amount: Number(amount),
        method,
        date,
        notes,
        proofUrl,
        createdAt: new Date().toISOString(),
      },
    ])
    setAmount("")
    setNotes("")
    setProofFile(null)
    setUploading(false)
  }

  async function sendToFinance() {
    if (payments.length === 0) {
      await alert({
        type: "error",
        title: "Payment Required",
        message: "Add at least one payment before sending to Finance for record.",
      })
      return
    }
    setSaving(true)
    onUpdate({
      ...po,
      payments,
      status: "pending_finance_record",
      flowHistory: [
        ...(po.flowHistory || []),
        {
          step: "pending_finance_record",
          note: "Admin added payment and sent to Finance for record",
          actor: "Admin",
          doneAt: new Date().toISOString(),
        },
      ],
    })
    setSaving(false)
  }

  return (
    <div className="rounded-xl border border-[hsl(var(--primary))]/20 bg-[hsl(var(--primary))]/5 p-5 space-y-4">
      <div>
        <p className="text-sm font-semibold">Admin Payment</p>
        <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
          Add payment details, then send this PO to Finance for record.
        </p>
      </div>

      {payments.length > 0 && (
        <div className="space-y-2">
          {payments.map((p) => (
            <div key={p.id} className="rounded-lg border bg-[hsl(var(--background))] px-3 py-2 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold">PKR {Number(p.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
                  {p.method.replace(/_/g, " ")} · {p.date}
                  {p.notes ? ` · ${p.notes}` : ""}
                </p>
              </div>
              {p.proofUrl && (
                <a href={p.proofUrl} target="_blank" rel="noreferrer">
                  <img src={p.proofUrl} alt="Proof" className="h-12 w-12 rounded object-cover border" />
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium">Amount (PKR)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full h-8 rounded-md border bg-[hsl(var(--background))] px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium">Method</label>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className="w-full h-8 rounded-md border bg-[hsl(var(--background))] px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
          >
            <option value="bank_transfer">Bank Transfer</option>
            <option value="cash">Cash</option>
            <option value="check">Check</option>
            <option value="online">Online Payment</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full h-8 rounded-md border bg-[hsl(var(--background))] px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium">Payment Proof</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setProofFile(e.target.files?.[0] || null)}
            className="w-full text-xs file:mr-2 file:h-7 file:rounded file:border-0 file:bg-[hsl(var(--muted))] file:px-2 file:text-xs cursor-pointer"
          />
        </div>
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium">Notes</label>
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Reference number, remarks..."
          className="w-full h-8 rounded-md border bg-[hsl(var(--background))] px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 text-xs cursor-pointer"
          onClick={addPayment}
          disabled={uploading || !amount}
        >
          {uploading ? "Uploading..." : "Add Payment"}
        </Button>
        <Button
          type="button"
          size="sm"
          className="h-8 text-xs cursor-pointer"
          onClick={sendToFinance}
          disabled={saving || payments.length === 0}
        >
          {saving ? "Sending..." : "Send to Finance for Record"}
        </Button>
      </div>
    </div>
  )
}
