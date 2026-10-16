"use client"

import { useMemo, useState } from "react"
import { Loader2, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { uploadFile } from "@/lib/upload"
import {
  CASH_REQUEST_CATEGORIES,
  createCashRequest,
  earliestNeededOn,
  newCashLine,
  type CashRequest,
  type CashRequestLine,
} from "@/lib/finance-cash-requests"

const inputCls =
  "w-full h-9 rounded-md border bg-[hsl(var(--background))] px-2.5 text-xs focus:outline-none"

type Props = {
  userId: string
  requesterName: string
  requesterEmail?: string
  department?: string
  staffId?: string | null
  onCreated?: (row: CashRequest) => void
}

export function CashRequestForm({
  userId,
  requesterName,
  requesterEmail,
  department,
  staffId,
  onCreated,
}: Props) {
  const { toast } = useToast()
  const minDate = earliestNeededOn()
  const [neededOn, setNeededOn] = useState(minDate)
  const [purpose, setPurpose] = useState("")
  const [category, setCategory] = useState("Other")
  const [paymentMethod, setPaymentMethod] = useState("cash")
  const [bankName, setBankName] = useState("")
  const [bankAccountNumber, setBankAccountNumber] = useState("")
  const [bankAccountTitle, setBankAccountTitle] = useState("")
  const [location, setLocation] = useState("")
  const [notes, setNotes] = useState("")
  const [lines, setLines] = useState<CashRequestLine[]>([newCashLine()])
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)

  const amount = useMemo(
    () => lines.reduce((s, l) => s + (Number(l.amount) || 0), 0),
    [lines],
  )

  function updateLine(id: string, patch: Partial<CashRequestLine>) {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)))
  }

  async function submit() {
    if (!purpose.trim()) {
      toast({ title: "Purpose required", message: "Explain why you need this cash.", type: "error" })
      return
    }
    if (neededOn < minDate) {
      toast({
        title: "Request a day ahead",
        message: "Cash must be requested at least one day before you need it.",
        type: "error",
      })
      return
    }
    const filledLines = lines.map((l) => ({
      ...l,
      description: l.description.trim() || purpose.trim(),
    }))
    if (amount <= 0 || filledLines.some((l) => !l.description || !(Number(l.amount) > 0))) {
      toast({
        title: "Cash details required",
        message: "In Cash details, type what the money is for (left box) and the amount in PKR (right box).",
        type: "error",
      })
      return
    }
    if (paymentMethod === "bank" && (!bankName.trim() || !bankAccountNumber.trim() || !bankAccountTitle.trim())) {
      toast({ title: "Bank details required", type: "error" })
      return
    }

    setSaving(true)
    try {
      let attachmentUrl = ""
      let attachmentName = ""
      if (file) {
        attachmentUrl = await uploadFile(file, "cash-requests")
        attachmentName = file.name
      }
      const row = await createCashRequest({
        staffId,
        userId,
        requesterName,
        requesterEmail,
        department,
        amount,
        neededOn,
        purpose: purpose.trim(),
        category,
        paymentMethod,
        bankName,
        bankAccountNumber,
        bankAccountTitle,
        location: location.trim(),
        itemBreakdown: filledLines,
        notes: notes.trim(),
        attachmentUrl,
        attachmentName,
      })
      toast({ title: "Request sent", message: "Admin will approve or reject this cash request.", type: "success" })
      setPurpose("")
      setNotes("")
      setLocation("")
      setLines([newCashLine()])
      setFile(null)
      setNeededOn(minDate)
      onCreated?.(row)
    } catch (e) {
      toast({ title: "Could not submit", message: e instanceof Error ? e.message : "Try again", type: "error" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-lg border bg-[hsl(var(--card))] p-3 space-y-3">
      <div>
        <p className="text-sm font-semibold">Request cash</p>
        <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-0.5">
          Fill every cash detail. Requests must be sent at least one day before you need the money.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <label className="text-[11px] space-y-1">
          <span className="text-[hsl(var(--muted-foreground))]">Needed on</span>
          <input type="date" min={minDate} value={neededOn} onChange={(e) => setNeededOn(e.target.value)} className={inputCls} />
        </label>
        <label className="text-[11px] space-y-1">
          <span className="text-[hsl(var(--muted-foreground))]">Category</span>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls}>
            {CASH_REQUEST_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[11px] space-y-1 sm:col-span-2">
          <span className="text-[hsl(var(--muted-foreground))]">Purpose</span>
          <textarea
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            rows={2}
            placeholder="Why do you need this cash?"
            className="w-full rounded-md border bg-[hsl(var(--background))] px-2.5 py-2 text-xs focus:outline-none"
          />
        </label>
        <label className="text-[11px] space-y-1">
          <span className="text-[hsl(var(--muted-foreground))]">How should admin pay</span>
          <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className={inputCls}>
            <option value="cash">Cash</option>
            <option value="bank">Bank transfer</option>
          </select>
        </label>
        <label className="text-[11px] space-y-1">
          <span className="text-[hsl(var(--muted-foreground))]">Location / branch</span>
          <input
            value={location}
            maxLength={80}
            onChange={(e) => setLocation(e.target.value)}
            className={inputCls}
            placeholder="e.g. Islamabad office"
          />
        </label>
      </div>

      {paymentMethod === "bank" && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <input value={bankName} onChange={(e) => setBankName(e.target.value)} className={inputCls} placeholder="Bank name" />
          <input value={bankAccountTitle} onChange={(e) => setBankAccountTitle(e.target.value)} className={inputCls} placeholder="Account title" />
          <input value={bankAccountNumber} onChange={(e) => setBankAccountNumber(e.target.value)} className={inputCls} placeholder="Account number" />
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-medium">Cash details</p>
          <button
            type="button"
            className="text-[11px] inline-flex items-center gap-1 text-[hsl(var(--muted-foreground))] cursor-pointer"
            onClick={() => setLines((prev) => [...prev, newCashLine()])}
          >
            <Plus className="h-3 w-3" /> Add line
          </button>
        </div>
        <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
          Left box: what the money is for. Right box: amount in PKR. Add extra lines if the cash is for more than one thing.
        </p>
        <div className="hidden sm:flex gap-2 text-[10px] uppercase text-[hsl(var(--muted-foreground))]">
          <span className="flex-1">What for</span>
          <span className="w-28">Amount</span>
          {lines.length > 1 ? <span className="w-9" /> : null}
        </div>
        {lines.map((line) => (
          <div key={line.id} className="flex gap-2">
            <input
              value={line.description}
              onChange={(e) => updateLine(line.id, { description: e.target.value })}
              className={`${inputCls} flex-1`}
              placeholder={purpose.trim() || "e.g. Client lunch, taxi, printing"}
            />
            <input
              type="number"
              min={0}
              value={line.amount || ""}
              onChange={(e) => updateLine(line.id, { amount: Number(e.target.value) })}
              className={`${inputCls} w-28`}
              placeholder="PKR"
            />
            {lines.length > 1 && (
              <button
                type="button"
                className="h-9 w-9 inline-flex items-center justify-center border rounded-md cursor-pointer"
                onClick={() => setLines((prev) => prev.filter((l) => l.id !== line.id))}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}
        <p className="text-xs font-medium tabular-nums">Total: PKR {amount.toLocaleString()}</p>
      </div>

      <label className="text-[11px] space-y-1 block">
        <span className="text-[hsl(var(--muted-foreground))]">Notes</span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="w-full rounded-md border bg-[hsl(var(--background))] px-2.5 py-2 text-xs focus:outline-none"
        />
      </label>
      <label className="text-[11px] space-y-1 block">
        <span className="text-[hsl(var(--muted-foreground))]">Attachment (optional)</span>
        <input type="file" className="block text-xs" onChange={(e) => setFile(e.target.files?.[0] || null)} />
      </label>

      <Button type="button" className="h-9 text-xs bg-[#1faca6] hover:bg-[#1faca6]/90" onClick={submit} disabled={saving}>
        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
        Send request to admin
      </Button>
    </div>
  )
}
