"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { deleteClient, getClients, saveClient, type Client } from "@/lib/crm"
import { branchPosClientTag, isBranchPosClient } from "@/lib/branch-pos"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { useDialog } from "@/components/ui/dialog-provider"
import { Loader2, Plus, Search, Trash2, UserPlus, X } from "lucide-react"

export function BranchPosClientsList({
  branchName,
  userName,
}: {
  branchName: string
  userName: string
}) {
  const { toast } = useToast()
  const { confirm } = useDialog()
  const [loading, setLoading] = useState(true)
  const [clients, setClients] = useState<Client[]>([])
  const [search, setSearch] = useState("")
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const all = await getClients()
      setClients(all.filter((c) => isBranchPosClient(c, branchName)))
    } finally {
      setLoading(false)
    }
  }, [branchName])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return clients
    return clients.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        c.company.toLowerCase().includes(q),
    )
  }, [clients, search])

  function resetForm() {
    setName("")
    setPhone("")
    setShowForm(false)
  }

  async function handleSave() {
    if (!name.trim()) {
      toast({ type: "error", title: "Client name is required" })
      return
    }
    setSaving(true)
    try {
      const client: Client = {
        id: Date.now().toString(),
        name: name.trim(),
        company: "",
        email: "",
        phone: phone.trim(),
        address: "",
        city: "",
        country: "",
        website: "",
        taxId: "",
        ntn: "",
        industry: "",
        contactPerson: "",
        notes: branchPosClientTag(branchName),
        createdAt: new Date().toISOString(),
        createdBy: userName,
        status: "active",
      }
      await saveClient(client)
      setClients((prev) => [client, ...prev])
      resetForm()
      toast({ type: "success", title: "Client added" })
    } catch (err) {
      toast({
        type: "error",
        title: "Could not save client",
        message: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(client: Client) {
    const ok = await confirm({
      type: "confirm",
      title: "Delete client?",
      message: `${client.name} will be removed from this branch POS. Existing orders keep the client name.`,
      confirmLabel: "Delete",
    })
    if (!ok) return
    setBusyId(client.id)
    try {
      await deleteClient(client.id)
      setClients((prev) => prev.filter((c) => c.id !== client.id))
      toast({ type: "success", title: "Client deleted" })
    } catch (err) {
      toast({
        type: "error",
        title: "Could not delete",
        message: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="rounded-xl border bg-[hsl(var(--card))] overflow-hidden">
      <div className="px-4 py-3 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">Clients</p>
          <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
            Clients added in Branch POS only — not shown in ERP CRM
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          className="h-9 text-xs bg-[#1faca6] hover:bg-[#17857f] text-white shrink-0"
          onClick={() => setShowForm(true)}
        >
          <Plus className="h-3.5 w-3.5" />
          Add client
        </Button>
      </div>

      <div className="px-4 py-2.5 border-b">
        <div className="relative max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or phone…"
            className="w-full h-9 rounded-md border bg-[hsl(var(--background))] pl-8 pr-3 text-sm"
          />
        </div>
      </div>

      {showForm && (
        <div className="px-4 py-3 border-b bg-[hsl(var(--muted))]/10 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold flex items-center gap-1.5">
              <UserPlus className="h-3.5 w-3.5" /> New client
            </p>
            <button type="button" onClick={resetForm} className="text-[hsl(var(--muted-foreground))] cursor-pointer">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-medium text-[hsl(var(--muted-foreground))]">Client name *</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full h-9 rounded-md border px-2 text-sm"
                placeholder="Name"
                autoFocus
              />
            </div>
            <div>
              <label className="text-[10px] font-medium text-[hsl(var(--muted-foreground))]">Phone</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mt-1 w-full h-9 rounded-md border px-2 text-sm"
                placeholder="03xx…"
              />
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            className="h-8 text-xs bg-[#1faca6] hover:bg-[#17857f] text-white"
            disabled={saving || !name.trim()}
            onClick={() => void handleSave()}
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Save client
          </Button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--muted-foreground))]" />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[hsl(var(--muted))]/30 text-[10px] uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
              <tr>
                <th className="text-left px-3 py-2.5">Name</th>
                <th className="text-left px-3 py-2.5">Phone</th>
                <th className="text-left px-3 py-2.5">Added</th>
                <th className="text-right px-3 py-2.5 w-14"> </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((c) => (
                <tr key={c.id} className="hover:bg-[hsl(var(--muted))]/10">
                  <td className="px-3 py-2.5 font-medium">{c.name}</td>
                  <td className="px-3 py-2.5 text-xs text-[hsl(var(--muted-foreground))]">
                    {c.phone || "—"}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-[hsl(var(--muted-foreground))] whitespace-nowrap">
                    {c.createdAt ? new Date(c.createdAt).toLocaleString("en-PK") : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                      disabled={busyId === c.id}
                      title="Delete client"
                      onClick={() => void handleDelete(c)}
                    >
                      {busyId === c.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-10 text-center text-[hsl(var(--muted-foreground))]">
                    {search.trim()
                      ? "No clients match your search"
                      : "No clients yet — add one here or via Quick add on New order"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
