"use client"

import type { BranchInventory } from "@/lib/branches"
import { Button } from "@/components/ui/button"
import { ArrowRightLeft, Loader2, Trash2 } from "lucide-react"

type Props = {
  items: BranchInventory[]
  deletingId: string | null
  onTransfer: (inv: BranchInventory) => void
  onRemove: (inv: BranchInventory) => void
}

export function BranchInventoryCompactList({ items, deletingId, onTransfer, onRemove }: Props) {
  return (
    <div className="space-y-1">
      {items.map((inv) => {
        const title = inv.itemName || inv.productDescription || inv.inventoryId || "Item"
        const canTransfer = inv.quantity > 0
        return (
          <div
            key={inv.id}
            className="flex flex-wrap items-center gap-2 rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2"
          >
            <span className="min-w-0 flex-1 text-xs font-medium truncate">{title}</span>
            {inv.model && inv.model !== title ? (
              <span className="text-[10px] font-mono text-[hsl(var(--muted-foreground))] truncate max-w-[28%] hidden sm:inline">
                {inv.model}
              </span>
            ) : null}
            <span className="text-[10px] text-[hsl(var(--muted-foreground))] tabular-nums shrink-0">
              {inv.quantity} {inv.unit || "pcs"}
            </span>
            {inv.assignedAt ? (
              <span className="text-[10px] text-[hsl(var(--muted-foreground))] shrink-0 hidden md:inline">
                {new Date(inv.assignedAt).toLocaleDateString()}
              </span>
            ) : null}
            <div className="flex gap-1 shrink-0 ml-auto">
              {canTransfer && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 px-2 text-[10px] cursor-pointer"
                  onClick={() => onTransfer(inv)}
                >
                  <ArrowRightLeft className="h-3 w-3 mr-0.5" />
                  Transfer
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                className="h-6 px-2 text-[10px] cursor-pointer text-red-600 border-red-200 hover:bg-red-50"
                disabled={deletingId === inv.id}
                onClick={() => onRemove(inv)}
              >
                {deletingId === inv.id ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <>
                    <Trash2 className="h-3 w-3 mr-0.5" />
                    Remove
                  </>
                )}
              </Button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
