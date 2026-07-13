"use client"

import { Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { emptySupplierBankAccount, type SupplierBankAccount } from "@/lib/supplier-bank"

const inputCls =
  "w-full min-w-0 h-9 sm:h-8 rounded-md border bg-[hsl(var(--background))] px-2.5 text-sm sm:text-xs focus:outline-none focus:ring-2 focus:ring-[#1faca6]/40 focus:border-[#1faca6]"

type Props = {
  bankAccounts: SupplierBankAccount[]
  onBankAccountsChange: (accounts: SupplierBankAccount[]) => void
  compact?: boolean
}

export function SupplierBankFields({
  bankAccounts,
  onBankAccountsChange,
  compact = false,
}: Props) {
  const accounts = bankAccounts.length > 0 ? bankAccounts : [emptySupplierBankAccount()]

  function updateAccount(index: number, key: keyof SupplierBankAccount, value: string) {
    const next = accounts.map((account, i) => (i === index ? { ...account, [key]: value } : account))
    onBankAccountsChange(next)
  }

  function addBank() {
    onBankAccountsChange([...accounts, emptySupplierBankAccount()])
  }

  function removeBank(index: number) {
    const next = accounts.filter((_, i) => i !== index)
    onBankAccountsChange(next.length > 0 ? next : [emptySupplierBankAccount()])
  }

  const labelCls = compact ? "text-[11px] font-medium" : "text-xs font-medium"
  const sectionTitleCls = compact ? "text-[11px] font-semibold" : "text-xs font-semibold"

  return (
    <div className="rounded-lg border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--muted))]/10 p-2.5 sm:p-3 space-y-2.5 sm:space-y-3 min-w-0">
      <div className="flex items-center justify-between gap-2 min-w-0">
        <p className={`${sectionTitleCls} min-w-0 truncate`}>Bank account details</p>
        <Button type="button" size="sm" variant="outline" className="h-7 shrink-0 text-[10px] cursor-pointer px-2" onClick={addBank}>
          <Plus className="h-3 w-3" /> Add bank
        </Button>
      </div>

      <div className="space-y-2.5 sm:space-y-3">
        {accounts.map((account, index) => (
          <div key={index} className="rounded-md border bg-[hsl(var(--card))] p-2.5 sm:p-3 space-y-2 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className={labelCls}>Bank {index + 1}</p>
              {accounts.length > 1 && (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 shrink-0 text-red-500"
                  onClick={() => removeBank(index)}
                  title="Remove bank"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>

            <div className="space-y-1 min-w-0">
              <label className={labelCls}>Account title / title name</label>
              <input
                value={account.accountTitle}
                onChange={e => updateAccount(index, "accountTitle", e.target.value)}
                placeholder="Account title"
                className={inputCls}
              />
            </div>

            <div className="space-y-1 min-w-0">
              <label className={labelCls}>Bank name</label>
              <input
                value={account.bankName}
                onChange={e => updateAccount(index, "bankName", e.target.value)}
                placeholder={`Bank name ${index + 1}`}
                className={inputCls}
              />
            </div>

            <div className="space-y-1 min-w-0">
              <label className={labelCls}>Bank IBAN</label>
              <input
                value={account.bankIban}
                onChange={e => updateAccount(index, "bankIban", e.target.value)}
                placeholder="PK00...0000"
                inputMode="text"
                autoComplete="off"
                spellCheck={false}
                className={`${inputCls} font-mono tracking-tight`}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
