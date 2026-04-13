import { Construction } from "lucide-react"

export function ComingSoon({ title }: { title: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center p-12">
      <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[hsl(var(--muted))]">
        <Construction className="h-7 w-7 text-[hsl(var(--muted-foreground))]" />
      </div>
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
          This module is coming soon. Check back later.
        </p>
      </div>
    </div>
  )
}
