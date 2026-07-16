"use client"
import { useMemo, useState } from "react"
import { FolderKanban, Plus } from "lucide-react"
import type { ClientProject } from "@/lib/client-projects"

const inputCls =
  "w-full h-8 rounded-md border bg-[hsl(var(--background))] px-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#1faca6]/40 focus:border-[#1faca6]"

export type ProjectOption = {
  name: string
  clientName?: string
  status?: ClientProject["status"]
  source: "client" | "ledger"
}

function normalizeName(name: string) {
  return name.trim().toLowerCase()
}

export function buildProjectOptions(
  clientProjects: ClientProject[],
  ledgerProjectNames: string[] = [],
): ProjectOption[] {
  const byName = new Map<string, ProjectOption>()

  for (const p of clientProjects) {
    const name = p.projectName.trim()
    if (!name) continue
    byName.set(normalizeName(name), {
      name,
      clientName: p.clientName?.trim() || undefined,
      status: p.status,
      source: "client",
    })
  }

  for (const raw of ledgerProjectNames) {
    const name = raw.trim()
    if (!name) continue
    const key = normalizeName(name)
    if (byName.has(key)) continue
    byName.set(key, { name, source: "ledger" })
  }

  return Array.from(byName.values()).sort((a, b) => {
    const statusRank = (s?: ClientProject["status"]) => (s === "open" || !s ? 0 : s === "completed" ? 1 : 2)
    const byStatus = statusRank(a.status) - statusRank(b.status)
    if (byStatus !== 0) return byStatus
    return a.name.localeCompare(b.name)
  })
}

export function ProjectPicker({
  value,
  onChange,
  options,
  required = false,
}: {
  value: string
  onChange: (name: string) => void
  options: ProjectOption[]
  required?: boolean
}) {
  const matched = useMemo(() => {
    const key = normalizeName(value)
    if (!key) return null
    return options.find(o => normalizeName(o.name) === key) ?? null
  }, [options, value])

  const [mode, setMode] = useState<"select" | "type">(() =>
    value.trim() && !matched ? "type" : "select",
  )

  const isNew = Boolean(value.trim()) && !matched

  function selectProject(name: string) {
    onChange(name)
    if (name) setMode("select")
  }

  return (
    <div className="space-y-1.5 min-w-0">
      <div className="flex items-center justify-between gap-2">
        <label className="text-[11px] font-medium text-[hsl(var(--foreground))] flex items-center gap-1.5">
          <FolderKanban className="h-3.5 w-3.5 text-[#1faca6]" />
          Project
        </label>
        <div className="flex rounded-md border overflow-hidden shrink-0">
          <button
            type="button"
            onClick={() => setMode("select")}
            className={`px-2.5 py-0.5 text-[10px] font-medium cursor-pointer transition-colors ${
              mode === "select"
                ? "bg-[#1faca6] text-white"
                : "bg-transparent text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]/40"
            }`}
          >
            Select
          </button>
          <button
            type="button"
            onClick={() => setMode("type")}
            className={`px-2.5 py-0.5 text-[10px] font-medium cursor-pointer transition-colors ${
              mode === "type"
                ? "bg-[#1faca6] text-white"
                : "bg-transparent text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]/40"
            }`}
          >
            Type name
          </button>
        </div>
      </div>

      {mode === "select" ? (
        <select
          required={required && !value.trim()}
          value={matched?.name || ""}
          onChange={e => selectProject(e.target.value)}
          className={inputCls}
        >
          <option value="">
            {value.trim() && !matched ? `Using “${value.trim()}” (new) — or pick below` : "Select a project…"}
          </option>
          {options.map(opt => (
            <option key={`${opt.source}-${opt.name}`} value={opt.name}>
              {opt.clientName
                ? `${opt.name} — ${opt.clientName}${opt.status && opt.status !== "open" ? ` (${opt.status})` : ""}`
                : `${opt.name}${opt.status && opt.status !== "open" ? ` (${opt.status})` : ""}`}
            </option>
          ))}
        </select>
      ) : (
        <div className="relative">
          <input
            required={required}
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder="Type new project name"
            className={inputCls + " pr-8"}
            list="purchase-ledger-project-type-suggestions"
          />
          <Plus className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[hsl(var(--muted-foreground))] pointer-events-none" />
          <datalist id="purchase-ledger-project-type-suggestions">
            {options.map(opt => (
              <option key={`suggest-${opt.name}`} value={opt.name} />
            ))}
          </datalist>
        </div>
      )}

      {matched ? (
        <p className="text-[10px] text-[hsl(var(--muted-foreground))] leading-tight">
          Linked to existing project
          {matched.clientName ? (
            <> · Client <span className="font-medium text-[hsl(var(--foreground))]">{matched.clientName}</span></>
          ) : null}
          {matched.status && matched.status !== "open" ? (
            <> · <span className="capitalize">{matched.status}</span></>
          ) : null}
        </p>
      ) : isNew ? (
        <p className="text-[10px] text-[#1faca6] leading-tight font-medium">
          New project — will be created when you save
        </p>
      ) : (
        <p className="text-[10px] text-[hsl(var(--muted-foreground))] leading-tight">
          Pick an existing project, or switch to Type name to create one
        </p>
      )}
    </div>
  )
}
