import Link from "next/link"

type Props = {
  href?: string
  label?: string
  className?: string
  onClick?: () => void
  /** Navbar (h-9) vs product detail row (h-9, text-sm) */
  size?: "sm" | "md"
}

const ARROW_CHIP = (
  <span className="flex shrink-0 items-center justify-center w-6 h-6 rounded-full bg-white/20 group-hover:bg-white/30 transition-all duration-300 group-hover:translate-x-0.5">
    <svg
      className="w-3 h-3"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2.5}
      aria-hidden
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  </span>
)

/** Teal pill with arrow chip and hover slide (navbar + product detail actions). */
export function GetQuoteButton({
  href = "/quote",
  label = "Get a quote",
  className = "",
  onClick,
  size = "sm",
}: Props) {
  const sizeClass =
    size === "md" ? "pl-4 pr-1.5 h-9 text-sm" : "pl-4 pr-1.5 h-9 text-base"

  const pillClass = `group relative inline-flex items-center gap-1.5 rounded-full font-medium text-white transition-all duration-300 hover:opacity-90 cursor-pointer shrink-0 ${sizeClass} ${className}`

  const content = (
    <>
      <span className="transition-transform duration-300 group-hover:-translate-x-0.5 whitespace-nowrap">
        {label}
      </span>
      {ARROW_CHIP}
    </>
  )

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={pillClass}
        style={{ backgroundColor: "#1a9f9a" }}
      >
        {content}
      </button>
    )
  }

  return (
    <Link href={href} className={pillClass} style={{ backgroundColor: "#1a9f9a" }}>
      {content}
    </Link>
  )
}
