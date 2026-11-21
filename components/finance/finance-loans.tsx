"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import {
  FileText,
  Trash2,
  Upload,
  Users,
  X,
} from "lucide-react"
import { downloadLoanStatementPdf } from "@/lib/generate-loan-statement-pdf"
import { cn } from "@/lib/utils"

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
  has_proof?: boolean
}

type LoanProofItem = { url: string; name: string }

const MAX_LOAN_PROOFS = 8
const MAX_LOAN_PROOF_BYTES = 2 * 1024 * 1024

/** Supports legacy single proof_url string and JSON arrays of urls/names. */
function parseLoanProofs(proofUrl: string, proofName: string): LoanProofItem[] {
  const url = String(proofUrl || "").trim()
  const name = String(proofName || "").trim()
  if (!url) return []
  try {
    const parsed = JSON.parse(url)
    if (Array.isArray(parsed) && parsed.length > 0) {
      let names: string[] = []
      try {
        const n = JSON.parse(name)
        if (Array.isArray(n)) names = n.map((x) => String(x || ""))
      } catch {
        /* single name string */
      }
      if (parsed.every((x) => typeof x === "string")) {
        return parsed.map((u, i) => ({
          url: u,
          name: names[i] || name || `Proof ${i + 1}`,
        }))
      }
      if (parsed.every((x) => x && typeof x === "object" && typeof (x as { url?: string }).url === "string")) {
        return (parsed as { url: string; name?: string }[]).map((x, i) => ({
          url: x.url,
          name: x.name || names[i] || `Proof ${i + 1}`,
        }))
      }
    }
  } catch {
    /* legacy single data-url / path */
  }
  return [{ url, name: name || "Proof" }]
}

function serializeLoanProofs(items: LoanProofItem[]): { proof_url: string; proof_name: string } {
  if (items.length === 0) return { proof_url: "", proof_name: "" }
  if (items.length === 1) return { proof_url: items[0].url, proof_name: items[0].name }
  return {
    proof_url: JSON.stringify(items.map((i) => i.url)),
    proof_name: JSON.stringify(items.map((i) => i.name)),
  }
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader()
    fr.onload = () => resolve(String(fr.result || ""))
    fr.onerror = () => reject(new Error("Failed to read file"))
    fr.readAsDataURL(file)
  })
}

function isImageProofUrl(url: string) {
  return url.startsWith("data:image/") || /\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(url)
}

function isPdfProofUrl(url: string) {
  return url.startsWith("data:application/pdf") || /\.pdf(\?|$)/i.test(url)
}

