import { Topbar } from "@/components/layout/topbar"
import { MessagesManager } from "@/components/messages/messages-manager"

export default function MessagesPage() {
  return (
    <>
      <Topbar title="Messages" description="Internal ERP messaging between user IDs" />
      <div className="flex-1 overflow-auto">
        <div className="p-6">
          <MessagesManager />
        </div>
      </div>
    </>
  )
}

