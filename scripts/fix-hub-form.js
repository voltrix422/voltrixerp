const fs = require("fs")
const p = "components/crm/sales-agents-hub.tsx"
let t = fs.readFileSync(p, "utf8")
const start = '      {showForm && isSuperAdmin && hubTab === "agents" && ('
const end = '      {hubTab === "agents" && ('
const i = t.indexOf(start)
const j = t.indexOf(end)
if (i < 0 || j < 0) {
  console.error("markers not found", i, j)
  process.exit(1)
}
const insert = `      {isSuperAdmin && (
        <SalesAgentFormModal
          open={showForm}
          editing={editing}
          managers={managers}
          otherAgents={agents}
          updatedBy={user.name}
          onClose={closeForm}
          onSaved={loadAgents}
          onManagersChange={reloadManagers}
        />
      )}

`
t = t.slice(0, i) + insert + t.slice(j)
fs.writeFileSync(p, t)
console.log("fixed hub")
