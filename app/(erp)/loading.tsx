export default function ErpLoading() {
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col bg-[#f5f5f7] dark:bg-[hsl(var(--background))]">
      <div className="h-0.5 w-full overflow-hidden bg-black/[0.06] dark:bg-white/10">
        <div className="h-full w-1/3 animate-pulse rounded-full bg-[#0071e3]" />
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4 md:p-6">
        <div className="h-7 w-40 animate-pulse rounded-lg bg-black/[0.06] dark:bg-white/10" />
        <div className="h-4 w-64 animate-pulse rounded bg-black/[0.04] dark:bg-white/5" />
        <div className="mt-2 grid flex-1 gap-3 md:grid-cols-2">
          <div className="min-h-[140px] animate-pulse rounded-2xl bg-white/80 ring-1 ring-black/[0.04] dark:bg-[hsl(var(--card))]" />
          <div className="min-h-[140px] animate-pulse rounded-2xl bg-white/80 ring-1 ring-black/[0.04] dark:bg-[hsl(var(--card))]" />
          <div className="min-h-[180px] animate-pulse rounded-2xl bg-white/80 ring-1 ring-black/[0.04] md:col-span-2 dark:bg-[hsl(var(--card))]" />
        </div>
      </div>
    </div>
  )
}
