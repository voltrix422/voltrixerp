import { cn } from "@/lib/utils"

type SalesAgentSourceKind = "client" | "order" | "quotation" | "default"

type Props = {
  agentName: string
  className?: string
  kind?: SalesAgentSourceKind
}

const KIND_LABELS: Record<SalesAgentSourceKind, string> = {
  client: "Sales agent client",
  order: "Sales agent order",
  quotation: "Sales agent quotation",
  default: "From sales agent",
}

export function SalesAgentSourceBadge({ agentName, className, kind = "default" }: Props) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-full border border-[#1faca6]/30 bg-[#1faca6]/10 px-2 py-0.5 text-[10px] font-medium text-[#158a85]",
        className
      )}
    >
      <span className="shrink-0">{KIND_LABELS[kind]}</span>
      <span className="shrink-0 text-[#1faca6]/70">·</span>
      <span className="truncate">{agentName}</span>
    </span>
  )
}
