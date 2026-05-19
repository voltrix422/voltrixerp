import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const p = path.join(__dirname, "..", "components", "crm", "leads-manager.tsx")
const text = fs.readFileSync(p, "utf8")
const start = text.indexOf("function FacebookLeadImportModal")
const end = text.indexOf("function AddLeadModal")
if (start < 0 || end < 0) throw new Error("markers not found")

const replacement = String.raw`function FacebookLeadImportModal({
  importing,
  onClose,
  onPickFile,
}: {
  importing: boolean
  onClose: () => void
  onPickFile: (uploaderName: string) => void
}) {
  const [name, setName] = useState("Facebook Lead Ads")

  return (
    <motion.div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <motion.div
        className="bg-[hsl(var(--background))] rounded-lg border shadow-lg max-w-lg w-full p-4 space-y-3 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-semibold">Import Facebook Lead Ads</h3>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-[hsl(var(--muted))] cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          Upload Meta export with FULL_NAME, PHONE, COMPANY_NAME, City, Address.
        </p>
        <p className="text-[10px] text-[hsl(var(--muted-foreground))] font-mono break-all">
          {FACEBOOK_LEAD_ADS_HEADERS.join(", ")}
        </p>
        <div>
          <label className="text-xs font-medium">Import label *</label>
          <input
            className="mt-1 w-full h-9 rounded border px-2 text-sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" size="sm" className="cursor-pointer" onClick={onClose} disabled={importing}>
            Cancel
          </Button>
          <Button
            size="sm"
            className="cursor-pointer"
            disabled={!name.trim() || importing}
            onClick={() => onPickFile(name.trim())}
          >
            {importing ? "Importing…" : "Choose CSV file"}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  )
}

function CsvImportModal({
  onClose,
  onContinue,
}: {
  onClose: () => void
  onContinue: (uploaderName: string) => void
}) {
  const [name, setName] = useState("")

  return (
    <motion.div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <motion.div
        className="bg-[hsl(var(--background))] rounded-lg border shadow-lg max-w-md w-full p-4 space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-semibold">Import CSV</h3>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-[hsl(var(--muted))] cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          Who is importing these leads? This name and the import date are shown on the import record.
        </p>
        <div>
          <label className="text-xs font-medium">Importer name *</label>
          <input
            className="mt-1 w-full h-9 rounded border px-2 text-sm"
            placeholder="e.g. Ali Khan"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" size="sm" className="cursor-pointer" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            className="cursor-pointer"
            disabled={!name.trim()}
            onClick={() => onContinue(name.trim())}
          >
            Choose CSV file
          </Button>
        </div>
      </motion.div>
    </motion.div>
  )
}

`.replaceAll("motion.div", "div")

fs.writeFileSync(p, text.slice(0, start) + replacement + text.slice(end))
console.log("fixed modals")
