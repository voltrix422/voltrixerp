"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function ClientAuditPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace("/crm?tab=audit")
  }, [router])
  return null
}
