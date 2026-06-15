"use client"

import { useState, useMemo } from "react"
import {
  BookOpen, ChevronRight, ChevronLeft, GitBranch, Search, ArrowLeft, FileText,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  HELP_SECTIONS,
  getTotalTopicCount,
  findTopic,
  searchTopics,
  type HelpSection,
} from "./help-sections"

type View = "home" | "module" | "topic"

// ── Breadcrumb ────────────────────────────────────────────
function Breadcrumb({
  items,
  onNavigate,
}: {
  items: { label: string; onClick?: () => void }[]
  onNavigate: (index: number) => void
}) {
  return (
    <nav className="flex items-center gap-1.5 text-sm flex-wrap">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />}
          {item.onClick ? (
            <button
              onClick={() => onNavigate(i)}
              className="text-[#0d6b67] hover:underline font-medium"
            >
              {item.label}
            </button>
          ) : (
            <span className="text-[hsl(var(--muted-foreground))] truncate max-w-[200px]">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  )
}

// ── Module card (home grid) ───────────────────────────────
function ModuleCard({ section, onClick }: { section: HelpSection; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group rounded-xl border bg-[hsl(var(--card))] p-5 text-left hover:border-[#1faca6]/50 hover:shadow-md transition-all"
    >
      <div className={cn("h-11 w-11 rounded-xl flex items-center justify-center mb-3", section.bgColor, section.color)}>
        {section.icon}
      </div>
      <p className="text-sm font-semibold leading-snug group-hover:text-[#0d6b67] transition-colors">
        {section.title}
      </p>
      <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1.5 line-clamp-2 leading-relaxed">
        {section.summary}
      </p>
      <div className="flex items-center justify-between mt-4 pt-3 border-t">
        <span className="text-[11px] text-[hsl(var(--muted-foreground))]">
          {section.topics.length} guide{section.topics.length !== 1 ? "s" : ""}
        </span>
        <ChevronRight className="h-4 w-4 text-[hsl(var(--muted-foreground))] group-hover:text-[#1faca6] transition-colors" />
      </div>
    </button>
  )
}

// ── Topic card (module list) ──────────────────────────────
function TopicCard({
  title,
  summary,
  index,
  onClick,
}: {
  title: string
  summary?: string
  index: number
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-start gap-4 rounded-xl border bg-[hsl(var(--card))] px-5 py-4 text-left hover:border-[#1faca6]/40 hover:bg-[hsl(var(--muted))]/10 transition-all group"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#1faca6]/10 text-xs font-bold text-[#0d6b67]">
        {index + 1}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold group-hover:text-[#0d6b67] transition-colors">{title}</p>
        {summary && (
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1 leading-relaxed line-clamp-2">
            {summary}
          </p>
        )}
      </div>
      <ChevronRight className="h-4 w-4 text-[hsl(var(--muted-foreground))] shrink-0 mt-1 group-hover:text-[#1faca6] transition-colors" />
    </button>
  )
}

// ── Search result row ─────────────────────────────────────
function SearchResultRow({
  sectionTitle,
  topicTitle,
  summary,
  onClick,
}: {
  sectionTitle: string
  topicTitle: string
  summary?: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-start gap-3 rounded-lg border bg-[hsl(var(--card))] px-4 py-3.5 text-left hover:border-[#1faca6]/40 transition-all"
    >
      <FileText className="h-4 w-4 text-[#1faca6] shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{topicTitle}</p>
        <p className="text-[11px] text-[#0d6b67] mt-0.5">{sectionTitle}</p>
        {summary && (
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1 line-clamp-1">{summary}</p>
        )}
      </div>
      <ChevronRight className="h-4 w-4 text-[hsl(var(--muted-foreground))] shrink-0" />
    </button>
  )
}

// ── Main component ────────────────────────────────────────
export function HelpContent() {
  const [view, setView] = useState<View>("home")
  const [sectionId, setSectionId] = useState<string | null>(null)
  const [topicIndex, setTopicIndex] = useState<number | null>(null)
  const [search, setSearch] = useState("")

  const activeSection = HELP_SECTIONS.find((s) => s.id === sectionId) ?? null
  const activeTopicData = sectionId !== null && topicIndex !== null ? findTopic(sectionId, topicIndex) : null

  const searchResults = useMemo(() => searchTopics(search), [search])
  const isSearching = search.trim().length > 0

  function goHome() {
    setView("home")
    setSectionId(null)
    setTopicIndex(null)
  }

  function openModule(id: string) {
    setSectionId(id)
    setTopicIndex(null)
    setView("module")
    setSearch("")
  }

  function openTopic(secId: string, idx: number) {
    setSectionId(secId)
    setTopicIndex(idx)
    setView("topic")
    setSearch("")
  }

  function goToModule() {
    setTopicIndex(null)
    setView("module")
  }

  function handleBreadcrumbNav(index: number) {
    if (index === 0) goHome()
    else if (index === 1) goToModule()
  }

  const totalTopics = getTotalTopicCount()

  return (
    <div className="max-w-3xl mx-auto space-y-5 pb-8">
      {/* Hero — only on home when not searching */}
      {view === "home" && !isSearching && (
        <div className="rounded-2xl border bg-gradient-to-br from-[#1faca6]/10 via-[hsl(var(--card))] to-[hsl(var(--card))] p-6">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-xl bg-[#1faca6]/20 flex items-center justify-center shrink-0">
              <GitBranch className="h-6 w-6 text-[#0d6b67]" />
            </div>
            <div>
              <h1 className="text-lg font-bold">Voltrix ERP Help Center</h1>
              <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1.5 leading-relaxed">
                Step-by-step guides for every module. Pick a topic below — one guide at a time.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 mt-5">
            {[
              { label: "Modules", value: HELP_SECTIONS.length },
              { label: "Guides", value: totalTopics },
              { label: "Flowcharts", value: "12+" },
            ].map((s) => (
              <div key={s.label} className="rounded-lg border bg-[hsl(var(--background))]/60 px-3 py-2.5 text-center">
                <p className="text-xl font-bold">{s.value}</p>
                <p className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase tracking-widest mt-0.5">
                  {s.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search bar — always visible */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--muted-foreground))]" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search guides… e.g. petty cash, scan dispatch, credit order"
          className="w-full h-11 rounded-xl border bg-[hsl(var(--background))] pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#1faca6]/40 focus:border-[#1faca6] transition-colors"
        />
      </div>

      {/* Breadcrumb for module/topic views */}
      {(view === "module" || view === "topic") && activeSection && !isSearching && (
        <div className="flex items-center gap-3">
          <button
            onClick={view === "topic" ? goToModule : goHome}
            className="flex h-8 w-8 items-center justify-center rounded-lg border hover:bg-[hsl(var(--muted))]/30 transition-colors shrink-0"
            aria-label="Go back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <Breadcrumb
            items={[
              { label: "Help Center", onClick: goHome },
              { label: activeSection.title, onClick: view === "topic" ? goToModule : undefined },
              ...(view === "topic" && activeTopicData
                ? [{ label: activeTopicData.topic.title }]
                : []),
            ]}
            onNavigate={handleBreadcrumbNav}
          />
        </div>
      )}

      {/* ── SEARCH RESULTS ── */}
      {isSearching && (
        <div className="space-y-2">
          <p className="text-xs text-[hsl(var(--muted-foreground))] px-1">
            {searchResults.length} result{searchResults.length !== 1 ? "s" : ""} for &ldquo;{search}&rdquo;
          </p>
          {searchResults.length === 0 ? (
            <div className="text-center py-16 text-sm text-[hsl(var(--muted-foreground))]">
              <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>No guides found. Try: petty cash, dispatch, scan, credit, transfer</p>
            </div>
          ) : (
            searchResults.map(({ section, topic, topicIndex: idx }) => (
              <SearchResultRow
                key={`${section.id}-${idx}`}
                sectionTitle={section.title}
                topicTitle={topic.title}
                summary={topic.summary}
                onClick={() => openTopic(section.id, idx)}
              />
            ))
          )}
        </div>
      )}

      {/* ── HOME: module grid ── */}
      {!isSearching && view === "home" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {HELP_SECTIONS.map((section) => (
            <ModuleCard key={section.id} section={section} onClick={() => openModule(section.id)} />
          ))}
        </div>
      )}

      {/* ── MODULE: topic list ── */}
      {!isSearching && view === "module" && activeSection && (
        <div className="space-y-4">
          <div className={cn("rounded-xl p-5 flex items-start gap-4", activeSection.bgColor)}>
            <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center bg-white/60 dark:bg-black/20 shrink-0", activeSection.color)}>
              {activeSection.icon}
            </div>
            <div>
              <h2 className="text-base font-bold">{activeSection.title}</h2>
              <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">{activeSection.summary}</p>
            </div>
          </div>
          <div className="space-y-2">
            {activeSection.topics.map((topic, i) => (
              <TopicCard
                key={i}
                index={i}
                title={topic.title}
                summary={topic.summary}
                onClick={() => openTopic(activeSection.id, i)}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── TOPIC: single guide page ── */}
      {!isSearching && view === "topic" && activeTopicData && (
        <div className="space-y-5">
          <div className="rounded-2xl border bg-[hsl(var(--card))] overflow-hidden">
            <div className="px-6 py-5 border-b bg-[hsl(var(--muted))]/10">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-[#0d6b67] mb-1">
                {activeTopicData.section.title}
              </p>
              <h2 className="text-lg font-bold leading-snug">{activeTopicData.topic.title}</h2>
              {activeTopicData.topic.summary && (
                <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1.5">
                  {activeTopicData.topic.summary}
                </p>
              )}
            </div>
            <div className="px-6 py-6">{activeTopicData.topic.content}</div>
          </div>

          {/* Prev / Next navigation */}
          <div className="flex items-center justify-between gap-3">
            {activeTopicData.topicIndex > 0 ? (
              <button
                onClick={() => openTopic(activeTopicData.section.id, activeTopicData.topicIndex - 1)}
                className="flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm hover:bg-[hsl(var(--muted))]/20 transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
                <span className="truncate max-w-[140px]">
                  {activeTopicData.section.topics[activeTopicData.topicIndex - 1].title}
                </span>
              </button>
            ) : (
              <div />
            )}
            {activeTopicData.topicIndex < activeTopicData.section.topics.length - 1 ? (
              <button
                onClick={() => openTopic(activeTopicData.section.id, activeTopicData.topicIndex + 1)}
                className="flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm hover:bg-[hsl(var(--muted))]/20 transition-colors ml-auto"
              >
                <span className="truncate max-w-[140px]">
                  {activeTopicData.section.topics[activeTopicData.topicIndex + 1].title}
                </span>
                <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                onClick={goToModule}
                className="flex items-center gap-2 rounded-lg border border-[#1faca6]/40 bg-[#1faca6]/10 px-4 py-2.5 text-sm text-[#0d6b67] hover:bg-[#1faca6]/20 transition-colors ml-auto"
              >
                Back to {activeTopicData.section.title}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
