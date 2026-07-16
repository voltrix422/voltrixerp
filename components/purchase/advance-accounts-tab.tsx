"use client"
import { useEffect, useMemo, useState } from "react"
import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, Trash2, Upload, X, FileText, Wallet, Search, ArrowDownCircle, ArrowUpCircle, Receipt } from "lucide-react"
import {
  addAdvanceTransaction,
  deleteAdvanceAccount,
  deleteAdvanceTransaction,
  getAdvanceAccounts,
  saveAdvanceAccount,
  type AdvanceAccount,
} from "@/lib/advance-accounts"
import { uploadFile } from "@/lib/upload"

const inputCls =
  "w-full h-8 rounded-md border bg-[hsl(var(--background))] px-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#1faca6]/40 focus:border-[#1faca6]"

function fmtMoney(n: number) {
  return `Rs. ${n.toLocaleString("en-PK", { maximumFractionDigits: 2 })}`
}

const Field = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
  <div className="space-y-1 min-w-0">
    <label className="text-[11px] font-medium text-[hsl(var(--foreground))]">{label}</label>
    {children}
    {hint && <p className="text-[10px] text-[hsl(var(--muted-foreground))] leading-tight">{hint}</p>}
  </div>
)

export function AdvanceAccountsTab({ purchaseScopeId }: { purchaseScopeId: string }) {
  const { user } = useAuth()
  const [accounts, setAccounts] = useState<AdvanceAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "closed">("all")

  const [showNewForm, setShowNewForm] = useState(false)
  const [newPersonName, setNewPersonName] = useState("")
  const [newPurpose, setNewPurpose] = useState("")
  const [newDeposit, setNewDeposit] = useState("")
  const [newDepositDate, setNewDepositDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [newDepositReceipt, setNewDepositReceipt] = useState<File | null>(null)
  const [newNotes, setNewNotes] = useState("")
  const [savingNew, setSavingNew] = useState(false)

  const [detailId, setDetailId] = useState<string | null>(null)
  const detail = useMemo(() => accounts.find(a => a.id === detailId) ?? null, [accounts, detailId])

  const [txnType, setTxnType] = useState<"deposit" | "expense">("expense")
  const [txnAmount, setTxnAmount] = useState("")
  const [txnDate, setTxnDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [txnDescription, setTxnDescription] = useState("")
  const [txnReceipt, setTxnReceipt] = useState<File | null>(null)
  const [savingTxn, setSavingTxn] = useState(false)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setAccounts(await getAdvanceAccounts(purchaseScopeId))
      setLoading(false)
    }
    void load()
  }, [purchaseScopeId])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return accounts.filter(account => {
      if (statusFilter !== "all" && account.status !== statusFilter) return false
      if (!q) return true
      return (
        account.personName.toLowerCase().includes(q)
        || account.purpose.toLowerCase().includes(q)
        || account.notes.toLowerCase().includes(q)
      )
    })
  }, [accounts, search, statusFilter])

  const totals = useMemo(() => filtered.reduce(
    (acc, account) => ({
      deposited: acc.deposited + account.totalDeposited,
      spent: acc.spent + account.totalSpent,
      balance: acc.balance + account.balance,
    }),
    { deposited: 0, spent: 0, balance: 0 },
  ), [filtered])

  function resetTxnForm(defaultType: "deposit" | "expense" = "expense") {
    setTxnType(defaultType)
    setTxnAmount("")
    setTxnDate(new Date().toISOString().slice(0, 10))
    setTxnDescription("")
    setTxnReceipt(null)
  }

  function openDetail(id: string) {
    setDetailId(id)
    resetTxnForm()
  }

  async function handleCreateAccount(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    if (!newPersonName.trim()) {
      alert("Enter the person's name.")
      return
    }
    setSavingNew(true)
    try {
      const depositAmount = parseFloat(newDeposit) || 0
      let receiptUrl = ""
      let receiptName = ""
      if (depositAmount > 0 && newDepositReceipt) {
        receiptUrl = await uploadFile(newDepositReceipt, "advance-receipts")
        receiptName = newDepositReceipt.name
      }
      const saved = await saveAdvanceAccount({
        purchaseScopeId,
        personName: newPersonName.trim(),
        purpose: newPurpose.trim(),
        notes: newNotes.trim(),
        initialDeposit: depositAmount,
        initialDepositDate: newDepositDate || new Date().toISOString().slice(0, 10),
        initialDepositReceiptUrl: receiptUrl,
        initialDepositReceiptName: receiptName,
        createdBy: user.name,
      })
      setAccounts(prev => [saved, ...prev])
      setShowNewForm(false)
      setNewPersonName("")
      setNewPurpose("")
      setNewDeposit("")
      setNewDepositDate(new Date().toISOString().slice(0, 10))
      setNewDepositReceipt(null)
      setNewNotes("")
      openDetail(saved.id)
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to create account. Please try again.")
    } finally {
      setSavingNew(false)
    }
  }

  async function handleAddTransaction(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !detail) return
    const amount = parseFloat(txnAmount) || 0
    if (amount <= 0) {
      alert("Enter an amount greater than zero.")
      return
    }
    setSavingTxn(true)
    try {
      let receiptUrl = ""
      let receiptName = ""
      if (txnReceipt) {
        receiptUrl = await uploadFile(txnReceipt, "advance-receipts")
        receiptName = txnReceipt.name
      }
      const updated = await addAdvanceTransaction(detail.id, {
        type: txnType,
        amount,
        date: txnDate,
        description: txnDescription.trim(),
        receiptUrl,
        receiptName,
        createdBy: user.name,
      })
      setAccounts(prev => prev.map(a => a.id === updated.id ? updated : a))
      resetTxnForm(txnType)
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to record transaction. Please try again.")
    } finally {
      setSavingTxn(false)
    }
  }

  async function handleDeleteTransaction(transactionId: string) {
    if (!detail) return
    if (!confirm("Delete this transaction?")) return
    try {
      const updated = await deleteAdvanceTransaction(detail.id, transactionId)
      setAccounts(prev => prev.map(a => a.id === updated.id ? updated : a))
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to delete transaction.")
    }
  }

  async function handleToggleStatus(account: AdvanceAccount) {
    try {
      const updated = await saveAdvanceAccount({
        id: account.id,
        purchaseScopeId: account.purchaseScopeId,
        personName: account.personName,
        purpose: account.purpose,
        notes: account.notes,
        status: account.status === "open" ? "closed" : "open",
      })
      setAccounts(prev => prev.map(a => a.id === updated.id ? updated : a))
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to update account.")
    }
  }

  async function handleDeleteAccount(id: string) {
    if (!confirm("Delete this advance account and all its transactions?")) return
    await deleteAdvanceAccount(id)
    setAccounts(prev => prev.filter(a => a.id !== id))
    if (detailId === id) setDetailId(null)
  }

  const sortedTxns = detail
    ? [...detail.transactions].sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt))
    : []

  return (
    <div className="p-4 sm:p-6 pt-4 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Advance accounts</h2>
          <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
            Give money upfront, collect receipts against it, and track the remaining balance.
          </p>
        </div>
        <Button size="sm" className="h-8 text-xs cursor-pointer" onClick={() => setShowNewForm(true)}>
          <Plus className="h-3.5 w-3.5" /> New advance account
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div className="rounded-lg border bg-[hsl(var(--card))] px-3 py-2.5">
          <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Total deposited</p>
          <p className="text-sm font-semibold text-[#1faca6] mt-0.5">{fmtMoney(totals.deposited)}</p>
        </div>
        <div className="rounded-lg border bg-[hsl(var(--card))] px-3 py-2.5">
          <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Total spent (receipts)</p>
          <p className="text-sm font-semibold text-amber-700 dark:text-amber-400 mt-0.5">{fmtMoney(totals.spent)}</p>
        </div>
        <div className="rounded-lg border bg-[hsl(var(--card))] px-3 py-2.5">
          <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Remaining with people</p>
          <p className="text-sm font-semibold text-emerald-600 mt-0.5">{fmtMoney(totals.balance)}</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search person, purpose..."
            className={`${inputCls} pl-8`}
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as "all" | "open" | "closed")}
          className="h-8 rounded-md border bg-[hsl(var(--background))] px-2 text-xs"
        >
          <option value="all">All accounts</option>
          <option value="open">Open</option>
          <option value="closed">Closed</option>
        </select>
      </div>

      {loading ? (
        <div className="rounded-lg border border-dashed px-4 py-10 text-center text-xs text-[hsl(var(--muted-foreground))]">
          Loading advance accounts...
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed px-4 py-10 text-center">
          <Wallet className="h-8 w-8 mx-auto mb-3 text-[hsl(var(--muted-foreground))]" />
          <p className="text-sm font-medium">No advance accounts yet</p>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
            Create one when you hand someone money upfront — e.g. Rs. 20,000 for social media, office supplies, or errands.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <table className="w-full text-xs min-w-[720px]">
            <thead>
              <tr className="border-b bg-[hsl(var(--muted))]/25 text-left text-[10px] text-[hsl(var(--muted-foreground))]">
                <th className="px-3 py-2 font-medium">Person</th>
                <th className="px-3 py-2 font-medium">Purpose</th>
                <th className="px-3 py-2 font-medium text-right">Deposited</th>
                <th className="px-3 py-2 font-medium text-right">Spent</th>
                <th className="px-3 py-2 font-medium text-right">Remaining</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map(account => (
                <tr
                  key={account.id}
                  className="hover:bg-[hsl(var(--muted))]/15 cursor-pointer"
                  onClick={() => openDetail(account.id)}
                >
                  <td className="px-3 py-2.5 font-medium">{account.personName}</td>
                  <td className="px-3 py-2.5 text-[hsl(var(--muted-foreground))]">{account.purpose || "—"}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{fmtMoney(account.totalDeposited)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{fmtMoney(account.totalSpent)}</td>
                  <td className={`px-3 py-2.5 text-right tabular-nums font-semibold ${account.balance < 0 ? "text-red-500" : "text-emerald-600"}`}>
                    {fmtMoney(account.balance)}
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge variant={account.status === "open" ? "default" : "secondary"} className="text-[10px]">
                      {account.status === "open" ? "Open" : "Closed"}
                    </Badge>
                  </td>
                  <td className="px-3 py-2.5 text-right" onClick={e => e.stopPropagation()}>
                    <Button size="sm" variant="outline" className="h-7 text-[10px] cursor-pointer" onClick={() => openDetail(account.id)}>
                      Open
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showNewForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowNewForm(false)}>
          <div className="w-full max-w-md rounded-xl border bg-[hsl(var(--card))] shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <div>
                <h3 className="text-sm font-semibold">New advance account</h3>
                <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Deposit money to someone and track their receipts</p>
              </div>
              <Button size="icon" variant="ghost" className="h-7 w-7 cursor-pointer" onClick={() => setShowNewForm(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <form onSubmit={handleCreateAccount} className="px-4 py-4 space-y-3">
              <Field label="Person name">
                <input value={newPersonName} onChange={e => setNewPersonName(e.target.value)} placeholder="e.g. Yasir masih" className={inputCls} autoFocus />
              </Field>
              <Field label="Purpose" hint="What is this budget for?">
                <input value={newPurpose} onChange={e => setNewPurpose(e.target.value)} placeholder="e.g. Social media marketing" className={inputCls} />
              </Field>
              <Field label="Initial deposit" hint="Money handed over now — you can add more later">
                <input type="number" min="0" step="any" value={newDeposit} onChange={e => setNewDeposit(e.target.value)} placeholder="e.g. 20,000" className={inputCls} inputMode="decimal" />
              </Field>
              <Field label="Payment date" hint="Date this deposit was given">
                <input type="date" value={newDepositDate} onChange={e => setNewDepositDate(e.target.value)} className={inputCls} />
              </Field>
              <Field label="Deposit receipt / proof" hint="Optional · image or PDF for the initial deposit">
                <label className="flex items-center gap-2 h-9 rounded-md border border-dashed px-3 cursor-pointer hover:bg-[hsl(var(--muted))]/25 transition-colors">
                  <Upload className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))] shrink-0" />
                  <span className="text-[11px] truncate">{newDepositReceipt ? newDepositReceipt.name : "Click to attach receipt"}</span>
                  <input type="file" accept="image/*,.pdf" className="hidden" onChange={e => setNewDepositReceipt(e.target.files?.[0] ?? null)} />
                </label>
              </Field>
              <Field label="Notes">
                <input value={newNotes} onChange={e => setNewNotes(e.target.value)} placeholder="Optional" className={inputCls} />
              </Field>
              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" size="sm" variant="outline" className="h-8 text-xs cursor-pointer" onClick={() => setShowNewForm(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" className="h-8 text-xs cursor-pointer" disabled={savingNew}>
                  {savingNew ? "Creating..." : "Create account"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setDetailId(null)}>
          <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-xl border bg-[hsl(var(--card))] shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold truncate">{detail.personName}</h3>
                  <Badge variant={detail.status === "open" ? "default" : "secondary"} className="text-[10px]">
                    {detail.status === "open" ? "Open" : "Closed"}
                  </Badge>
                </div>
                <p className="text-[10px] text-[hsl(var(--muted-foreground))] truncate">
                  {detail.purpose || "Advance account"}{detail.notes ? ` · ${detail.notes}` : ""}
                </p>
              </div>
              <Button size="icon" variant="ghost" className="h-7 w-7 cursor-pointer shrink-0" onClick={() => setDetailId(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="overflow-y-auto px-4 py-4 space-y-4">
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-md border bg-[hsl(var(--muted))]/10 px-2.5 py-2 text-center">
                  <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Deposited</p>
                  <p className="text-sm font-semibold mt-0.5 text-[#1faca6]">{fmtMoney(detail.totalDeposited)}</p>
                </div>
                <div className="rounded-md border bg-[hsl(var(--muted))]/10 px-2.5 py-2 text-center">
                  <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Spent</p>
                  <p className="text-sm font-semibold mt-0.5 text-amber-700 dark:text-amber-400">{fmtMoney(detail.totalSpent)}</p>
                </div>
                <div className="rounded-md border bg-[hsl(var(--muted))]/10 px-2.5 py-2 text-center">
                  <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Remaining</p>
                  <p className={`text-sm font-semibold mt-0.5 ${detail.balance < 0 ? "text-red-500" : "text-emerald-600"}`}>
                    {fmtMoney(detail.balance)}
                  </p>
                </div>
              </div>

              {detail.status === "open" && (
                <form onSubmit={handleAddTransaction} className="rounded-lg border bg-[hsl(var(--muted))]/10 p-3 space-y-3">
                  <div className="flex items-center gap-1 rounded-md border bg-[hsl(var(--background))] p-1 w-fit">
                    <button
                      type="button"
                      onClick={() => setTxnType("expense")}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded cursor-pointer transition-colors ${
                        txnType === "expense" ? "bg-amber-500/15 text-amber-700 dark:text-amber-400" : "text-[hsl(var(--muted-foreground))]"
                      }`}
                    >
                      <Receipt className="h-3.5 w-3.5" /> Add receipt / expense
                    </button>
                    <button
                      type="button"
                      onClick={() => setTxnType("deposit")}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded cursor-pointer transition-colors ${
                        txnType === "deposit" ? "bg-[#1faca6]/15 text-[#1faca6]" : "text-[hsl(var(--muted-foreground))]"
                      }`}
                    >
                      <Wallet className="h-3.5 w-3.5" /> Add deposit
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="Amount">
                      <input type="number" min="0" step="any" value={txnAmount} onChange={e => setTxnAmount(e.target.value)} placeholder="e.g. 2,500" className={inputCls} inputMode="decimal" />
                    </Field>
                    <Field label="Date">
                      <input type="date" value={txnDate} onChange={e => setTxnDate(e.target.value)} className={inputCls} />
                    </Field>
                  </div>
                  <Field label={txnType === "expense" ? "What was it spent on?" : "Note"}>
                    <input value={txnDescription} onChange={e => setTxnDescription(e.target.value)} placeholder={txnType === "expense" ? "e.g. Facebook ads boost" : "Optional"} className={inputCls} />
                  </Field>
                  <Field label={txnType === "expense" ? "Receipt" : "Proof"} hint="Optional · image or PDF">
                    <label className="flex items-center gap-2 h-9 rounded-md border border-dashed px-3 cursor-pointer hover:bg-[hsl(var(--muted))]/25 transition-colors">
                      <Upload className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))] shrink-0" />
                      <span className="text-[11px] truncate">{txnReceipt ? txnReceipt.name : "Click to attach"}</span>
                      <input type="file" accept="image/*,.pdf" className="hidden" onChange={e => setTxnReceipt(e.target.files?.[0] ?? null)} />
                    </label>
                  </Field>
                  <div className="flex justify-end">
                    <Button type="submit" size="sm" className="h-8 text-xs cursor-pointer" disabled={savingTxn}>
                      {savingTxn ? "Saving..." : txnType === "expense" ? "Add expense" : "Add deposit"}
                    </Button>
                  </div>
                </form>
              )}

              <div className="space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                  Transactions ({detail.transactions.length})
                </p>
                {sortedTxns.length === 0 ? (
                  <p className="text-xs text-[hsl(var(--muted-foreground))] py-3 text-center border border-dashed rounded-md">
                    No transactions yet.
                  </p>
                ) : (
                  <ul className="divide-y rounded-md border">
                    {sortedTxns.map(txn => (
                      <li key={txn.id} className="flex items-center gap-3 px-3 py-2.5">
                        {txn.type === "deposit" ? (
                          <ArrowDownCircle className="h-4 w-4 text-[#1faca6] shrink-0" />
                        ) : (
                          <ArrowUpCircle className="h-4 w-4 text-amber-600 shrink-0" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium truncate">
                            {txn.description || (txn.type === "deposit" ? "Deposit" : "Expense")}
                          </p>
                          <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
                            {txn.date}{txn.createdBy ? ` · ${txn.createdBy}` : ""}
                            {txn.referenceType === "purchase_ledger" && txn.referenceNumber
                              ? ` · Ledger ${txn.referenceNumber}`
                              : ""}
                          </p>
                          {txn.referenceType === "purchase_ledger" && (
                            <p className="text-[10px] text-amber-700 dark:text-amber-400 mt-0.5">
                              From purchase ledger
                            </p>
                          )}
                        </div>
                        {txn.receiptUrl && (
                          <a href={txn.receiptUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[10px] text-[#1faca6] hover:underline shrink-0">
                            <FileText className="h-3 w-3" /> Receipt
                          </a>
                        )}
                        <span className={`text-xs font-semibold tabular-nums shrink-0 ${txn.type === "deposit" ? "text-[#1faca6]" : "text-amber-700 dark:text-amber-400"}`}>
                          {txn.type === "deposit" ? "+" : "−"}{fmtMoney(txn.amount)}
                        </span>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500 shrink-0 cursor-pointer" onClick={() => handleDeleteTransaction(txn.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-t">
              <Button size="sm" variant="ghost" className="h-8 text-xs text-red-500 cursor-pointer" onClick={() => handleDeleteAccount(detail.id)}>
                <Trash2 className="h-3.5 w-3.5" /> Delete account
              </Button>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" className="h-8 text-xs cursor-pointer" onClick={() => handleToggleStatus(detail)}>
                  {detail.status === "open" ? "Close account" : "Reopen account"}
                </Button>
                <Button size="sm" className="h-8 text-xs cursor-pointer" onClick={() => setDetailId(null)}>
                  Done
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
