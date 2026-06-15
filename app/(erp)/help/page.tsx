import { Topbar } from "@/components/layout/topbar"
import { HelpContent } from "@/components/help/help-content"

export default function HelpPage() {
  return (
    <>
      <Topbar title="Get Help" description="Step-by-step guides, flowcharts, and answers for every ERP module" />
      <div className="flex-1 overflow-auto">
        <div className="p-6">
          <HelpContent />
        </div>
      </div>
    </>
  )
}
