"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { Battery } from "lucide-react"

type ProductThumbnailProps = {
  src: string | null | undefined
  alt: string
  className?: string
  imgClassName?: string
  /** Use fill layout inside a relative container */
  fill?: boolean
  priority?: boolean
}

export function ProductThumbnail({
  src,
  alt,
  className,
  imgClassName,
  fill,
  priority,
}: ProductThumbnailProps) {
  const [failed, setFailed] = useState(false)
  const showFallback = !src || failed

  if (showFallback) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-2 bg-neutral-50 text-neutral-300",
          fill && "absolute inset-0",
          className,
        )}
      >
        <Battery className="h-10 w-10 opacity-40" strokeWidth={1.25} />
        <span className="text-[10px] font-medium uppercase tracking-wide opacity-60">No image</span>
      </div>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      onError={() => setFailed(true)}
      className={cn(
        fill ? "absolute inset-0 w-full h-full object-contain p-3" : "w-full h-full object-contain",
        imgClassName,
      )}
    />
  )
}
