"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

/** Investor accounts use the normal ERP login at /login. */
export default function InvestorLoginRedirectPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace("/login")
  }, [router])
  return null
}
