"use client"

import { Component, type ReactNode } from "react"
import { Button } from "@/components/ui/button"

interface Props {
  children: ReactNode
  onReset?: () => void
}

interface State {
  error: Error | null
}

export class AccountingErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="rounded-lg border border-red-200 bg-red-500/5 p-6 space-y-3">
          <p className="text-sm font-semibold text-red-800">Something went wrong in this view</p>
          <p className="text-xs text-red-700 font-mono break-all">{this.state.error.message}</p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              this.setState({ error: null })
              this.props.onReset?.()
            }}
          >
            Try again
          </Button>
        </div>
      )
    }
    return this.props.children
  }
}
