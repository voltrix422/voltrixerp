"use client"

import { useMemo, useState } from "react"
import {
  mergePettyCashAllocations,
  type PettyCashAllocation,
  type PettyCashReceipt,
} from "@/lib/petty-cash"
import {
  allocationRefLabel,
  samePettyCashEmployee,
} from "@/lib/petty-cash-merge"
import { summarizeAllocationReceipts } from "@/lib/petty-cash-display"
import { useToast } from "@/components/ui/toast"
import { GitMerge, X } from "lucide-react"

type Props = {
  target: PettyCashAllocation
  allocations: PettyCashAllocation[]
  receipts: PettyCashReceipt[]
  mergedBy: string
  onClose: () => void
  onMerged: (updated: PettyCashAllocation) => void
}

function money(n: number) {
  return `PKR ${Math.round(n).toLocaleString()}`
}

export function PettyCashMerge({
  target,
  allocations,
  receipts,
  mergedBy,
  onClose,
  onMerged,
}: Props) {
  const { toast } = useToast()
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  const candidates = useMemo(
    () =>
      allocations
        .filter(
          (row) =>
            row.id !== target.id &&
            row.status === "active" &&
            samePettyCashEmployee(target, row),
        )
        .sort(
          (a, b) =>
            new Date(b.allocatedAt).getTime() - new Date(a.allocatedAt).getTime(),
        ),
    [allocations, target],
  )

  const selected = candidates.filter((row) => selectedIds.includes(row.id))
  const addedAmount = selected.reduce((sum, row) => sum + (Number(row.amount) || 0), 0)
  const previewGiven = (Number(target.amount) || 0) + addedAmount

  function toggle(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id],
    )
  }

  async function submit() {
    if (selectedIds.length === 0) {
      toast({
        title: "Select allocations",
        message: "Pick at least one other allocation to merge into this one.",
        type: "error",
      })
      return
    }

    setLoading(true)
    try {
      const updated = await mergePettyCashAllocations({
        targetId: target.id,
        sourceIds: selectedIds,
        mergedBy,
      })
      toast({
        title: "Merged",
        message: `Merged ${selectedIds.length} allocation${selectedIds.length === 1 ? "" : "s"} into ${allocationRefLabel(target)}.`,
        type: "success",
      })
      onMerged(updated)
      onClose()
    } catch (error) {
      toast({
        title: "Merge failed",
        message: error instanceof Error ? error.message : "Could not merge allocations",
        type: "error",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl border bg-[hsl(var(--card))] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b bg-[#fafafa]">
          <div className="flex items-center gap-2 min-w-0">
            <GitMerge className="h-4 w-4 text-[#007aff] shrink-0" />
            <div className="min-w-0">
              <p className="text-[14px] font-semibold text-[#1d1d1f]">Merge into allocation</p>
              <p className="text-[11px] text-[#86868b] truncate">
                Keep {allocationRefLabel(target)} · {target.employeeName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 inline-flex items-center justify-center rounded-full hover:bg-black/[0.06] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <div className="rounded-[12px] border border-black/[0.06] bg-[#f5f8ff] px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[#007aff]">
              Target (kept)
            </p>
            <p className="text-[13px] font-semibold text-[#1d1d1f] mt-0.5">
              {allocationRefLabel(target)} · {money(Number(target.amount) || 0)}
            </p>
            <p className="text-[11px] text-[#6e6e73] mt-0.5 line-clamp-2">{target.purpose}</p>
          </div>

          {candidates.length === 0 ? (
            <p className="text-[12px] text-[#86868b] py-4 text-center">
              No other active allocations for {target.employeeName}.
            </p>
          ) : (
            <>
              <p className="text-[11px] text-[#6e6e73]">
                Select which active allocations to merge into{" "}
                <span className="font-semibold text-[#1d1d1f]">{allocationRefLabel(target)}</span>.
                Receipts move over; Given amounts add up; selected rows are cancelled.
              </p>
              <div className="max-h-[280px] overflow-y-auto rounded-[12px] border border-black/[0.06] divide-y divide-black/[0.04]">
                {candidates.map((row) => {
                  const summary = summarizeAllocationReceipts(row, receipts)
                  const checked = selectedIds.includes(row.id)
                  return (
                    <label
                      key={row.id}
                      className={`flex items-start gap-3 px-3 py-2.5 cursor-pointer ${
                        checked ? "bg-[#f5f8ff]" : "hover:bg-[#fafafa]"
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="mt-1 accent-[#007aff]"
                        checked={checked}
                        onChange={() => toggle(row.id)}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[12px] font-semibold text-[#1d1d1f]">
                            {allocationRefLabel(row)}
                          </p>
                          <p className="text-[12px] font-semibold tabular-nums text-[#1d1d1f] shrink-0">
                            {money(Number(row.amount) || 0)}
                          </p>
                        </div>
                        <p className="text-[11px] text-[#6e6e73] line-clamp-2 mt-0.5">{row.purpose}</p>
                        <p className="text-[10px] text-[#aeaeb2] mt-0.5">
                          {new Date(row.allocatedAt).toLocaleDateString()}
                          {summary.pendingCount > 0
                            ? ` · ${summary.pendingCount} pending receipt${summary.pendingCount === 1 ? "" : "s"}`
                            : ""}
                          {summary.approvedCount > 0
                            ? ` · ${summary.approvedCount} approved`
                            : ""}
                        </p>
                      </div>
                    </label>
                  )
                })}
              </div>

              {selected.length > 0 ? (
                <div className="rounded-[12px] border border-black/[0.06] bg-[#fafafa] px-3 py-2.5 text-[12px] space-y-1">
                  <div className="flex justify-between gap-2">
                    <span className="text-[#6e6e73]">Merging</span>
                    <span className="font-semibold text-[#1d1d1f]">
                      {selected.length} allocation{selected.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-[#6e6e73]">Added Given</span>
                    <span className="font-semibold tabular-nums text-[#1d1d1f]">
                      {money(addedAmount)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2 pt-1 border-t border-black/[0.05]">
                    <span className="font-semibold text-[#1d1d1f]">New Given on target</span>
                    <span className="font-semibold tabular-nums text-[#007aff]">
                      {money(previewGiven)}
                    </span>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>

        <div className="px-4 py-3 border-t bg-[#fafafa] flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-3.5 rounded-full text-[12px] font-semibold text-[#6e6e73] hover:bg-black/[0.04] cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={loading || selectedIds.length === 0}
            onClick={() => void submit()}
            className="h-9 px-4 rounded-full bg-[#007aff] text-white text-[12px] font-semibold hover:bg-[#0066d6] disabled:opacity-50 inline-flex items-center gap-1.5 cursor-pointer"
          >
            <GitMerge className="h-3.5 w-3.5" />
            {loading ? "Merging…" : "Merge selected"}
          </button>
        </div>
      </div>
    </div>
  )
}
