import { cn } from "@/lib/utils"

type Props = {
  agentName: string
  className?: string
}

export function SalesAgentSourceBadge({ agentName, className }: Props) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-full border border-[#1faca6]/30 bg-[#1faca6]/10 px-2 py-0.5 text-[10px] font-medium text-[#158a85]",
        className
      )}
    >
      <span className="shrink-0">From sales agent</span>
      <span className="shrink-0 text-[#1faca6]/70">·</span>
      <span className="truncate">{agentName}</span>
    </span>
  )
}
