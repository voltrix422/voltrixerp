"use client"

import { WEBSITE_CATEGORY_FILTERS } from "@/lib/product-categories"

type Props = {
  selected: string
  onSelect: (id: string) => void
  /** Subcategories that have at least one published product */
  activeInverterSubs: string[]
}

export default function ProductCategoryFilter({
  selected,
  onSelect,
  activeInverterSubs,
}: Props) {
  const inverterOpen =
    selected === "Inverter" || activeInverterSubs.includes(selected)

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex flex-wrap justify-center gap-2">
        <FilterChip
          label="All"
          active={selected === "All"}
          onClick={() => onSelect("All")}
        />
        {WEBSITE_CATEGORY_FILTERS.map((group) => {
          if (group.id === "Inverter") {
            return (
              <FilterChip
                key={group.id}
                label={group.label}
                active={inverterOpen}
                onClick={() => onSelect("Inverter")}
              />
            )
          }
          return (
            <FilterChip
              key={group.id}
              label={group.label}
              active={selected === group.id}
              onClick={() => onSelect(group.id)}
            />
          )
        })}
      </div>

      {inverterOpen && activeInverterSubs.length > 0 && (
        <div className="flex flex-wrap justify-center gap-2">
          {activeInverterSubs.map((sub) => (
            <button
              key={sub}
              type="button"
              onClick={() => onSelect(sub)}
              className={`px-4 py-2 rounded-full text-xs font-medium transition-all cursor-pointer ${
                selected === sub
                  ? "bg-[#1a9f9a]/15 text-[#1a9f9a] border border-[#1a9f9a]"
                  : "bg-neutral-50 text-neutral-600 border border-neutral-200 hover:border-[#1a9f9a] hover:text-[#1a9f9a]"
              }`}
            >
              {sub}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-5 py-2.5 rounded-full text-sm font-medium transition-all cursor-pointer ${
        active
          ? "bg-[#1a9f9a] text-white shadow-lg shadow-[#1a9f9a]/20"
          : "bg-neutral-50 text-neutral-600 border border-neutral-200 hover:border-[#1a9f9a] hover:text-[#1a9f9a] hover:bg-neutral-100"
      }`}
    >
      {label}
    </button>
  )
}
