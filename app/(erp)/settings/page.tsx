import { Topbar } from "@/components/layout/topbar"
import { AccountSettings } from "@/components/settings/account-settings"

export default function SettingsPage() {
  return (
    <>
      <Topbar title="Settings" description="Manage your account credentials" />
      <div className="flex-1 overflow-auto">
        <div className="p-6">
          <AccountSettings />
        </div>
      </div>
    </>
  )
}
