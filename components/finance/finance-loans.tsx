"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  ArrowDownLeft,
  ArrowUpRight,
  FileText,
  HandCoins,
  Trash2,
  Undo2,
  Upload,
  Users,
  X,
} from "lucide-react"

export interface LoanRecord {
  id: string
  title: string
  amount: number
  currency: string
  purpose: string
  category: string
  tag: string
  proof_url: string
  proof_name: string
  notes: string
  created_by: string
  createdAt: string
  loan_person?: string
  loan_direction?: string
  loan_parent_id?: string
}

/**
 * Loan record categories:
 *  - "Loan"            → loan received from a person (money in)
 *  - "Loan Given"      → loan given to a person (money out)
 *  - "Loan Repayment"  → we return money on a loan we received (money out)
 *  - "Loan Recovery"   → a person returns money we gave them (money in)
 */
export const LOAN_CATEGORIES = ["Loan", "Loan Given", "Loan Repayment", "Loan Recovery"] as const

export function isLoanCategory(category: string): boolean {
  return (LOAN_CATEGORIES as readonly string[]).includes(category)
}

const MONEY_IN_CATEGORIES = new Set(["Loan", "Loan Recovery"])

const CATEGORY_LABEL: Record<string, string> = {
  "Loan": "Loan received",
  "Loan Given": "Loan given",
  "Loan Repayment": "Returned by us",
  "Loan Recovery": "Returned to us",
}

/** Legacy loans stored the person inside the title, e.g. "Syed Tauseef Raza Loan 1". */
function cleanLegacyPersonName(title: string): string {
  const cleaned = title.replace(/\s*[-—–:]?\s*Loan(\s*(received|given|returned|\d+))?\s*$/i, "").trim()
  return cleaned || title.trim()
}

export function loanPersonOf(r: Pick<LoanRecord, "loan_person" | "title" | "category">): string {
  const explicit = (r.loan_person || "").trim()
  if (explicit) return explicit
  return cleanLegacyPersonName(r.title)
}

interface LoanProfile {
  key: string
  name: string
  received: number
  given: number
  repaid: number
  recovered: number
  records: LoanRecord[]
  lastAt: number
}

function buildProfiles(records: LoanRecord[]): LoanProfile[] {
  const map = new Map<string, LoanProfile>()
  for (const r of records) {
    if (!isLoanCategory(r.category)) continue
    const name = loanPersonOf(r)
    if (!name) continue
    const key = name.toLowerCase()
    let p = map.get(key)
    if (!p) {
      p = { key, name, received: 0, given: 0, repaid: 0, recovered: 0, records: [], lastAt: 0 }
      map.set(key, p)
    }
    if (r.category === "Loan") p.received += r.amount
    else if (r.category === "Loan Given") p.given += r.amount
    else if (r.category === "Loan Repayment") p.repaid += r.amount
    else if (r.category === "Loan Recovery") p.recovered += r.amount
    p.records.push(r)
    p.lastAt = Math.max(p.lastAt, new Date(r.createdAt).getTime())
  }
  const profiles = Array.from(map.values())
  for (const p of profiles) {
    p.records.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }
  profiles.sort((a, b) => b.lastAt - a.lastAt)
  return profiles
}

const fmt = (n: number) => Math.round(n).toLocaleString()

function initialsOf(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })
}

const inputCls =
  "w-full h-9 rounded-md border bg-[hsl(var(--background))] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1faca6]/40 focus:border-[#1faca6] transition-colors"

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <label className="text-xs font-medium text-[hsl(var(--foreground))]">{label}</label>
    {children}
  </div>
)

type LoanFormMode = "receive" | "give" | "return"

const MODE_TITLES: Record<LoanFormMode, string> = {
  receive: "Loan received (money in)",
  give: "Give loan (money out)",
  return: "Return loan",
}

/* ------------------------------------------------------------------ */
/* Loan form dialog                                                    */
/* ------------------------------------------------------------------ */