async function fetchLoanProof(id: string): Promise<LoanRecord | null> {
  try {
    const res = await fetch(`/api/finance/records?id=${encodeURIComponent(id)}`)
    if (!res.ok) return null
    return (await res.json()) as LoanRecord
  } catch {
    return null
  }
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

export function buildLoanProfiles(records: LoanRecord[]): LoanProfile[] {
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

type TypeFilter = "all" | "received" | "given" | "returned"

type LedgerRow = LoanRecord & {
  moneyIn: number
  moneyOut: number
  weOweAfter: number
  theyOweAfter: number
}

function buildLedger(records: LoanRecord[]): LedgerRow[] {
  const chrono = [...records].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  )
  let weOwe = 0
  let theyOwe = 0
  return chrono.map((r) => {
    const moneyIn = MONEY_IN_CATEGORIES.has(r.category) ? r.amount : 0
    const moneyOut = moneyIn ? 0 : r.amount
    if (r.category === "Loan") weOwe += r.amount
    else if (r.category === "Loan Repayment") weOwe -= r.amount
    else if (r.category === "Loan Given") theyOwe += r.amount
    else if (r.category === "Loan Recovery") theyOwe -= r.amount
    return { ...r, moneyIn, moneyOut, weOweAfter: weOwe, theyOweAfter: theyOwe }
  })
}

function isoDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function matchesType(r: LoanRecord, filter: TypeFilter): boolean {
  if (filter === "all") return true
  if (filter === "received") return r.category === "Loan"
  if (filter === "given") return r.category === "Loan Given"
  return r.category === "Loan Repayment" || r.category === "Loan Recovery"
}

function csvEscape(v: string | number): string {
  const s = String(v ?? "")
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

const inputCls =
  "w-full h-10 rounded-[10px] border border-black/[0.08] bg-white dark:bg-[hsl(var(--card))] dark:border-[hsl(var(--border))] px-3 text-[13px] text-[#1d1d1f] dark:text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[#007aff]/35 focus:border-[#007aff]/50 transition-colors"

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <label className="text-[11px] font-medium text-[#86868b]">{label}</label>
    {children}
  </div>
)

function AppleGroup({
  title,
  children,
  className,
}: {
  title?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {title ? (
        <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.04em] text-[#86868b]">{title}</p>
      ) : null}
      <div className="overflow-hidden rounded-[14px] border border-black/[0.04] bg-white dark:border-[hsl(var(--border))] dark:bg-[hsl(var(--card))]">
        {children}
      </div>
    </div>
  )
}

type LoanFormMode = "receive" | "give" | "return"

const MODE_TITLES: Record<LoanFormMode, string> = {
  receive: "Loan received",
  give: "Give loan",
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
  const [proofFiles, setProofFiles] = useState<{ file: File; preview: string }[]>([])
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
    const list = e.target.files
    if (!list?.length) return
    const next = Array.from(list).map((file) => ({
      file,
      preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : "",
    }))
    setProofFiles((prev) => [...prev, ...next].slice(0, MAX_LOAN_PROOFS))
    e.target.value = ""
  }

  function removeProofAt(index: number) {
    setProofFiles((prev) => {
      const copy = [...prev]
      const [removed] = copy.splice(index, 1)
      if (removed?.file.type.startsWith("image/") && removed.preview) {
        URL.revokeObjectURL(removed.preview)
      }
      return copy
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const name = person.trim()
    if (!name || !parsedAmount || parsedAmount <= 0 || saving) return

    setSaving(true)
    setError("")

    for (const p of proofFiles) {
      if (p.file.size > MAX_LOAN_PROOF_BYTES) {
        setError(`“${p.file.name}” is too large. Max 2MB each.`)
        setSaving(false)
        return
      }
    }

    let proof_url = ""
    let proof_name = ""
    if (proofFiles.length > 0) {
      try {
        const items: LoanProofItem[] = []
        for (const p of proofFiles) {
          items.push({ url: await fileToDataUrl(p.file), name: p.file.name })
        }
        ;({ proof_url, proof_name } = serializeLoanProofs(items))
      } catch {
        setError("Failed to read one of the proof files.")
        setSaving(false)
        return
      }
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
      proofFiles.forEach((p) => {
        if (p.file.type.startsWith("image/") && p.preview) URL.revokeObjectURL(p.preview)
      })
      onSaved(record)
      onClose()
    } catch (err) {
      console.error(err)
      setError("Failed to save loan record")
      setSaving(false)
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-[10px] p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full sm:w-[min(440px,calc(100vw-2rem))] rounded-t-[22px] sm:rounded-[22px] bg-[#f5f5f7] dark:bg-[hsl(var(--background))] shadow-[0_24px_80px_rgba(0,0,0,0.28)] overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 flex items-center justify-between gap-3 px-5 pt-4 pb-3 sm:px-6">
          <div className="min-w-0">
            <p className="text-[20px] font-semibold tracking-[-0.03em] text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">
              {MODE_TITLES[mode]}
            </p>
            <p className="text-[12px] text-[#86868b] mt-0.5">
              {mode === "receive" ? "Money in from a person" : mode === "give" ? "Money out to a person" : "Settle an open balance"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 shrink-0 inline-flex items-center justify-center rounded-full bg-black/[0.06] text-[#1d1d1f] hover:bg-black/[0.1] dark:bg-white/10 dark:text-white dark:hover:bg-white/15 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="h-4 w-4" strokeWidth={2.25} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="overflow-y-auto px-5 sm:px-6 pb-4 space-y-3.5 flex-1 min-h-0">
            <Field label="Person">
              <input
                value={person}
                onChange={(e) => setPerson(e.target.value)}
                required
                list="loan-people"
                placeholder="Name"
                className={inputCls}
              />
              <datalist id="loan-people">
                {profiles.map((p) => (
                  <option key={p.key} value={p.name} />
                ))}
              </datalist>
            </Field>

            {mode === "return" && (
              <Field label="Direction">
                <div className="grid grid-cols-1 gap-2">
                  <button
                    type="button"
                    onClick={() => setSide("theirs")}
                    className={cn(
                      "rounded-[12px] border px-3.5 py-3 text-left transition-colors cursor-pointer",
                      side === "theirs"
                        ? "border-[#ff3b30]/35 bg-[#ff3b30]/08"
                        : "border-black/[0.06] bg-white dark:bg-[hsl(var(--card))] hover:bg-black/[0.02]",
                    )}
                  >
                    <p className="text-[13px] font-semibold text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">
                      We return their loan
                    </p>
                    {matched && (
                      <p className="text-[11px] text-[#86868b] mt-0.5 tabular-nums">
                        Outstanding PKR {fmt(Math.max(0, weOweThem))}
                      </p>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSide("ours")}
                    className={cn(
                      "rounded-[12px] border px-3.5 py-3 text-left transition-colors cursor-pointer",
                      side === "ours"
                        ? "border-[#30d158]/40 bg-[#30d158]/10"
                        : "border-black/[0.06] bg-white dark:bg-[hsl(var(--card))] hover:bg-black/[0.02]",
                    )}
                  >
                    <p className="text-[13px] font-semibold text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">
                      They return our loan
                    </p>
                    {matched && (
                      <p className="text-[11px] text-[#86868b] mt-0.5 tabular-nums">
                        Outstanding PKR {fmt(Math.max(0, theyOweUs))}
                      </p>
                    )}
                  </button>
                </div>
              </Field>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Field label="Amount">
                <input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0"
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
              <button
                type="button"
                onClick={() => setAmount(String(outstanding))}
                className="text-[12px] font-medium text-[#007aff] hover:underline cursor-pointer"
              >
                Use full amount · PKR {fmt(outstanding)}
              </button>
            )}
            {overpay && (
              <p className="text-[12px] text-[#9a6700] bg-[#ff9f0a]/12 rounded-[10px] px-3 py-2">
                Above outstanding PKR {fmt(outstanding)} — will still save.
              </p>
            )}

            <Field label="Tag">
              <input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="Optional" className={inputCls} />
            </Field>
            <Field label="Notes">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Optional"
                className="w-full rounded-[10px] border border-black/[0.08] bg-white dark:bg-[hsl(var(--card))] dark:border-[hsl(var(--border))] px-3 py-2.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#007aff]/35 resize-none"
              />
            </Field>

            <Field label="Proofs">
              {proofFiles.length > 0 && (
                <div className="mb-2 grid grid-cols-2 gap-2">
                  {proofFiles.map((p, i) => (
                    <div
                      key={`${p.file.name}-${p.file.size}-${i}`}
                      className="relative rounded-[12px] border border-black/[0.08] bg-white dark:bg-[hsl(var(--card))] p-2"
                    >
                      {p.preview ? (
                        <img src={p.preview} alt={p.file.name} className="h-20 w-full rounded-lg object-cover" />
                      ) : (
                        <div className="h-20 flex flex-col items-center justify-center gap-1 text-[#86868b] px-1">
                          <FileText className="h-4 w-4" />
                          <p className="text-[10px] text-center line-clamp-2 break-all">{p.file.name}</p>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => removeProofAt(i)}
                        className="absolute top-1.5 right-1.5 h-6 w-6 inline-flex items-center justify-center rounded-full bg-black/55 text-white hover:bg-black/70 cursor-pointer"
                        aria-label={`Remove ${p.file.name}`}
                      >
                        <X className="h-3.5 w-3.5" strokeWidth={2.25} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div
                onClick={() => {
                  if (proofFiles.length >= MAX_LOAN_PROOFS) return
                  fileRef.current?.click()
                }}
                className={cn(
                  "rounded-[12px] border border-dashed border-black/[0.12] bg-white dark:bg-[hsl(var(--card))] p-4 text-center transition-colors",
                  proofFiles.length >= MAX_LOAN_PROOFS
                    ? "opacity-50 cursor-not-allowed"
                    : "cursor-pointer hover:border-[#007aff]/40",
                )}
              >
                <div className="flex flex-col items-center gap-1 text-[#86868b]">
                  <Upload className="h-5 w-5" />
                  <p className="text-[12px]">
                    {proofFiles.length > 0 ? "Add more images or PDFs" : "Images or PDFs · multiple OK"}
                  </p>
                  <p className="text-[11px]">
                    Max 2MB each · up to {MAX_LOAN_PROOFS} files
                    {proofFiles.length > 0 ? ` · ${proofFiles.length}/${MAX_LOAN_PROOFS}` : ""}
                  </p>
                </div>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*,.pdf,application/pdf"
                multiple
                className="hidden"
                onChange={handleFileChange}
              />
            </Field>
          </div>

          <div className="shrink-0 px-5 sm:px-6 py-3.5 border-t border-black/[0.06] dark:border-[hsl(var(--border))] bg-[#f5f5f7]/90 dark:bg-[hsl(var(--background))] space-y-2">
            {error && <p className="text-[12px] text-[#ff3b30]">{error}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 h-10 rounded-full bg-black/[0.06] text-[13px] font-semibold text-[#1d1d1f] hover:bg-black/[0.1] dark:bg-white/10 dark:text-white cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 h-10 rounded-full bg-[#007aff] text-[13px] font-semibold text-white hover:bg-[#0066d6] disabled:opacity-60 cursor-pointer transition-colors"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  )

}

/* ------------------------------------------------------------------ */
/* Person profile dialog                                               */
/* ------------------------------------------------------------------ */

function LoanProfileDialog({
  profile,
  userName,
  onClose,
  onDelete,
  onOpenForm,
}: {
  profile: LoanProfile
  userName: string
  onClose: () => void
  onDelete: (id: string) => void
  onOpenForm: (mode: LoanFormMode, person: string) => void
}) {
  const [proofRecord, setProofRecord] = useState<LoanRecord | null>(null)
  const [proofLoading, setProofLoading] = useState(false)
  const [proofIndex, setProofIndex] = useState(0)
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all")
  const [exporting, setExporting] = useState(false)

  const proofItems = proofRecord
    ? parseLoanProofs(proofRecord.proof_url || "", proofRecord.proof_name || "")
    : []
  const activeProof = proofItems[Math.min(proofIndex, Math.max(0, proofItems.length - 1))] || null

  async function openProof(r: LoanRecord) {
    setProofIndex(0)
    if (r.proof_url) {
      setProofRecord(r)
      return
    }
    if (!r.has_proof) return
    setProofLoading(true)
    setProofRecord({ ...r, proof_url: "" })
    const full = await fetchLoanProof(r.id)
    setProofLoading(false)
    if (full?.proof_url) setProofRecord({ ...r, ...full })
    else setProofRecord(null)
  }

  const weOwe = profile.received - profile.repaid
  const theyOwe = profile.given - profile.recovered
  const ledger = useMemo(() => buildLedger(profile.records), [profile.records])

  const filtered = useMemo(() => {
    return ledger.filter((r) => {
      if (!matchesType(r, typeFilter)) return false
      const d = new Date(r.createdAt)
      if (dateFrom && d < new Date(dateFrom)) return false
      if (dateTo && d > new Date(`${dateTo}T23:59:59`)) return false
      return true
    })
  }, [ledger, dateFrom, dateTo, typeFilter])

  const displayRows = useMemo(
    () => [...filtered].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [filtered],
  )

  const periodIn = filtered.reduce((s, r) => s + r.moneyIn, 0)
  const periodOut = filtered.reduce((s, r) => s + r.moneyOut, 0)
  const hasDateFilter = !!(dateFrom || dateTo)
  const periodLabel =
    dateFrom && dateTo
      ? `${fmtDate(dateFrom)} – ${fmtDate(dateTo)}`
      : dateFrom
        ? `From ${fmtDate(dateFrom)}`
        : dateTo
          ? `Until ${fmtDate(dateTo)}`
          : "All time"

  function applyPreset(preset: "all" | "month" | "last" | "year") {
    const now = new Date()
    if (preset === "all") {
      setDateFrom("")
      setDateTo("")
      return
    }
    if (preset === "month") {
      setDateFrom(isoDate(new Date(now.getFullYear(), now.getMonth(), 1)))
      setDateTo(isoDate(now))
      return
    }
    if (preset === "last") {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const end = new Date(now.getFullYear(), now.getMonth(), 0)
      setDateFrom(isoDate(start))
      setDateTo(isoDate(end))
      return
    }
    setDateFrom(isoDate(new Date(now.getFullYear(), 0, 1)))
    setDateTo(isoDate(now))
  }

  function exportCsv() {
    const header = [
      "Date",
      "Type",
      "Tag",
      "Notes",
      "Currency",
      "Money in",
      "Money out",
      "We owe after",
      "They owe after",
      "Recorded by",
    ]
    const lines = [
      header.join(","),
      ...[...filtered]
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        .map((r) =>
          [
            fmtDate(r.createdAt),
            CATEGORY_LABEL[r.category] ?? r.category,
            r.tag,
            r.notes,
            r.currency,
            r.moneyIn,
            r.moneyOut,
            r.weOweAfter,
            r.theyOweAfter,
            r.created_by,
          ]
            .map(csvEscape)
            .join(","),
        ),
    ]
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `Voltrix-Loan-${profile.name.replace(/[^\w]+/g, "-")}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function exportPdf() {
    setExporting(true)
    try {
      const chrono = [...filtered].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      )
      await downloadLoanStatementPdf({
        personName: profile.name,
        periodLabel,
        generatedBy: userName,
        weOwe,
        theyOwe,
        periodIn,
        periodOut,
        txnCount: chrono.length,
        rows: chrono.map((r) => ({
          date: fmtDate(r.createdAt),
          type: CATEGORY_LABEL[r.category] ?? r.category,
          detail: [r.tag, r.notes].filter(Boolean).join(" · ") || r.created_by,
          moneyIn: r.moneyIn,
          moneyOut: r.moneyOut,
          weOweAfter: r.weOweAfter,
          theyOweAfter: r.theyOweAfter,
          recordedBy: r.created_by,
        })),
      })
    } finally {
      setExporting(false)
    }
  }

  const typeChips: { id: TypeFilter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "received", label: "Received" },
    { id: "given", label: "Given" },
    { id: "returned", label: "Returned" },
  ]

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-[10px] p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full sm:w-[min(920px,calc(100vw-2rem))] rounded-t-[22px] sm:rounded-[22px] bg-[#f5f5f7] dark:bg-[hsl(var(--background))] shadow-[0_24px_80px_rgba(0,0,0,0.28)] overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 flex items-start justify-between gap-3 px-5 pt-4 pb-3 sm:px-7 sm:pt-5">
          <div className="min-w-0 flex items-center gap-3">
            <div className="h-11 w-11 rounded-full bg-black/[0.06] text-[#1d1d1f] dark:bg-white/10 dark:text-white flex items-center justify-center text-[13px] font-semibold shrink-0">
              {initialsOf(profile.name)}
            </div>
            <div className="min-w-0">
              <p className="text-[20px] sm:text-[22px] font-semibold tracking-[-0.03em] text-[#1d1d1f] dark:text-[hsl(var(--foreground))] truncate">
                {profile.name}
              </p>
              <p className="text-[12px] text-[#86868b] mt-0.5">
                {profile.records.length} transaction{profile.records.length === 1 ? "" : "s"} · {fmtDate(new Date(profile.lastAt).toISOString())}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 shrink-0 inline-flex items-center justify-center rounded-full bg-black/[0.06] text-[#1d1d1f] hover:bg-black/[0.1] dark:bg-white/10 dark:text-white dark:hover:bg-white/15 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="h-4 w-4" strokeWidth={2.25} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 min-h-0 px-5 sm:px-7 pb-5 space-y-3.5">
          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-[14px] bg-white dark:bg-[hsl(var(--card))] border border-black/[0.04] dark:border-[hsl(var(--border))] px-4 py-3.5">
              <p className="text-[11px] font-medium text-[#86868b]">We owe</p>
              <p className="text-[22px] font-semibold tracking-tight tabular-nums text-[#ff3b30] mt-0.5">
                PKR {fmt(Math.max(0, weOwe))}
              </p>
              <p className="text-[11px] text-[#aeaeb2] mt-1 tabular-nums">
                In {fmt(profile.received)} · out {fmt(profile.repaid)}
              </p>
            </div>
            <div className="rounded-[14px] bg-white dark:bg-[hsl(var(--card))] border border-black/[0.04] dark:border-[hsl(var(--border))] px-4 py-3.5">
              <p className="text-[11px] font-medium text-[#86868b]">They owe</p>
              <p className="text-[22px] font-semibold tracking-tight tabular-nums text-[#248a3d] mt-0.5">
                PKR {fmt(Math.max(0, theyOwe))}
              </p>
              <p className="text-[11px] text-[#aeaeb2] mt-1 tabular-nums">
                Out {fmt(profile.given)} · in {fmt(profile.recovered)}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onOpenForm("receive", profile.name)}
              className="h-8 px-3.5 rounded-full bg-black/[0.06] text-[12px] font-semibold text-[#1d1d1f] hover:bg-black/[0.1] dark:bg-white/10 dark:text-white cursor-pointer transition-colors"
            >
              Loan received
            </button>
            <button
              type="button"
              onClick={() => onOpenForm("give", profile.name)}
              className="h-8 px-3.5 rounded-full bg-black/[0.06] text-[12px] font-semibold text-[#1d1d1f] hover:bg-black/[0.1] dark:bg-white/10 dark:text-white cursor-pointer transition-colors"
            >
              Give loan
            </button>
            <button
              type="button"
              onClick={() => onOpenForm("return", profile.name)}
              className="h-8 px-3.5 rounded-full bg-[#007aff] text-[12px] font-semibold text-white hover:bg-[#0066d6] cursor-pointer transition-colors"
            >
              Return loan
            </button>
          </div>

          <AppleGroup>
            <div className="px-3.5 py-3 space-y-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={inputCls + " h-8 w-[9.5rem]"} />
                <span className="text-[11px] text-[#aeaeb2]">to</span>
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={inputCls + " h-8 w-[9.5rem]"} />
                <div className="flex flex-wrap gap-1">
                  {(
                    [
                      ["all", "All"],
                      ["month", "Month"],
                      ["last", "Last"],
                      ["year", "Year"],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => applyPreset(id)}
                      className="h-7 px-2.5 rounded-full text-[11px] font-medium bg-black/[0.04] text-[#6e6e73] hover:bg-black/[0.08] cursor-pointer"
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="flex gap-1.5 ml-auto">
                  <button
                    type="button"
                    onClick={exportCsv}
                    disabled={filtered.length === 0}
                    className="h-7 px-2.5 rounded-full text-[11px] font-semibold bg-black/[0.06] text-[#1d1d1f] disabled:opacity-40 cursor-pointer"
                  >
                    CSV
                  </button>
                  <button
                    type="button"
                    onClick={() => void exportPdf()}
                    disabled={exporting}
                    className="h-7 px-2.5 rounded-full text-[11px] font-semibold bg-[#007aff] text-white disabled:opacity-40 cursor-pointer"
                  >
                    {exporting ? "PDF…" : "PDF"}
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1">
                {typeChips.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setTypeFilter(c.id)}
                    className={cn(
                      "h-7 px-2.5 rounded-full text-[11px] font-semibold cursor-pointer transition-colors",
                      typeFilter === c.id
                        ? "bg-[#1d1d1f] text-white dark:bg-white dark:text-[#1d1d1f]"
                        : "bg-black/[0.04] text-[#6e6e73] hover:bg-black/[0.08]",
                    )}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
              {(hasDateFilter || typeFilter !== "all") && (
                <p className="text-[11px] text-[#86868b] tabular-nums">
                  {filtered.length}/{profile.records.length} · in {fmt(periodIn)} · out {fmt(periodOut)}
                </p>
              )}
            </div>
          </AppleGroup>

          <AppleGroup title="History">
            {displayRows.length === 0 ? (
              <div className="px-4 py-10 text-center text-[13px] text-[#86868b]">No transactions in this range.</div>
            ) : (
              <div className="divide-y divide-black/[0.05] dark:divide-[hsl(var(--border))]">
                {displayRows.map((r) => (
                  <div key={r.id} className="px-3.5 py-3 flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <p className="text-[13px] font-semibold text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">
                          {CATEGORY_LABEL[r.category] ?? r.category}
                        </p>
                        <p className="text-[11px] text-[#aeaeb2] tabular-nums">{fmtDate(r.createdAt)}</p>
                      </div>
                      {(r.tag || r.notes) && (
                        <p className="text-[12px] text-[#6e6e73] mt-1 leading-snug whitespace-pre-wrap break-words">
                          {[r.tag, r.notes].filter(Boolean).join(" · ")}
                        </p>
                      )}
                      <p className="text-[11px] text-[#aeaeb2] mt-1.5 tabular-nums">
                        We owe {fmt(r.weOweAfter)} · They owe {fmt(r.theyOweAfter)}
                        {r.created_by ? ` · ${r.created_by}` : ""}
                      </p>
                    </div>
                    <div className="shrink-0 text-right space-y-1.5">
                      {r.moneyIn > 0.004 ? (
                        <p className="text-[13px] font-semibold tabular-nums text-[#248a3d]">
                          + {r.currency} {r.moneyIn.toLocaleString()}
                        </p>
                      ) : r.moneyOut > 0.004 ? (
                        <p className="text-[13px] font-semibold tabular-nums text-[#ff3b30]">
                          − {r.currency} {r.moneyOut.toLocaleString()}
                        </p>
                      ) : null}
                      <div className="flex items-center gap-1 justify-end">
                        {(r.proof_url || r.has_proof) && (
                          <button
                            type="button"
                            onClick={() => void openProof(r)}
                            className="h-7 w-7 inline-flex items-center justify-center rounded-full text-[#007aff] hover:bg-[#007aff]/10 cursor-pointer"
                            title="Proof"
                          >
                            <FileText className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm("Delete this loan transaction?")) onDelete(r.id)
                          }}
                          className="h-7 w-7 inline-flex items-center justify-center rounded-full text-[#ff3b30] hover:bg-[#ff3b30]/10 cursor-pointer"
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </AppleGroup>
        </div>

        {proofRecord &&
          createPortal(
            <div
              className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 backdrop-blur-[10px] p-4"
              onClick={() => setProofRecord(null)}
            >
              <div
                className="w-full max-w-lg rounded-[20px] bg-[#f5f5f7] dark:bg-[hsl(var(--background))] shadow-[0_24px_80px_rgba(0,0,0,0.28)] overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between gap-3 px-5 py-3.5">
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold truncate">
                      {activeProof?.name || proofRecord.proof_name || "Proof"}
                    </p>
                    {proofItems.length > 1 && (
                      <p className="text-[11px] text-[#86868b] mt-0.5">
                        {Math.min(proofIndex, proofItems.length - 1) + 1} of {proofItems.length}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setProofRecord(null)}
                    className="h-8 w-8 shrink-0 inline-flex items-center justify-center rounded-full bg-black/[0.06] cursor-pointer"
                  >
                    <X className="h-4 w-4" strokeWidth={2.25} />
                  </button>
                </div>
                <div className="px-5 pb-5 space-y-3">
                  {proofLoading || !proofRecord.proof_url ? (
                    <p className="text-[13px] text-[#86868b] py-8 text-center">Loading proof…</p>
                  ) : !activeProof ? (
                    <p className="text-[13px] text-[#86868b] py-8 text-center">No proof found</p>
                  ) : isImageProofUrl(activeProof.url) ? (
                    <img
                      src={activeProof.url}
                      alt={activeProof.name}
                      className="w-full rounded-[14px] object-contain max-h-[60vh]"
                    />
                  ) : isPdfProofUrl(activeProof.url) ? (
                    <iframe
                      src={activeProof.url}
                      className="w-full h-[60vh] rounded-[14px]"
                      title={activeProof.name}
                    />
                  ) : (
                    <a
                      href={activeProof.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-[13px] text-[#007aff] hover:underline"
                    >
                      <FileText className="h-4 w-4" /> View {activeProof.name || "document"}
                    </a>
                  )}
                  {proofItems.length > 1 && (
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        disabled={proofIndex <= 0}
                        onClick={() => setProofIndex((i) => Math.max(0, i - 1))}
                        className="h-9 px-3 rounded-full bg-black/[0.06] text-[12px] font-semibold disabled:opacity-40 cursor-pointer"
                      >
                        Previous
                      </button>
                      <div className="flex gap-1.5 flex-wrap justify-center">
                        {proofItems.map((_, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => setProofIndex(i)}
                            className={cn(
                              "h-2 w-2 rounded-full cursor-pointer",
                              i === proofIndex ? "bg-[#007aff]" : "bg-black/20",
                            )}
                            aria-label={`Proof ${i + 1}`}
                          />
                        ))}
                      </div>
                      <button
                        type="button"
                        disabled={proofIndex >= proofItems.length - 1}
                        onClick={() => setProofIndex((i) => Math.min(proofItems.length - 1, i + 1))}
                        className="h-9 px-3 rounded-full bg-black/[0.06] text-[12px] font-semibold disabled:opacity-40 cursor-pointer"
                      >
                        Next
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>,
            document.body,
          )}
      </div>
    </div>,
    document.body,
  )

}

/* ------------------------------------------------------------------ */
/* Loan center panel                                                   */
/* ------------------------------------------------------------------ */

function LoanPersonRow({
  name,
  txns,
  lastAt,
  balance,
  tone,
  onOpen,
}: {
  name: string
  txns: number
  lastAt: number
  balance: number
  tone: "owe" | "owed"
  onOpen: () => void
}) {
  const settled = balance <= 0.004
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full text-left px-3.5 py-3 flex items-center gap-3 hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition-colors cursor-pointer"
    >
      <div className="h-9 w-9 rounded-full bg-black/[0.06] text-[#1d1d1f] dark:bg-white/10 dark:text-white flex items-center justify-center text-[11px] font-semibold shrink-0">
        {initialsOf(name)}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-[#1d1d1f] dark:text-[hsl(var(--foreground))] truncate">{name}</p>
        <p className="text-[11px] text-[#86868b] mt-0.5">
          {txns} txn{txns === 1 ? "" : "s"} · {fmtDate(new Date(lastAt).toISOString())}
        </p>
      </div>
      <div className="shrink-0 text-right">
        {settled ? (
          <p className="text-[12px] font-medium text-[#86868b]">Settled</p>
        ) : (
          <p
            className={cn(
              "text-[13px] font-semibold tabular-nums",
              tone === "owe" ? "text-[#ff3b30]" : "text-[#248a3d]",
            )}
          >
            PKR {fmt(balance)}
          </p>
        )}
      </div>
    </button>
  )
}

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

  const profiles = useMemo(() => buildLoanProfiles(records), [records])
  const activeProfile = profileKey ? profiles.find((p) => p.key === profileKey) ?? null : null

  useEffect(() => {
    if (autoOpenReceive) setForm({ mode: "receive", person: "" })
  }, [autoOpenReceive])

  const taken = useMemo(
    () =>
      profiles
        .filter((p) => p.received > 0.004)
        .map((p) => ({ ...p, balance: p.received - p.repaid }))
        .sort((a, b) => b.balance - a.balance || b.lastAt - a.lastAt),
    [profiles],
  )
  const given = useMemo(
    () =>
      profiles
        .filter((p) => p.given > 0.004)
        .map((p) => ({ ...p, balance: p.given - p.recovered }))
        .sort((a, b) => b.balance - a.balance || b.lastAt - a.lastAt),
    [profiles],
  )

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => setForm({ mode: "receive", person: "" })}
          className="h-8 px-3.5 rounded-full bg-black/[0.06] text-[12px] font-semibold text-[#1d1d1f] hover:bg-black/[0.1] dark:bg-white/10 dark:text-white cursor-pointer transition-colors"
        >
          Received
        </button>
        <button
          type="button"
          onClick={() => setForm({ mode: "give", person: "" })}
          className="h-8 px-3.5 rounded-full bg-black/[0.06] text-[12px] font-semibold text-[#1d1d1f] hover:bg-black/[0.1] dark:bg-white/10 dark:text-white cursor-pointer transition-colors"
        >
          Given
        </button>
        <button
          type="button"
          onClick={() => setForm({ mode: "return", person: "" })}
          className="h-8 px-3.5 rounded-full bg-[#007aff] text-[12px] font-semibold text-white hover:bg-[#0066d6] cursor-pointer transition-colors"
        >
          Return
        </button>
      </div>

      {profiles.length === 0 ? (
        <div className="rounded-[14px] border border-dashed border-black/[0.1] px-4 py-10 text-center">
          <Users className="h-7 w-7 mx-auto text-[#aeaeb2] mb-2" />
          <p className="text-[13px] text-[#86868b]">No loans yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <AppleGroup title="Loans we take">
            {taken.length === 0 ? (
              <div className="px-4 py-8 text-center text-[13px] text-[#86868b]">None</div>
            ) : (
              <div className="divide-y divide-black/[0.05] dark:divide-[hsl(var(--border))]">
                {taken.map((p) => (
                  <LoanPersonRow
                    key={`take-${p.key}`}
                    name={p.name}
                    txns={p.records.length}
                    lastAt={p.lastAt}
                    balance={p.balance}
                    tone="owe"
                    onOpen={() => setProfileKey(p.key)}
                  />
                ))}
              </div>
            )}
          </AppleGroup>

          <AppleGroup title="Loans we give">
            {given.length === 0 ? (
              <div className="px-4 py-8 text-center text-[13px] text-[#86868b]">None</div>
            ) : (
              <div className="divide-y divide-black/[0.05] dark:divide-[hsl(var(--border))]">
                {given.map((p) => (
                  <LoanPersonRow
                    key={`give-${p.key}`}
                    name={p.name}
                    txns={p.records.length}
                    lastAt={p.lastAt}
                    balance={p.balance}
                    tone="owed"
                    onOpen={() => setProfileKey(p.key)}
                  />
                ))}
              </div>
            )}
          </AppleGroup>
        </div>
      )}

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
          userName={userName}
          onClose={() => setProfileKey(null)}
          onDelete={onDelete}
          onOpenForm={(mode, person) => setForm({ mode, person })}
        />
      )}
    </div>
  )
}
