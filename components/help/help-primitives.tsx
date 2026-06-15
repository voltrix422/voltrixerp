import { ArrowRight, CheckCircle2, ChevronDown, Lightbulb } from "lucide-react"
import { cn } from "@/lib/utils"

export interface Step {
  label: string
  desc?: string
}

export type FlowNodeVariant = "start" | "action" | "decision" | "end" | "warning"

export interface FlowNode {
  title: string
  body?: string
  variant?: FlowNodeVariant
}

export function Flow({ steps }: { steps: Step[] }) {
  return (
    <div className="flex flex-wrap items-start gap-1 mt-3">
      {steps.map((s, i) => (
        <div key={i} className="flex items-center gap-1">
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-1.5 bg-[hsl(var(--muted))]/60 border rounded-md px-2.5 py-1.5">
              <span className="text-[10px] font-bold text-[hsl(var(--muted-foreground))]">{i + 1}</span>
              <span className="text-xs font-medium">{s.label}</span>
            </div>
            {s.desc && (
              <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-0.5 text-center max-w-[100px]">
                {s.desc}
              </p>
            )}
          </div>
          {i < steps.length - 1 && (
            <ArrowRight className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))] shrink-0 mt-1.5" />
          )}
        </div>
      ))}
    </div>
  )
}

export function VerticalFlowchart({ nodes, className }: { nodes: FlowNode[]; className?: string }) {
  const styles: Record<FlowNodeVariant, string> = {
    start: "bg-[#1faca6]/15 border-[#1faca6]/40 text-[#0d6b67]",
    action: "bg-[hsl(var(--muted))]/50 border-[hsl(var(--border))]",
    decision: "bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-100",
    warning: "bg-orange-50 border-orange-200 text-orange-900 dark:bg-orange-950/30 dark:border-orange-800 dark:text-orange-100",
    end: "bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-100",
  }
  return (
    <div className={cn("flex flex-col items-stretch gap-0 mt-3 max-w-lg", className)}>
      {nodes.map((node, i) => (
        <div key={i} className="flex flex-col items-center">
          <div className={cn("w-full rounded-lg border px-3 py-2.5 text-center", styles[node.variant || "action"])}>
            <p className="text-xs font-semibold leading-snug">{node.title}</p>
            {node.body && <p className="text-[10px] opacity-80 mt-1 leading-relaxed">{node.body}</p>}
          </div>
          {i < nodes.length - 1 && (
            <div className="flex flex-col items-center py-1 text-[hsl(var(--muted-foreground))]">
              <div className="w-0.5 h-2 bg-[hsl(var(--border))]" />
              <ChevronDown className="h-3.5 w-3.5" />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

export function NumberedSteps({ steps }: { steps: string[] }) {
  return (
    <ol className="space-y-2.5 mt-2">
      {steps.map((step, i) => (
        <li key={i} className="flex gap-3 text-sm">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#1faca6]/15 text-[11px] font-bold text-[#0d6b67]">
            {i + 1}
          </span>
          <span className="pt-0.5 leading-relaxed text-[hsl(var(--foreground))]">{step}</span>
        </li>
      ))}
    </ol>
  )
}

export function TipBox({ children, type = "tip" }: { children: React.ReactNode; type?: "tip" | "warning" | "info" }) {
  const styles = {
    tip: "bg-[#1faca6]/10 border-[#1faca6]/30 text-[#0d6b67] dark:text-[#7ee8e4]",
    warning: "bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-100",
    info: "bg-blue-50 border-blue-200 text-blue-900 dark:bg-blue-950/30 dark:border-blue-800 dark:text-blue-100",
  }
  return (
    <div className={cn("rounded-lg border px-4 py-3 mt-4 text-sm leading-relaxed flex gap-2.5", styles[type])}>
      <Lightbulb className="h-4 w-4 shrink-0 mt-0.5" />
      <div>{children}</div>
    </div>
  )
}

export function Status({ label, color }: { label: string; color: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border ${color}`}>
      {label}
    </span>
  )
}

export function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 py-2 border-b last:border-0 text-sm">
      <span className="text-[hsl(var(--muted-foreground))] w-36 shrink-0">{label}</span>
      <span>{value}</span>
    </div>
  )
}

export function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2 mt-2">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2.5 text-sm">
          <CheckCircle2 className="h-4 w-4 text-[#1faca6] shrink-0 mt-0.5" />
          <span dangerouslySetInnerHTML={{ __html: item }} />
        </li>
      ))}
    </ul>
  )
}

export function CompareTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="rounded-lg border overflow-hidden mt-4 overflow-x-auto">
      <table className="w-full text-sm min-w-[280px]">
        <thead>
          <tr className="bg-[hsl(var(--muted))]/40 border-b">
            {headers.map((h, i) => (
              <th key={i} className="px-3 py-2.5 text-left font-semibold text-[hsl(var(--muted-foreground))]">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-[hsl(var(--muted))]/20">
              {row.map((cell, j) => (
                <td key={j} className={`px-3 py-2.5 ${j === 0 ? "font-medium" : ""}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function GuideBody({ children }: { children: React.ReactNode }) {
  return <div className="space-y-4 text-sm leading-relaxed text-[hsl(var(--foreground))]">{children}</div>
}
