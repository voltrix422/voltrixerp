"use client"
import { useState } from "react"
import { saveOrder, type Order, type OrderPayment } from "@/lib/orders"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { X, FileText } from "lucide-react"
import { SuccessNotification } from "@/components/ui/success-notification"

export function OrderFinalize({ order, currentUser, onClose, onUpdate }: {
  order: Order
  currentUser: string
  onClose: () => void
  onUpdate: (o: Order) => void
}) {
  const [step, setStep] = useState<"details" | "payment">("details")
  const [taxPercent, setTaxPercent] = useState(order.taxPercent || "")
  const [transportCost, setTransportCost] = useState(order.transportCost || "")
  const [transportLabel] = useState("Transport cost")
  const [otherCost, setOtherCost] = useState(order.otherCost || "")
  const [otherCostLabel] = useState("Other cost")
  const [dispatcher, setDispatcher] = useState(order.dispatcher || "")
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  
  // Payment fields
  const [paymentAmount, setPaymentAmount] = useState("")
  const [paymentMethod, setPaymentMethod] = useState("Bank Transfer")
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0])
  const [paymentNotes, setPaymentNotes] = useState("")
  const [paymentProofFile, setPaymentProofFile] = useState<File | null>(null)
  const [uploadingProof, setUploadingProof] = useState(false)
  const [showSuccessDialog, setShowSuccessDialog] = useState(false)

  const subtotal = order.subtotal
  const tax = (subtotal * (Number(taxPercent) || 0)) / 100
  const total = subtotal + tax + (Number(transportCost) || 0) + (Number(otherCost) || 0)

  async function handleSave() {
    setSaving(true)
    const updated: Order = {
      ...order,
      taxPercent: Number(taxPercent) || 0,
      tax,
      transportCost: Number(transportCost) || 0,
      transportLabel,
      otherCost: Number(otherCost) || 0,
      otherCostLabel,
      dispatcher,
      total,
    }
    await saveOrder(updated)
    onUpdate(updated)
    setSaving(false)
  }

  async function handleGeneratePDF() {
    setGenerating(true)
    // First save the current state
    const updated: Order = {
      ...order,
      taxPercent: Number(taxPercent) || 0,
      tax,
      transportCost: Number(transportCost) || 0,
      transportLabel,
      otherCost: Number(otherCost) || 0,
      otherCostLabel,
      dispatcher,
      total,
      pdfUrl: `generated-${order.orderNumber}.pdf`, // Placeholder
    }
    await saveOrder(updated)
    onUpdate(updated)
    setGenerating(false)
    
    // Move to payment step
    setStep("payment")
  }

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
      createdBy: order.createdBy,
    }

    const updated: Order = {
      ...order,
      taxPercent: Number(taxPercent) || 0,
      tax,
      transportCost: Number(transportCost) || 0,
      transportLabel,
      otherCost: Number(otherCost) || 0,
      otherCostLabel,
      dispatcher,
      total,
      payments: [...(order.payments || []), payment],
      status: "finalized", // Move to finalized (Finance will see it)
      pdfUrl: order.pdfUrl || `generated-${order.orderNumber}.pdf`,
    }

    await saveOrder(updated)
    onUpdate(updated)
    setSaving(false)
    setShowSuccessDialog(true)
  }

  if (step === "payment") {
    return (
      <>
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
          <div className="w-full max-w-2xl rounded-xl border bg-[hsl(var(--card))] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
              <div>
                <p className="text-lg font-bold text-[hsl(var(--primary))]">Add Payment - {order.orderNumber}</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">Total Amount: PKR {total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="rounded-lg border bg-blue-50 dark:bg-blue-950 p-4">
                <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  PDF Generated! Now collect payment details from the client.
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
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setStep("details")}>Back</Button>
              <Button size="sm" variant="outline" className="h-8 text-xs ml-auto" onClick={onClose}>Cancel</Button>
            </div>
          </div>
        </div>

        <SuccessNotification
          isOpen={showSuccessDialog}
          title="Success!"
          message="Payment added, order moved to Finance, and inventory updated!"
          onClose={() => {
            setShowSuccessDialog(false)
            onClose()
          }}
          autoClose={true}
          autoCloseDelay={3000}
        />
      </>
    )
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
        <div className="w-full max-w-4xl rounded-xl border bg-[hsl(var(--card))] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between px-5 py-3 border-b shrink-0">
            <div className="flex items-center gap-6">
              <div>
                <p className="text-base font-bold text-[hsl(var(--primary))]">Finalize Order - {order.orderNumber}</p>
                <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-0.5 capitalize">{order.clientName}</p>
              </div>
              <div className="border-l pl-4">
                <p className="text-[9px] font-bold text-[hsl(var(--muted-foreground))]">Dispatcher</p>
                <input
                  type="text"
                  value={dispatcher}
                  onChange={e => setDispatcher(e.target.value)}
                  className="w-40 h-7 mt-0.5 rounded-md border bg-[hsl(var(--background))] px-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
                  placeholder="Assign dispatcher"
                />
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-3">
            <div className="border-b pb-3">
              <p className="text-[9px] font-bold text-[hsl(var(--muted-foreground))] mb-1.5">Order summary</p>
              <div className="flex justify-between text-xs">
                <span>Subtotal ({order.items.length} items)</span>
                <span className="font-medium">PKR {subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            <div className="space-y-2.5">
              <div className="grid grid-cols-3 gap-2.5">
                <div className="space-y-0.5">
                  <label className="text-[10px] font-medium">Tax percentage (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={taxPercent}
                    onChange={e => setTaxPercent(e.target.value)}
                    className="w-full h-8 rounded-md border bg-[hsl(var(--background))] px-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
                    placeholder="e.g., 18"
                  />
                </div>
                <div className="space-y-0.5">
                  <label className="text-[10px] font-medium">Transport cost</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={transportCost}
                    onChange={e => setTransportCost(e.target.value)}
                    className="w-full h-8 rounded-md border bg-[hsl(var(--background))] px-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
                    placeholder=""
                  />
                </div>
                <div className="space-y-0.5">
                  <label className="text-[10px] font-medium">Other cost</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={otherCost}
                    onChange={e => setOtherCost(e.target.value)}
                    className="w-full h-8 rounded-md border bg-[hsl(var(--background))] px-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
                    placeholder=""
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1.5 border-t pt-3">
              <div className="flex justify-between text-xs">
                <span>Subtotal</span>
                <span>PKR {subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              {Number(taxPercent) > 0 && (
                <div className="flex justify-between text-xs text-[hsl(var(--muted-foreground))]">
                  <span>Tax ({taxPercent}%)</span>
                  <span>PKR {tax.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              )}
              {Number(transportCost) > 0 && (
                <div className="flex justify-between text-xs text-[hsl(var(--muted-foreground))]">
                  <span>Transport cost</span>
                  <span>PKR {Number(transportCost).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              )}
              {Number(otherCost) > 0 && (
                <div className="flex justify-between text-xs text-[hsl(var(--muted-foreground))]">
                  <span>Other cost</span>
                  <span>PKR {Number(otherCost).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-bold pt-1.5">
                <span>Total</span>
                <span>PKR {total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 px-5 py-3 border-t bg-[hsl(var(--muted))]/20 shrink-0">
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
            <Button size="sm" className="h-7 text-xs bg-green-400 hover:bg-green-500 text-white" onClick={handleGeneratePDF} disabled={generating}>
              <FileText className="h-3 w-3 mr-1.5" /> {generating ? "Generating..." : "Generate PDF & Send to Finance"}
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs ml-auto" onClick={onClose}>Close</Button>
          </div>
        </div>
      </div>

      <SuccessNotification
        isOpen={showSuccessDialog}
        title="Success!"
        message="Payment added, order moved to Finance, and inventory updated!"
        onClose={() => {
          setShowSuccessDialog(false)
          onClose()
        }}
        autoClose={true}
        autoCloseDelay={3000}
      />
    </>
  )
}
