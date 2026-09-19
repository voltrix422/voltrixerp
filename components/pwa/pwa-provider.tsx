"use client"

import { useEffect, useState } from "react"
import { Download, Share, X } from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import {
  isIosDevice,
  isStandaloneApp,
  registerVoltrixServiceWorker,
} from "@/lib/push-client"

const DISMISS_KEY = "voltrix-install-dismissed"

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

export function PwaProvider() {
  const { user } = useAuth()
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [show, setShow] = useState(false)
  const [iosHelp, setIosHelp] = useState(false)

  useEffect(() => {
    void registerVoltrixServiceWorker()

    if (isStandaloneApp()) return
    try {
      if (localStorage.getItem(DISMISS_KEY) === "1") return
    } catch {
      // ignore
    }

    const onPrompt = (event: Event) => {
      event.preventDefault()
      setDeferred(event as BeforeInstallPromptEvent)
      setShow(true)
    }
    window.addEventListener("beforeinstallprompt", onPrompt)

    const timer = window.setTimeout(() => {
      if (isStandaloneApp()) return
      setShow(true)
      if (isIosDevice()) setIosHelp(true)
    }, 1200)

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt)
      window.clearTimeout(timer)
    }
  }, [])

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, "1")
    } catch {
      // ignore
    }
    setShow(false)
  }

  async function install() {
    if (deferred) {
      await deferred.prompt()
      const choice = await deferred.userChoice
      setDeferred(null)
      if (choice.outcome === "accepted") setShow(false)
      return
    }
    if (isIosDevice()) {
      setIosHelp(true)
      return
    }
  }

  if (!show || isStandaloneApp()) return null

  return (
    <div className="fixed bottom-4 left-1/2 z-[110] w-[min(100vw-1.5rem,400px)] -translate-x-1/2">
      <div className="relative overflow-hidden rounded-2xl border bg-white text-neutral-900 shadow-xl">
        <div className="absolute inset-x-0 top-0 h-1 bg-[#1a9f9a]" />
        <button
          type="button"
          onClick={dismiss}
          className="absolute top-2 right-2 h-7 w-7 rounded-full text-neutral-500 hover:bg-neutral-100"
          aria-label="Dismiss"
        >
          <X className="mx-auto h-4 w-4" />
        </button>
        <div className="flex gap-3 p-4 pr-10">
          <img src="/logo.png" alt="" className="h-12 w-12 rounded-xl object-contain bg-neutral-50" />
          <div className="min-w-0">
            <p className="text-sm font-semibold">Install Voltrix on your phone</p>
            <p className="mt-0.5 text-xs text-neutral-500">
              {user
                ? "Open it like an app and get order and ERP notifications on your lock screen."
                : "Add Voltrix to your home screen for faster browsing and quotes."}
            </p>
            {iosHelp && (
              <p className="mt-2 text-[11px] leading-relaxed text-neutral-600">
                On iPhone: tap <Share className="inline h-3 w-3" /> Share, then <strong>Add to Home Screen</strong>.
              </p>
            )}
            <button
              type="button"
              onClick={() => void install()}
              className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#1a9f9a] px-3 text-xs font-semibold text-white hover:bg-[#158a85]"
            >
              <Download className="h-3.5 w-3.5" />
              {iosHelp ? "How to install" : "Install app"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
