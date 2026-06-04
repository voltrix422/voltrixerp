import Link from "next/link"

type Props = {
  href?: string
  label?: string
  className?: string
  /** Navbar size (h-9) vs product detail (h-11) */
  size?: "sm" | "md"
}

/** Matches navbar “Get a quote” pill: teal fill, arrow chip, hover slide. */
export function GetQuoteButton({
  href = "/quote",
  label = "Get a quote",
  className = "",
  size = "sm",
}: Props) {
  const sizeClass =
    size === "md" ? "pl-5 pr-2 h-11 text-base" : "pl-4 pr-1.5 h-9 text-base"

  return (
    <Link
      href={href}
      className={`group relative inline-flex items-center gap-2 rounded-full font-medium text-white transition-all duration-300 hover:opacity-90 cursor-pointer ${sizeClass} ${className}`}
      style={{ backgroundColor: "#1a9f9a" }}
    >
      <span className="transition-transform duration-300 group-hover:-translate-x-0.5 whitespace-nowrap">
        {label}
      </span>
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
    </Link>
  )
}
