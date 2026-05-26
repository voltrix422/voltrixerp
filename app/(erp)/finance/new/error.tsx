"use client"

import { Button } from "@/components/ui/button"

export default function FinanceOverviewError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-12 text-center">
      <h2 className="text-lg font-semibold">Could not load finance overview</h2>
      <p className="text-sm text-[hsl(var(--muted-foreground))] max-w-md">{error.message}</p>
      <div className="flex gap-2">
        <Button onClick={reset}>Try again</Button>
        <Button variant="outline" onClick={() => { window.location.href = "/finance" }}>
          Payments & records
        </Button>
      </div>
    </div>
  )
}
