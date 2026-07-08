"use client"

import { Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { normalizeSupplierBankNames } from "@/lib/supplier-bank"

const inputCls =
  "w-full h-8 rounded-md border bg-[hsl(var(--background))] px-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#1faca6]/40 focus:border-[#1faca6]"

type Props = {
  accountTitle: string
  bankNames: string[]
  bankIban: string
  onAccountTitleChange: (value: string) => void
  onBankNamesChange: (names: string[]) => void
  onBankIbanChange: (value: string) => void
  compact?: boolean
}

export function SupplierBankFields({
  accountTitle,
  bankNames,
  bankIban,
  onAccountTitleChange,
  onBankNamesChange,
  onBankIbanChange,
  compact = false,
}: Props) {
  const banks = bankNames.length > 0 ? bankNames : [""]

  function updateBank(index: number, value: string) {
    const next = [...banks]
    next[index] = value
    onBankNamesChange(normalizeSupplierBankNames(next))
  }

  function addBank() {
    onBankNamesChange(normalizeSupplierBankNames([...banks, ""]))
  }

  function removeBank(index: number) {
    const next = banks.filter((_, i) => i !== index)
    onBankNamesChange(normalizeSupplierBankNames(next.length > 0 ? next : [""]))
  }

  const labelCls = compact ? "text-[11px] font-medium" : "text-xs font-medium"

  return (
    <div className="space-y-3 sm:col-span-2">
      <div className="space-y-1">
        <label className={labelCls}>Account title / title name</label>
        <input
          value={accountTitle}
          onChange={e => onAccountTitleChange(e.target.value)}
          placeholder="e.g. Voltrix Batteries Pvt Ltd"
          className={inputCls}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <label className={labelCls}>Bank name</label>
          <Button type="button" size="sm" variant="outline" className="h-7 text-[10px] cursor-pointer" onClick={addBank}>
            <Plus className="h-3 w-3" /> Add bank
          </Button>
        </div>
        <div className="space-y-2">
          {banks.map((bank, index) => (
            <div key={index} className="flex items-center gap-2">
              <input
                value={bank}
                onChange={e => updateBank(index, e.target.value)}
                placeholder={`Bank name ${index + 1}`}
                className={inputCls}
              />
              {banks.length > 1 && (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 shrink-0 text-red-500"
                  onClick={() => removeBank(index)}
                  title="Remove bank"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-1">
        <label className={labelCls}>Bank IBAN</label>
        <input
          value={bankIban}
          onChange={e => onBankIbanChange(e.target.value)}
          placeholder="PK00XXXX0000000000000000"
          className={inputCls}
        />
      </div>
    </div>
  )
}
