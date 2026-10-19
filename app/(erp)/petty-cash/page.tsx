"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function PettyCashPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace("/purchase?tab=petty-cash")
  }, [router])

  return null
}
