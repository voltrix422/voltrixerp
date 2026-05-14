"use client"

import { useEffect, useState } from "react"
import { getUsers, saveUser, type User } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { Plus, Users } from "lucide-react"

type Props = {
  onSelectAgent: (agent: User) => void
}

export function SalesAgentsManage({ onSelectAgent }: Props) {
  const { toast } = useToast()
  const [agents, setAgents] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getUsers()
      .then(users => setAgents(users.filter(user => user.role === "sales_agent")))
      .finally(() => setLoading(false))
  }, [])

  async function createAgent() {
    if (!name.trim() || !email.trim() || !password.trim()) {
      toast({ title: "Missing details", message: "Enter name, email, and password.", type: "error" })
      return
    }

    setSaving(true)
    try {
      const agent: User = {
        id: Date.now().toString(),
        name: name.trim(),
        email: email.trim(),
        password,
        role: "sales_agent",
        modules: ["crm"],
      }
      await saveUser(agent)
      setAgents(prev => [agent, ...prev])
      setShowForm(false)
      setName("")
      setEmail("")
      setPassword("")
      toast({ title: "Sales agent created", message: `${agent.name} can sign in with the new credentials.`, type: "success" })
    } catch {
      toast({ title: "Error", message: "Failed to create sales agent.", type: "error" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-[#1faca6]" />
            <h2 className="text-sm font-semibold">Manage sales agents</h2>
          </div>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
            Create login IDs for sales agents and open each profile to review their CRM work.
          </p>
        </div>
        <Button size="sm" className="h-8 text-xs cursor-pointer" onClick={() => setShowForm(v => !v)}>
          <Plus className="h-3.5 w-3.5 mr-1" />
          New sales agent
        </Button>
      </div>

      {showForm && (
        <div className="rounded-lg border p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Full name"
              className="h-9 rounded-md border bg-[hsl(var(--background))] px-3 text-sm"
            />
            <input
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Email"
              type="email"
              className="h-9 rounded-md border bg-[hsl(var(--background))] px-3 text-sm"
            />
            <input
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Password"
              type="password"
              className="h-9 rounded-md border bg-[hsl(var(--background))] px-3 text-sm"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="outline" className="h-8 text-xs cursor-pointer" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button size="sm" className="h-8 text-xs cursor-pointer" onClick={createAgent} disabled={saving}>
              {saving ? "Saving..." : "Create login"}
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-[hsl(var(--muted-foreground))]">Loading sales agents...</p>
      ) : agents.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-sm text-[hsl(var(--muted-foreground))]">
          No sales agents yet. Create the first login above.
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-[hsl(var(--muted))]/40">
                <th className="h-8 px-4 text-left text-xs font-medium text-[hsl(var(--muted-foreground))]">Name</th>
                <th className="h-8 px-4 text-left text-xs font-medium text-[hsl(var(--muted-foreground))]">Email</th>
                <th className="h-8 px-4 text-right text-xs font-medium text-[hsl(var(--muted-foreground))]">Profile</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {agents.map(agent => (
                <tr key={agent.id} className="hover:bg-[hsl(var(--muted))]/20">
                  <td className="px-4 py-2.5 font-medium">{agent.name}</td>
                  <td className="px-4 py-2.5 text-[hsl(var(--muted-foreground))]">{agent.email}</td>
                  <td className="px-4 py-2.5 text-right">
                    <Button size="sm" variant="outline" className="h-7 text-xs cursor-pointer" onClick={() => onSelectAgent(agent)}>
                      Open profile
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
