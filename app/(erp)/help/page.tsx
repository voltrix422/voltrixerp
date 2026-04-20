import { Topbar } from "@/components/layout/topbar"
import { HelpContent } from "@/components/help/help-content"

export default function HelpPage() {
  return (
    <>
      <Topbar title="Get Help" description="Guides, flows, and documentation for the ERP system" />
      <div className="flex-1 overflow-auto">
        <div className="p-6">
          <HelpContent />
        </div>
      </div>
    </>
  )
}
