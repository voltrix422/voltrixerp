"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"

export default function NewFinanceError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("New Finance error:", error)
  }, [error])

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-12 text-center">
      <h2 className="text-lg font-semibold">Accounting page error</h2>
      <p className="text-sm text-[hsl(var(--muted-foreground))] max-w-md">{error.message}</p>
      <p className="text-xs text-[hsl(var(--muted-foreground))]">
        If this persists, run on the server: <code className="font-mono">npx prisma migrate deploy</code> then restart the app.
      </p>
      <div className="flex gap-2">
        <Button onClick={reset}>Try again</Button>
        <Button variant="outline" onClick={() => window.location.href = "/finance"}>
          Old Finance
        </Button>
      </div>
    </div>
  )
}
