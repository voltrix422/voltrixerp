"use client"
import { useState } from "react"
import { saveOrder, type Order, type OrderPayment } from "@/lib/orders"
import { deductInventoryForOrder } from "@/lib/inventory"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { X, Upload } from "lucide-react"

export function PaymentCapture({ order, currentUser, onClose, onUpdate }: {
  order: Order
  currentUser: string
  onClose: () => void
  onUpdate: (o: Order) => void
}) {
  const [paymentAmount, setPaymentAmount] = useState(order.total.toString())
  const [paymentMethod, setPaymentMethod] = useState("Bank Transfer")
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0])
  const [paymentNotes, setPaymentNotes] = useState("")
  const [paymentProofFile, setPaymentProofFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploadingProof, setUploadingProof] = useState(false)

  async function handleAddPayment() {
    if (!paymentAmount || Number(paymentAmount) <= 0) {
      alert("Please enter a valid payment amount")
      return
    }

    setSaving(true)

    // Upload proof if provided
    let proofUrl: string | undefined
    if (paymentProofFile) {
      setUploadingProof(true)
      const ext = paymentProofFile.name.split(".").pop()
      const path = `payment-proofs/${Date.now()}.${ext}`
      const { error } = await supabase.storage.from("erp-files").upload(path, paymentProofFile, { upsert: true })
      if (!error) {
        const { data } = supabase.storage.from("erp-files").getPublicUrl(path)
        proofUrl = data.publicUrl
      }
      setUploadingProof(false)
    }

    const payment: OrderPayment = {
      id: Date.now().toString(),
      amount: Number(paymentAmount),
      method: paymentMethod,
      date: paymentDate,
      notes: paymentNotes,
      proofUrl,
      createdAt: new Date().toISOString(),
      createdBy: currentUser,
    }

    const updated: Order = {
      ...order,
      payments: [...(order.payments || []), payment],
      status: "finalized", // Move to finalized (Finance will see it)
    }

    await saveOrder(updated)
    
    // Deduct inventory quantities for items in this order
    try {
      await deductInventoryForOrder(updated)
      console.log("Inventory deducted successfully for order:", updated.orderNumber)
    } catch (error) {
      console.error("Error deducting inventory:", error)
      // Don't fail the payment if inventory deduction fails
    }
    
    onUpdate(updated)
    setSaving(false)
    alert("Payment added, order moved to Finance, and inventory updated!")
    onClose()
  }

  const totalPaid = (order.payments || []).reduce((sum, p) => sum + p.amount, 0)
  const remaining = order.total - totalPaid

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-xl border bg-[hsl(var(--card))] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <div>
            <p className="text-lg font-bold text-[hsl(var(--primary))]">Capture Payment - {order.orderNumber}</p>
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
              Total: PKR {order.total.toLocaleString(undefined, { minimumFractionDigits: 2 })} | 
              Paid: PKR {totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })} | 
              Remaining: PKR {remaining.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {order.payments && order.payments.length > 0 && (
            <div className="rounded-lg border bg-[hsl(var(--muted))]/20 p-4">
              <p className="text-xs font-semibold mb-2">Previous Payments</p>
              <div className="space-y-2">
                {order.payments.map(p => (
                  <div key={p.id} className="flex items-center justify-between text-xs border-b pb-2">
                    <div>
                      <p className="font-medium">PKR {p.amount.toLocaleString()}</p>
                      <p className="text-[hsl(var(--muted-foreground))]">{p.method} · {new Date(p.date).toLocaleDateString()}</p>
                    </div>
                    {p.proofUrl && (
                      <a href={p.proofUrl} target="_blank" rel="noreferrer" className="text-[hsl(var(--primary))] underline">View Proof</a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-lg border bg-blue-50 dark:bg-blue-950 p-4">
            <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
              Add new payment details from the client
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium">Payment Amount *</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={paymentAmount}
                onChange={e => setPaymentAmount(e.target.value)}
                className="w-full h-9 rounded-md border bg-[hsl(var(--background))] px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
                placeholder="0.00"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Payment Method *</label>
              <select
                value={paymentMethod}
                onChange={e => setPaymentMethod(e.target.value)}
                className="w-full h-9 rounded-md border bg-[hsl(var(--background))] px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
              >
                <option>Bank Transfer</option>
                <option>Cash</option>
                <option>Cheque</option>
                <option>Credit Card</option>
                <option>Other</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium">Payment Date *</label>
            <input
              type="date"
              value={paymentDate}
              onChange={e => setPaymentDate(e.target.value)}
              className="w-full h-9 rounded-md border bg-[hsl(var(--background))] px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium">Payment Notes</label>
            <textarea
              value={paymentNotes}
              onChange={e => setPaymentNotes(e.target.value)}
              rows={2}
              className="w-full rounded-md border bg-[hsl(var(--background))] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))] resize-none"
              placeholder="Transaction ID, reference number, etc."
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium">Payment Proof (Receipt/Screenshot)</label>
            <input
              type="file"
              accept="image/*,.pdf"
              onChange={e => setPaymentProofFile(e.target.files?.[0] || null)}
              className="w-full h-9 rounded-md border bg-[hsl(var(--background))] px-3 text-sm file:mr-4 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-[hsl(var(--muted))] file:text-[hsl(var(--foreground))] hover:file:bg-[hsl(var(--muted))]/80"
            />
            {paymentProofFile && (
              <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                ✓ {paymentProofFile.name}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 px-6 py-4 border-t bg-[hsl(var(--muted))]/20 shrink-0">
          <Button size="sm" className="h-8 text-xs bg-green-600 hover:bg-green-700" onClick={handleAddPayment} disabled={saving || uploadingProof}>
            {saving ? "Processing..." : uploadingProof ? "Uploading..." : "Add Payment & Send to Finance"}
          </Button>
          <Button size="sm" variant="outline" className="h-8 text-xs ml-auto" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </div>
  )
}
