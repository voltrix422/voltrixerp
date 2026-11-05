"use client"
import { useTheme } from "next-themes"
import { Sun, Moon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useEffect, useState } from "react"

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  if (!mounted) return <div className="h-7 w-7" />

  const isDark = resolvedTheme === "dark"

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-7 w-7 shrink-0 rounded-full text-[#1d1d1f] dark:text-[hsl(var(--foreground))] hover:bg-black/[0.06] dark:hover:bg-white/10 cursor-pointer"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label="Toggle theme"
    >
      {isDark ? <Sun className="h-[15px] w-[15px]" strokeWidth={1.75} /> : <Moon className="h-[15px] w-[15px]" strokeWidth={1.75} />}
    </Button>
  )
}
