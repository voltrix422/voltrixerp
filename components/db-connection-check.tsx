"use client"
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { WifiOff, RefreshCw, Loader2 } from "lucide-react"

export function DBConnectionCheck() {
  const [showError, setShowError] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const [isChecking, setIsChecking] = useState(true)
  const [isRetrying, setIsRetrying] = useState(false)
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    checkConnection()
  }, [])

  async function checkConnection() {
    try {
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Connection timeout")), 10000)
      )
      
      const queryPromise = supabase.from("erp_users").select("count", { count: "exact", head: true })
      
      const { error } = await Promise.race([queryPromise, timeoutPromise]) as any
      
      if (error) {
        if (error.message?.includes("fetch") || error.message?.includes("network")) {
          setErrorMessage("No internet connection")
        } else {
          setErrorMessage("Database connection failed")
        }
        setShowError(true)
      } else {
        setShowError(false)
        setRetryCount(0)
      }
    } catch (err) {
      if (err instanceof Error) {
        if (err.message.includes("timeout") || err.message.includes("fetch")) {
          setErrorMessage("Cannot connect to server")
        } else {
          setErrorMessage("Connection error")
        }
      } else {
        setErrorMessage("No internet connection")
      }
      setShowError(true)
    } finally {
      setIsChecking(false)
      setIsRetrying(false)
    }
  }

  async function handleRetry() {
    setIsRetrying(true)
    setRetryCount(prev => prev + 1)
    
    // Wait 5 seconds before retrying
    await new Promise(resolve => setTimeout(resolve, 5000))
    
    await checkConnection()
  }

  if (isChecking && retryCount === 0) {
    return null
  }

  if (!showError) {
    return null
  }

  return (
    <div className="fixed bottom-6 right-6 z-[100] animate-in slide-in-from-bottom-5 duration-300">
      <div className="flex items-center gap-3 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950 px-4 py-3 shadow-lg min-w-[320px]">
        <div className="flex items-center gap-3 flex-1">
          <div className="flex-shrink-0">
            <WifiOff className="h-5 w-5 text-red-600 dark:text-red-400" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-900 dark:text-red-100">
              {errorMessage}
            </p>
            <p className="text-xs text-red-700 dark:text-red-300 mt-0.5">
              {isRetrying ? "Reconnecting..." : "Check your internet connection"}
            </p>
          </div>
        </div>
        
        <button
          onClick={handleRetry}
          disabled={isRetrying}
          className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white text-xs font-medium transition-colors disabled:cursor-not-allowed"
        >
          {isRetrying ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>Retrying...</span>
            </>
          ) : (
            <>
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Retry</span>
            </>
          )}
        </button>
      </div>
      
      {/* Retry counter */}
      {retryCount > 0 && (
        <p className="text-[10px] text-[hsl(var(--muted-foreground))] text-right mt-1 px-1">
          Attempt {retryCount}
        </p>
      )}
    </div>
  )
}
