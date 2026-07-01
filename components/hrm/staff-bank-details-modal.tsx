"use client"

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import {
  allStaffBankDetailsCopyText,
  downloadStaffBankDetailsExcel,
  staffBankDetailsCopyText,
  type StaffExportRow,
} from "@/lib/hrm-excel-export"
import { Copy, Download, Search, X } from "lucide-react"

type Props = {
  staff: StaffExportRow[]
  exportedBy?: string
  onClose: () => void
}

function hasBankDetails(s: StaffExportRow) {
  return !!(s.bank_name?.trim() || s.bank_account_number?.trim() || s.bank_account_title?.trim())
}

export function StaffBankDetailsModal({ staff, exportedBy, onClose }: Props) {
  const { toast } = useToast()
  const [search, setSearch] = useState("")
  const [exporting, setExporting] = useState(false)
  const [showMissing, setShowMissing] = useState(false)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return staff.filter((s) => {
      if (!showMissing && !hasBankDetails(s)) return false
      if (!q) return true
      return (
        s.name.toLowerCase().includes(q) ||
        (s.department || "").toLowerCase().includes(q) ||
        (s.bank_name || "").toLowerCase().includes(q) ||
        (s.bank_account_number || "").toLowerCase().includes(q) ||
        (s.bank_account_title || "").toLowerCase().includes(q)
      )
    })
  }, [staff, search, showMissing])

  const withBankCount = staff.filter(hasBankDetails).length

  async function copyText(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text)
      toast({ title: "Copied", message: label, type: "success" })
    } catch {
      toast({ title: "Copy failed", message: "Could not copy to clipboard.", type: "error" })
    }
  }

  function handleExport() {
    setExporting(true)
    try {
      const count = downloadStaffBankDetailsExcel(staff, exportedBy)
      toast({
        title: "Download started",
        message: `${count} staff bank account${count === 1 ? "" : "s"} exported.`,
        type: "success",
      })
    } finally {
      setExporting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-5xl rounded-2xl border bg-[hsl(var(--card))] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b shrink-0">
          <div>
            <p className="text-lg font-bold">Staff bank accounts</p>
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
              {withBankCount} of {staff.length} staff have bank details on file
            </p>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="px-5 py-3 border-b flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between shrink-0">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, bank, account…"
              className="w-full h-9 rounded-md border bg-[hsl(var(--background))] pl-9 pr-3 text-sm"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))] cursor-pointer">
              <input
                type="checkbox"
                checked={showMissing}
                onChange={(e) => setShowMissing(e.target.checked)}
                className="rounded"
              />
              Show staff without bank details
            </label>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs gap-1.5"
              onClick={() =>
                copyText(allStaffBankDetailsCopyText(staff), "All bank details copied")
              }
              disabled={withBankCount === 0}
            >
              <Copy className="h-3.5 w-3.5" />
              Copy all
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs gap-1.5"
              onClick={handleExport}
              disabled={exporting || withBankCount === 0}
            >
              <Download className="h-3.5 w-3.5" />
              {exporting ? "Exporting…" : "Export Excel"}
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          {filtered.length === 0 ? (
            <p className="p-8 text-center text-sm text-[hsl(var(--muted-foreground))]">
              No staff match your search.
            </p>
          ) : (
            <table className="w-full text-sm min-w-[48rem]">
              <thead className="sticky top-0 bg-[hsl(var(--muted))]/60 border-b z-10">
                <tr>
                  {["Staff name", "Bank name", "Account number", "Account title", "Salary", ""].map((h) => (
                    <th
                      key={h || "actions"}
                      className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((member) => {
                  const complete = hasBankDetails(member)
                  return (
                    <tr
                      key={member.id}
                      className={complete ? "hover:bg-[hsl(var(--muted))]/20" : "opacity-60 hover:bg-[hsl(var(--muted))]/10"}
                    >
                      <td className="px-4 py-3 font-medium">{member.name}</td>
                      <td className="px-4 py-3">{member.bank_name?.trim() || "—"}</td>
                      <td className="px-4 py-3 font-mono text-xs">{member.bank_account_number?.trim() || "—"}</td>
                      <td className="px-4 py-3">{member.bank_account_title?.trim() || "—"}</td>
                      <td className="px-4 py-3 tabular-nums whitespace-nowrap">
                        {member.salary
                          ? `${member.currency || "PKR"} ${member.salary.toLocaleString()}`
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {complete && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs gap-1 text-[#1faca6]"
                            onClick={() =>
                              copyText(
                                staffBankDetailsCopyText(member),
                                `${member.name} bank details copied`,
                              )
                            }
                          >
                            <Copy className="h-3 w-3" />
                            Copy
                          </Button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
