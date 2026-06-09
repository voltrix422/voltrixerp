"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Mail, Plus, X } from "lucide-react"

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function parseEmailsInput(raw: string): string[] {
  return raw
    .split(/[,;\s]+/)
    .map(e => e.trim().toLowerCase())
    .filter(e => emailPattern.test(e))
}

type Props = {
  emails: string[]
  enabled: boolean
  onEmailsChange: (emails: string[]) => void
  onEnabledChange: (enabled: boolean) => void
  compact?: boolean
  readOnly?: boolean
}

export function NotificationEmailsEditor({
  emails,
  enabled,
  onEmailsChange,
  onEnabledChange,
  compact = false,
  readOnly = false,
}: Props) {
  const [typedEmail, setTypedEmail] = useState("")
  const [bulkInput, setBulkInput] = useState("")
  const [inputError, setInputError] = useState("")

  function addSingleEmail() {
    const trimmed = typedEmail.trim().toLowerCase()
    if (!trimmed) return
    if (!emailPattern.test(trimmed)) {
      setInputError("Enter a valid email address")
      return
    }
    if (emails.includes(trimmed)) {
      setInputError("This email is already added")
      return
    }
    onEmailsChange([...emails, trimmed])
    setTypedEmail("")
    setInputError("")
  }

  function addBulkEmails() {
    const parsed = parseEmailsInput(bulkInput)
    if (!parsed.length) {
      setInputError("No valid emails found. Separate multiple with commas.")
      return
    }
    const merged = [...emails]
    for (const e of parsed) {
      if (!merged.includes(e)) merged.push(e)
    }
    onEmailsChange(merged)
    setBulkInput("")
    setInputError("")
  }

  function removeEmail(email: string) {
    onEmailsChange(emails.filter(e => e !== email))
  }

  const inputCls = compact
    ? "flex-1 h-7 rounded border bg-[hsl(var(--background))] px-2 text-[10px] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
    : "w-full h-9 rounded-md border bg-[hsl(var(--background))] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1faca6]/40 focus:border-[#1faca6]"

  return (
    <div className={compact ? "space-y-1.5" : "space-y-3"}>
      <label className={`flex items-center gap-2 ${compact ? "text-[10px]" : "text-xs"} cursor-pointer w-fit`}>
        <input
          type="checkbox"
          checked={enabled}
          disabled={readOnly}
          onChange={e => onEnabledChange(e.target.checked)}
          className="h-3.5 w-3.5 rounded border"
        />
        <span className="font-medium">Send email notifications to custom addresses</span>
      </label>

      {!readOnly && (
        <>
          <div className={compact ? "space-y-1" : "space-y-1.5"}>
            {!compact && (
              <label className="text-xs font-medium flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-[#1faca6]" />
                Add notification email
              </label>
            )}
            <div className="flex gap-1.5">
              <input
                type="email"
                value={typedEmail}
                onChange={e => { setTypedEmail(e.target.value); setInputError("") }}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addSingleEmail() } }}
                placeholder="e.g. yourname@gmail.com"
                className={inputCls}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                className={compact ? "h-7 text-[10px] px-2 shrink-0 cursor-pointer" : "h-9 shrink-0 cursor-pointer"}
                onClick={addSingleEmail}
              >
                <Plus className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} />
                {!compact && <span className="ml-1">Add</span>}
              </Button>
            </div>
          </div>

          {!compact && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[hsl(var(--muted-foreground))]">
                Or paste multiple (comma-separated)
              </label>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={bulkInput}
                  onChange={e => { setBulkInput(e.target.value); setInputError("") }}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addBulkEmails() } }}
                  placeholder="email1@gmail.com, email2@outlook.com"
                  className={inputCls}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-9 shrink-0 cursor-pointer"
                  onClick={addBulkEmails}
                >
                  Add all
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {inputError && (
        <p className={`${compact ? "text-[10px]" : "text-xs"} text-red-600`}>{inputError}</p>
      )}

      <div className="space-y-1">
        {!compact && (
          <p className="text-xs font-medium text-[hsl(var(--muted-foreground))]">
            Notification will be sent to:
          </p>
        )}
        {emails.length === 0 ? (
          <p className={`${compact ? "text-[10px]" : "text-xs"} text-[hsl(var(--muted-foreground))]`}>
            No custom emails added yet
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {emails.map(email => (
              <span
                key={email}
                className={`inline-flex items-center gap-1 rounded-full border bg-[hsl(var(--muted))]/40 px-2 py-0.5 ${
                  compact ? "text-[10px]" : "text-xs"
                }`}
              >
                {email}
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => removeEmail(email)}
                    className="text-[hsl(var(--muted-foreground))] hover:text-red-500 cursor-pointer"
                    aria-label={`Remove ${email}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </span>
            ))}
          </div>
        )}
      </div>

      {!compact && (
        <p className="text-[10px] text-[hsl(var(--muted-foreground))] leading-relaxed">
          Separate from your login email. Works with Gmail, Hostinger, Outlook, or any inbox you add here.
        </p>
      )}
    </div>
  )
}