function LoanFormDialog({
  mode,
  initialPerson,
  profiles,
  userName,
  onClose,
  onSaved,
}: {
  mode: LoanFormMode
  initialPerson: string
  profiles: LoanProfile[]
  userName: string
  onClose: () => void
  onSaved: (record: LoanRecord) => void
}) {
  const [person, setPerson] = useState(initialPerson)
  // For returns: "theirs" = we pay back a loan we received, "ours" = they return a loan we gave
  const [side, setSide] = useState<"theirs" | "ours">("theirs")
  const [amount, setAmount] = useState("")
  const [currency, setCurrency] = useState("PKR")
  const [tag, setTag] = useState("")
  const [notes, setNotes] = useState("")
  const [proofFile, setProofFile] = useState<File | null>(null)
  const [proofPreview, setProofPreview] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const fileRef = useRef<HTMLInputElement>(null)

  const matched = profiles.find((p) => p.key === person.trim().toLowerCase()) ?? null
  const weOweThem = matched ? matched.received - matched.repaid : 0
  const theyOweUs = matched ? matched.given - matched.recovered : 0

  // Default the return side to whichever balance is actually open
  useEffect(() => {
    if (mode !== "return" || !matched) return
    if (weOweThem <= 0 && theyOweUs > 0) setSide("ours")
    else if (weOweThem > 0 && theyOweUs <= 0) setSide("theirs")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, matched?.key])

  const outstanding = mode === "return" ? (side === "theirs" ? weOweThem : theyOweUs) : 0
  const parsedAmount = parseFloat(amount) || 0
  const overpay = mode === "return" && outstanding > 0 && parsedAmount > outstanding + 0.004

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setProofFile(file)
    if (file.type.startsWith("image/")) setProofPreview(URL.createObjectURL(file))
    else setProofPreview("")
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const name = person.trim()
    if (!name || !parsedAmount || parsedAmount <= 0 || saving) return

    setSaving(true)
    setError("")

    let proof_url = ""
    let proof_name = ""
    if (proofFile) {
      if (proofFile.size > 2 * 1024 * 1024) {
        setError("File too large. Max 2MB.")
        setSaving(false)
        return
      }
      proof_name = proofFile.name
      proof_url = await new Promise<string>((r) => {
        const fr = new FileReader()
        fr.onload = () => r(fr.result as string)
        fr.readAsDataURL(proofFile)
      })
    }

    const category =
      mode === "receive" ? "Loan"
      : mode === "give" ? "Loan Given"
      : side === "ours" ? "Loan Recovery"
      : "Loan Repayment"
    const purpose = CATEGORY_LABEL[category]
    const direction = category === "Loan" || category === "Loan Repayment" ? "received" : "given"

    try {
      const res = await fetch("/api/finance/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `${name} — ${purpose}`,
          amount: parsedAmount,
          currency,
          purpose,
          category,
          tag,
          proof_url,
          proof_name,
          notes,
          created_by: userName,
          loan_person: name,
          loan_direction: direction,
        }),
      })
      const record = await res.json()
      if (!res.ok) {
        setError(record?.error || "Failed to save")
        setSaving(false)
        return
      }
      onSaved(record)
      onClose()
    } catch (err) {
      console.error(err)
      setError("Failed to save loan record")
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-xl border bg-[hsl(var(--card))] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`h-1 w-full ${mode === "receive" ? "bg-emerald-500" : mode === "give" ? "bg-rose-500" : "bg-amber-500"}`} />
        <div className="flex items-center justify-between px-5 py-3.5 border-b shrink-0">
          <p className="text-sm font-semibold flex items-center gap-2">
            {mode === "receive" ? <ArrowDownLeft className="h-4 w-4 text-emerald-600" />
              : mode === "give" ? <ArrowUpRight className="h-4 w-4 text-rose-600" />
              : <Undo2 className="h-4 w-4 text-amber-600" />}
            {MODE_TITLES[mode]}
          </p>
          <Button variant="ghost" size="icon" className="h-7 w-7 cursor-pointer" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="overflow-y-auto p-5 space-y-3.5 flex-1 min-h-0">
            <Field label="Person *">
              <input
                value={person}
                onChange={(e) => setPerson(e.target.value)}
                required
                list="loan-people"
                placeholder="e.g. Syed Tauseef Raza"
                className={inputCls}
              />
              <datalist id="loan-people">
                {profiles.map((p) => (
                  <option key={p.key} value={p.name} />
                ))}
              </datalist>
            </Field>

            {mode === "return" && (
              <Field label="Who is returning? *">
                <div className="grid grid-cols-1 gap-2">
                  <button
                    type="button"
                    onClick={() => setSide("theirs")}
                    className={`rounded-lg border px-3 py-2.5 text-left transition-colors cursor-pointer ${
                      side === "theirs" ? "border-rose-400 bg-rose-500/10" : "hover:border-rose-300"
                    }`}
                  >
                    <p className="text-xs font-semibold flex items-center gap-1.5">
                      <ArrowUpRight className="h-3.5 w-3.5 text-rose-600" /> We return their loan (money out)
                    </p>
                    {matched && (
                      <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-0.5 tabular-nums">
                        We owe {matched.name}: PKR {fmt(Math.max(0, weOweThem))}
                      </p>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSide("ours")}
                    className={`rounded-lg border px-3 py-2.5 text-left transition-colors cursor-pointer ${
                      side === "ours" ? "border-emerald-400 bg-emerald-500/10" : "hover:border-emerald-300"
                    }`}
                  >
                    <p className="text-xs font-semibold flex items-center gap-1.5">
                      <ArrowDownLeft className="h-3.5 w-3.5 text-emerald-600" /> They return our loan (money in)
                    </p>
                    {matched && (
                      <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-0.5 tabular-nums">
                        {matched.name} owes us: PKR {fmt(Math.max(0, theyOweUs))}
                      </p>
                    )}
                  </button>
                </div>
              </Field>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Field label="Amount *">
                <input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  className={inputCls}
                />
              </Field>
              <Field label="Currency">
                <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={inputCls}>
                  {["PKR", "USD", "EUR", "GBP", "AED"].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </Field>
            </div>

            {mode === "return" && outstanding > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setAmount(String(outstanding))}
                  className="text-[11px] px-2.5 py-1 rounded-md border border-[#1faca6]/40 text-[#1faca6] hover:bg-[#1faca6]/10 transition-colors cursor-pointer"
                >
                  Full amount — PKR {fmt(outstanding)}
                </button>
                <span className="text-[10px] text-[hsl(var(--muted-foreground))]">or type any partial amount</span>
              </div>
            )}
            {overpay && (
              <p className="text-[11px] text-amber-700 bg-amber-500/10 border border-amber-500/25 rounded-md px-2.5 py-1.5">
                Amount is more than the outstanding PKR {fmt(outstanding)} — it will still be saved.
              </p>
            )}

            <Field label="Tag / Label">
              <input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="e.g. For clearance" className={inputCls} />
            </Field>
            <Field label="Notes">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Additional notes..."
                className="w-full rounded-md border bg-[hsl(var(--background))] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1faca6]/40 focus:border-[#1faca6] resize-none transition-colors"
              />
            </Field>

            <Field label="Attachment / proof (image or PDF, max 2MB)">
              <div
                onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-[#1faca6] hover:bg-[#1faca6]/5 transition-colors"
              >
                {proofPreview ? (
                  <img src={proofPreview} alt="proof" className="max-h-28 mx-auto rounded object-contain" />
                ) : proofFile ? (
                  <div className="flex items-center justify-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
                    <FileText className="h-4 w-4" />
                    {proofFile.name}
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1 text-[hsl(var(--muted-foreground))]">
                    <Upload className="h-5 w-5" />
                    <p className="text-xs">Click to upload proof</p>
                  </div>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleFileChange} />
              {proofFile && (
                <button
                  type="button"
                  onClick={() => {
                    setProofFile(null)
                    setProofPreview("")
                  }}
                  className="text-[10px] text-red-500 hover:underline mt-1"
                >
                  Remove file
                </button>
              )}
            </Field>
          </div>

          <div className="shrink-0 border-t px-5 py-3 space-y-2 bg-[hsl(var(--card))]">
            {error && <p className="text-xs text-red-500">{error}</p>}
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" className="flex-1 h-9 cursor-pointer" onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                className="flex-1 h-9 bg-[#1faca6] hover:bg-[#17857f] text-white cursor-pointer"
                disabled={saving}
              >
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Person profile dialog                                               */
/* ------------------------------------------------------------------ */

function LoanProfileDialog({
  profile,
  onClose,
  onDelete,
  onOpenForm,
}: {
  profile: LoanProfile
  onClose: () => void
  onDelete: (id: string) => void
  onOpenForm: (mode: LoanFormMode, person: string) => void
}) {
  const [proofRecord, setProofRecord] = useState<LoanRecord | null>(null)
  const weOwe = profile.received - profile.repaid
  const theyOwe = profile.given - profile.recovered

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="w-full max-w-2xl rounded-xl border bg-[hsl(var(--card))] shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-1 w-full bg-gradient-to-r from-amber-500 via-[#1faca6] to-emerald-500" />

        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-11 w-11 rounded-full bg-[#1faca6]/15 text-[#17857f] flex items-center justify-center text-sm font-bold shrink-0">
              {initialsOf(profile.name)}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold truncate">{profile.name}</p>
              <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
                {profile.records.length} loan transaction{profile.records.length === 1 ? "" : "s"} · last{" "}
                {fmtDate(new Date(profile.lastAt).toISOString())}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 cursor-pointer" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="overflow-y-auto flex-1 min-h-0 p-5 space-y-4">
          {/* Balances */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-lg border border-rose-200 dark:border-rose-500/30 bg-rose-500/5 px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-rose-700 dark:text-rose-400">We owe them</p>
              <p className="text-xl font-bold tabular-nums mt-0.5 text-rose-700 dark:text-rose-400">PKR {fmt(Math.max(0, weOwe))}</p>
              <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-1 tabular-nums">
                Received PKR {fmt(profile.received)} · returned PKR {fmt(profile.repaid)}
              </p>
            </div>
            <div className="rounded-lg border border-emerald-200 dark:border-emerald-500/30 bg-emerald-500/5 px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-700 dark:text-emerald-400">They owe us</p>
              <p className="text-xl font-bold tabular-nums mt-0.5 text-emerald-700 dark:text-emerald-400">PKR {fmt(Math.max(0, theyOwe))}</p>
              <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-1 tabular-nums">
                Given PKR {fmt(profile.given)} · returned PKR {fmt(profile.recovered)}
              </p>
            </div>
          </div>

          {/* Quick actions */}
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs gap-1.5 border-emerald-500/40 text-emerald-700 hover:bg-emerald-500/10 cursor-pointer"
              onClick={() => onOpenForm("receive", profile.name)}
            >
              <ArrowDownLeft className="h-3.5 w-3.5" /> Loan received
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs gap-1.5 border-rose-500/40 text-rose-700 hover:bg-rose-500/10 cursor-pointer"
              onClick={() => onOpenForm("give", profile.name)}
            >
              <ArrowUpRight className="h-3.5 w-3.5" /> Give loan
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs gap-1.5 border-amber-500/40 text-amber-800 hover:bg-amber-500/10 cursor-pointer"
              onClick={() => onOpenForm("return", profile.name)}
            >
              <Undo2 className="h-3.5 w-3.5" /> Return loan
            </Button>
          </div>

          {/* History */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))] mb-2">
              Loan history
            </p>
            <div className="rounded-lg border divide-y overflow-hidden">
              {profile.records.map((r) => {
                const moneyIn = MONEY_IN_CATEGORIES.has(r.category)
                return (
                  <div key={r.id} className="flex items-start gap-3 px-3.5 py-3 hover:bg-[hsl(var(--muted))]/30 transition-colors">
                    <div
                      className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                        moneyIn ? "bg-emerald-500/10 text-emerald-600" : "bg-rose-500/10 text-rose-600"
                      }`}
                    >
                      {moneyIn ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-xs font-semibold">{CATEGORY_LABEL[r.category] ?? r.category}</p>
                        {r.tag && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-[#1faca6]/10 text-[#1faca6] border border-[#1faca6]/20">
                            {r.tag}
                          </span>
                        )}
                      </div>
                      {r.notes && <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-0.5">{r.notes}</p>}
                      <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-0.5">
                        {fmtDate(r.createdAt)} · by {r.created_by}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-xs font-bold tabular-nums ${moneyIn ? "text-emerald-600" : "text-rose-600"}`}>
                        {moneyIn ? "+" : "−"} {r.currency} {r.amount.toLocaleString()}
                      </p>
                      <div className="flex items-center gap-1 justify-end mt-1">
                        {r.proof_url && (
                          <button
                            onClick={() => setProofRecord(r)}
                            className="inline-flex items-center gap-1 text-[10px] text-[#1faca6] hover:underline cursor-pointer"
                          >
                            <FileText className="h-3 w-3" /> Proof
                          </button>
                        )}
                        <button
                          onClick={() => {
                            if (confirm("Delete this loan transaction?")) onDelete(r.id)
                          }}
                          className="text-red-400 hover:text-red-600 cursor-pointer p-0.5"
                          title="Delete"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Proof viewer */}
        {proofRecord && (
          <div
            className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            onClick={() => setProofRecord(null)}
          >
            <div
              className="w-full max-w-lg rounded-xl border bg-[hsl(var(--card))] shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b">
                <p className="text-xs font-semibold truncate">{proofRecord.proof_name || "Proof"}</p>
                <Button variant="ghost" size="icon" className="h-7 w-7 cursor-pointer" onClick={() => setProofRecord(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="p-4">
                {proofRecord.proof_url.startsWith("data:image/") || proofRecord.proof_url.match(/\.(jpg|jpeg|png|webp|gif)/i) ? (
                  <img src={proofRecord.proof_url} alt="proof" className="w-full rounded-lg object-contain max-h-[60vh] border" />
                ) : proofRecord.proof_url.startsWith("data:application/pdf") ? (
                  <iframe src={proofRecord.proof_url} className="w-full h-[60vh] rounded-lg border" title="proof" />
                ) : (
                  <a
                    href={proofRecord.proof_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-[#1faca6] hover:underline"
                  >
                    <FileText className="h-4 w-4" /> View {proofRecord.proof_name || "document"}
                  </a>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Loan center panel                                                   */
/* ------------------------------------------------------------------ */

export function FinanceLoans({
  records,
  userName,
  autoOpenReceive,
  onCreated,
  onDelete,
}: {
  records: LoanRecord[]
  userName: string
  autoOpenReceive?: boolean
  onCreated: (record: LoanRecord) => void
  onDelete: (id: string) => void
}) {
  const [form, setForm] = useState<{ mode: LoanFormMode; person: string } | null>(null)
  const [profileKey, setProfileKey] = useState<string | null>(null)

  const profiles = useMemo(() => buildProfiles(records), [records])
  const activeProfile = profileKey ? profiles.find((p) => p.key === profileKey) ?? null : null

  useEffect(() => {
    if (autoOpenReceive) setForm({ mode: "receive", person: "" })
  }, [autoOpenReceive])

  const totalWeOwe = profiles.reduce((s, p) => s + Math.max(0, p.received - p.repaid), 0)
  const totalOwedToUs = profiles.reduce((s, p) => s + Math.max(0, p.given - p.recovered), 0)

  return (
    <div className="rounded-xl border overflow-hidden">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-4 py-3 bg-gradient-to-r from-amber-500/[0.07] to-[#1faca6]/[0.07] border-b">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-amber-500/15 text-amber-700 flex items-center justify-center">
            <HandCoins className="h-4.5 w-4.5" />
          </div>
          <div>
            <p className="text-sm font-bold leading-tight">Loans</p>
            <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
              {profiles.length} {profiles.length === 1 ? "person" : "people"} · give, receive & return with proof
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs gap-1.5 border-emerald-500/40 text-emerald-700 hover:bg-emerald-500/10 cursor-pointer"
            onClick={() => setForm({ mode: "receive", person: "" })}
          >
            <ArrowDownLeft className="h-3.5 w-3.5" /> Loan received
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs gap-1.5 border-rose-500/40 text-rose-700 hover:bg-rose-500/10 cursor-pointer"
            onClick={() => setForm({ mode: "give", person: "" })}
          >
            <ArrowUpRight className="h-3.5 w-3.5" /> Give loan
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs gap-1.5 border-amber-500/40 text-amber-800 hover:bg-amber-500/10 cursor-pointer"
            onClick={() => setForm({ mode: "return", person: "" })}
          >
            <Undo2 className="h-3.5 w-3.5" /> Return loan
          </Button>
        </div>
      </div>

      {/* Totals */}
      {profiles.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 divide-x border-b">
          <div className="px-4 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-rose-700 dark:text-rose-400">We owe</p>
            <p className="text-base font-bold tabular-nums text-rose-700 dark:text-rose-400">PKR {fmt(totalWeOwe)}</p>
          </div>
          <div className="px-4 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-700 dark:text-emerald-400">Owed to us</p>
            <p className="text-base font-bold tabular-nums text-emerald-700 dark:text-emerald-400">PKR {fmt(totalOwedToUs)}</p>
          </div>
          <div className="px-4 py-2.5 hidden sm:block">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">People</p>
            <p className="text-base font-bold tabular-nums">{profiles.length}</p>
          </div>
        </div>
      )}

      {/* People */}
      {profiles.length === 0 ? (
        <div className="px-4 py-8 text-center">
          <Users className="h-8 w-8 mx-auto text-[hsl(var(--muted-foreground))]/40 mb-2" />
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            No loans yet. Use the buttons above to record a loan given or received.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 p-3">
          {profiles.map((p) => {
            const weOwe = p.received - p.repaid
            const theyOwe = p.given - p.recovered
            const settled = weOwe <= 0.004 && theyOwe <= 0.004
            return (
              <button
                key={p.key}
                onClick={() => setProfileKey(p.key)}
                className="text-left rounded-lg border bg-[hsl(var(--background))] px-3.5 py-3 hover:border-[#1faca6]/60 hover:shadow-sm transition-all cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-full bg-[#1faca6]/15 text-[#17857f] flex items-center justify-center text-xs font-bold shrink-0">
                    {initialsOf(p.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold truncate">{p.name}</p>
                    <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
                      {p.records.length} txn{p.records.length === 1 ? "" : "s"} · {fmtDate(new Date(p.lastAt).toISOString())}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
                  {weOwe > 0.004 && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold tabular-nums bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30">
                      We owe PKR {fmt(weOwe)}
                    </span>
                  )}
                  {theyOwe > 0.004 && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold tabular-nums bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30">
                      Owes us PKR {fmt(theyOwe)}
                    </span>
                  )}
                  {settled && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-gray-500/10 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-500/30">
                      Settled
                    </span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* Dialogs */}
      {form && (
        <LoanFormDialog
          mode={form.mode}
          initialPerson={form.person}
          profiles={profiles}
          userName={userName}
          onClose={() => setForm(null)}
          onSaved={onCreated}
        />
      )}
      {activeProfile && (
        <LoanProfileDialog
          profile={activeProfile}
          onClose={() => setProfileKey(null)}
          onDelete={onDelete}
          onOpenForm={(mode, person) => setForm({ mode, person })}
        />
      )}
    </div>
  )
}
