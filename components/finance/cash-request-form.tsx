"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { uploadFile } from "@/lib/upload"
import { createCashRequest, karachiToday, type CashRequest } from "@/lib/finance-cash-requests"

const inputCls =
  "w-full h-9 rounded-md border bg-[hsl(var(--background))] px-2.5 text-sm focus:outline-none"

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
  const [amount, setAmount] = useState("")
  const [description, setDescription] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)

  async function submit() {
    const pkr = Number(amount)
    const why = description.trim()
    if (!why) {
      toast({ title: "Add a description", message: "Write what this money is for.", type: "error" })
      return
    }
    if (!Number.isFinite(pkr) || pkr <= 0) {
      toast({ title: "Enter an amount", message: "Amount must be greater than zero.", type: "error" })
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
        amount: pkr,
        neededOn: karachiToday(),
        purpose: why,
        category: "Other",
        paymentMethod: "cash",
        itemBreakdown: [{ id: crypto.randomUUID(), description: why, amount: pkr }],
        attachmentUrl,
        attachmentName,
      })
      toast({ title: "Request sent", message: "Admin will approve or reject this.", type: "success" })
      setAmount("")
      setDescription("")
      setFile(null)
      onCreated?.(row)
    } catch (e) {
      toast({ title: "Could not submit", message: e instanceof Error ? e.message : "Try again", type: "error" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-lg border bg-[hsl(var(--card))] p-4 space-y-3">
      <div>
        <p className="text-sm font-semibold">Request cash</p>
        <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-0.5">
          Enter the amount and a short description. Admin will receive this — it is not petty cash.
        </p>
      </div>
      <label className="text-[11px] space-y-1 block">
        <span className="text-[hsl(var(--muted-foreground))]">Amount (PKR)</span>
        <input
          type="number"
          min={1}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className={inputCls}
          placeholder="e.g. 5000"
        />
      </label>
      <label className="text-[11px] space-y-1 block">
        <span className="text-[hsl(var(--muted-foreground))]">Description</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="What is this money for?"
          className="w-full rounded-md border bg-[hsl(var(--background))] px-2.5 py-2 text-sm focus:outline-none"
        />
      </label>
      <label className="text-[11px] space-y-1 block">
        <span className="text-[hsl(var(--muted-foreground))]">Attachment (optional)</span>
        <input type="file" className="block text-xs" onChange={(e) => setFile(e.target.files?.[0] || null)} />
      </label>
      <Button type="button" className="h-9 text-xs bg-[#1faca6] hover:bg-[#1faca6]/90" onClick={submit} disabled={saving}>
        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
        Send to admin
      </Button>
    </div>
  )
}
