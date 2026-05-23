"use client"

import { BranchWarrantyHub } from "@/components/warranty/branch-warranty-hub"

export default function ErpWarrantyCenterPage() {
  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div>
        <h1 className="text-xl font-bold">Warranty</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Start or claim product warranty at branch / van
        </p>
      </div>
      <BranchWarrantyHub />
    </div>
  )
}
