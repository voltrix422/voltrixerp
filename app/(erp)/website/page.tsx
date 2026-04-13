import { Topbar } from "@/components/layout/topbar"
import { ComingSoon } from "@/components/layout/coming-soon"
import { ModuleGuard } from "@/components/layout/module-guard"

export default function WebsitePage() {
  return (
    <ModuleGuard module="website">
      <Topbar title="Website" />
      <ComingSoon title="Website" />
    </ModuleGuard>
  )
}
