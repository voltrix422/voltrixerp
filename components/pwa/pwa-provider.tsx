"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { Download, Share, X } from "lucide-react"
import { isIosDevice, isStandaloneApp, registerVoltrixServiceWorker } from "@/lib/push-client"
import {
  autoApplyAppUpdate,
  fetchAppVersion,
  registerAndWatchUpdates,
  rememberAppVersion,
  storedAppVersion,
} from "@/lib/app-update"

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

type PwaContextValue = {
  installed: boolean
  canPrompt: boolean
  iosHelp: boolean
  install: () => Promise<void>
}

const PwaContext = createContext<PwaContextValue>({
  installed: false,
  canPrompt: false,
  iosHelp: false,
  install: async () => {},
})

let dismissedThisLoad = false

function isLaptopOrDesktop() {
  if (typeof window === "undefined") return true
  return window.matchMedia("(min-width: 768px)").matches && !isIosDevice()
}

export function useErpInstall() {
  return useContext(PwaContext)
}

function useErpManifest() {
  useEffect(() => {
    document.querySelectorAll('link[rel="manifest"]').forEach((el) => el.remove())
    const link = document.createElement("link")
    link.rel = "manifest"
    link.href = "/erp-manifest.json?v=20261105-logo-t"
    document.head.appendChild(link)
  }, [])
}

export function PwaProvider({ children }: { children?: ReactNode }) {
  useErpManifest()
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [show, setShow] = useState(false)
  const [iosHelp, setIosHelp] = useState(false)
  const [installed, setInstalled] = useState(false)
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null)
  const autoUpdatingRef = useRef(false)

  useEffect(() => {
    void registerVoltrixServiceWorker()
    const standalone = isStandaloneApp()
    setInstalled(standalone)
    if (standalone) return

    const onPrompt = (event: Event) => {
      event.preventDefault()
      setDeferred(event as BeforeInstallPromptEvent)
      if (!dismissedThisLoad && !isLaptopOrDesktop()) setShow(true)
    }
    const onInstalled = () => {
      setInstalled(true)
      setShow(false)
    }
    window.addEventListener("beforeinstallprompt", onPrompt)
    window.addEventListener("appinstalled", onInstalled)

    const timer = window.setTimeout(() => {
      if (dismissedThisLoad || isStandaloneApp() || isLaptopOrDesktop()) return
      setShow(true)
      if (isIosDevice()) setIosHelp(true)
    }, 800)

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt)
      window.removeEventListener("appinstalled", onInstalled)
      window.clearTimeout(timer)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    let refreshing = false

    async function silentUpdate(registration?: ServiceWorkerRegistration | null) {
      if (cancelled || autoUpdatingRef.current) return
      autoUpdatingRef.current = true
      try {
        await autoApplyAppUpdate(registration ?? registrationRef.current)
      } finally {
        window.setTimeout(() => {
          autoUpdatingRef.current = false
        }, 2_000)
      }
    }

    async function checkVersion() {
      const latest = await fetchAppVersion().catch(() => "")
      if (!latest || cancelled) return
      const stored = storedAppVersion()
      if (!stored) {
        rememberAppVersion(latest)
        return
      }
      if (stored !== latest) void silentUpdate(registrationRef.current)
    }

    void registerAndWatchUpdates(() => {
      if (!cancelled) void silentUpdate(registrationRef.current)
    }).then((registration) => {
      registrationRef.current = registration
    })
    void checkVersion()

    const interval = window.setInterval(() => {
      void checkVersion()
      void registrationRef.current?.update().catch(() => {})
    }, 90_000)

    const onVisible = () => {
      if (document.visibilityState === "visible") void checkVersion()
    }
    document.addEventListener("visibilitychange", onVisible)

    const onControllerChange = () => {
      if (refreshing) return
      refreshing = true
      window.location.reload()
    }
    navigator.serviceWorker?.addEventListener("controllerchange", onControllerChange)

    return () => {
      cancelled = true
      window.clearInterval(interval)
      document.removeEventListener("visibilitychange", onVisible)
      navigator.serviceWorker?.removeEventListener("controllerchange", onControllerChange)
    }
  }, [])

  const install = useCallback(async () => {
    if (deferred) {
      await deferred.prompt()
      const choice = await deferred.userChoice
      setDeferred(null)
      if (choice.outcome === "accepted") {
        setShow(false)
        setInstalled(true)
      }
      return
    }
    if (isIosDevice()) {
      setIosHelp(true)
      setShow(true)
    }
  }, [deferred])

  function dismiss() {
    dismissedThisLoad = true
    setShow(false)
  }

  const value = useMemo<PwaContextValue>(
    () => ({
      installed,
      canPrompt: Boolean(deferred) || isIosDevice(),
      iosHelp,
      install,
    }),
    [installed, deferred, iosHelp, install],
  )

  return (
    <PwaContext.Provider value={value}>
      {children}
      {show && !installed && (
        <div className="fixed bottom-4 left-1/2 z-[110] w-[min(100vw-1.5rem,400px)] -translate-x-1/2">
          <div className="relative overflow-hidden rounded-2xl border bg-[hsl(var(--card))] text-[hsl(var(--foreground))] shadow-xl">
            <div className="absolute inset-x-0 top-0 h-1 bg-[#1a9f9a]" />
            <button
              type="button"
              onClick={dismiss}
              className="absolute top-2 right-2 h-7 w-7 rounded-full text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]"
              aria-label="Dismiss"
            >
              <X className="mx-auto h-4 w-4" />
            </button>
            <div className="flex gap-3 p-4 pr-10">
              <img
                src="/voltrix-pwa-192.png"
                alt=""
                className="h-12 w-12 rounded-xl object-cover"
              />
              <div className="min-w-0">
                <p className="text-sm font-semibold">Install Voltrix ERP</p>
                <p className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))]">
                  Add the ERP to your phone. Orders and approvals then show as real lock-screen notifications.
                </p>
                {iosHelp && (
                  <p className="mt-2 text-[11px] leading-relaxed text-[hsl(var(--muted-foreground))]">
                    On iPhone: tap <Share className="inline h-3 w-3" /> Share, then <strong>Add to Home Screen</strong>.
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => void install()}
                  className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#1a9f9a] px-3 text-xs font-semibold text-white hover:bg-[#158a85] cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5" />
                  {iosHelp ? "How to install" : "Install ERP app"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </PwaContext.Provider>
  )
}

export function InstallErpButton({ className }: { className?: string }) {
  const { installed, install, iosHelp } = useErpInstall()
  if (installed) return null

  return (
    <button
      type="button"
      onClick={() => void install()}
      className={
        className ??
        "inline-flex h-7 w-7 items-center justify-center rounded-full text-[#1d1d1f] dark:text-[hsl(var(--foreground))] hover:bg-black/[0.06] dark:hover:bg-white/10 shrink-0 cursor-pointer"
      }
      title={iosHelp ? "Add Voltrix ERP to Home Screen" : "Install Voltrix ERP"}
      aria-label={iosHelp ? "Add Voltrix ERP to Home Screen" : "Install Voltrix ERP"}
    >
      <Download className="h-[15px] w-[15px]" strokeWidth={1.75} />
    </button>
  )
}
