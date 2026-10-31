"use client"

import { useRef, useState } from "react"
import { ImagePlus, Loader2, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import {
  DEFAULT_Q2_TESTIMONIALS,
  type QuoteBodyType,
  type QuoteCustomSection,
  type QuoteProjectCard,
  type QuoteTermSection,
  type QuoteTestimonial,
  type QuoteWarrantySection,
} from "@/lib/extensive-quotations"

async function uploadQuoteImages(files: FileList | File[]): Promise<string[]> {
  const list = Array.from(files)
  if (!list.length) return []
  const form = new FormData()
  form.append("folder", "q2-quotes")
  for (const file of list) form.append("files", file)
  const res = await fetch("/api/upload", { method: "POST", body: form })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || "Upload failed")
  }
  const data = (await res.json()) as { urls?: string[] }
  return Array.isArray(data.urls) ? data.urls : []
}

function BodyTypeToggle({
  value,
  onChange,
}: {
  value: QuoteBodyType
  onChange: (next: QuoteBodyType) => void
}) {
  return (
    <div className="flex rounded border overflow-hidden text-[10px] font-semibold">
      <button
        type="button"
        className={`px-2 py-1 cursor-pointer ${value === "bullets" ? "bg-[#1faca6] text-white" : "bg-[hsl(var(--muted))]/40"}`}
        onClick={() => onChange("bullets")}
      >
        Bullets
      </button>
      <button
        type="button"
        className={`px-2 py-1 cursor-pointer ${value === "plain" ? "bg-[#1faca6] text-white" : "bg-[hsl(var(--muted))]/40"}`}
        onClick={() => onChange("plain")}
      >
        Plain text
      </button>
    </div>
  )
}

function BulletsOrPlainFields({
  bodyType,
  bullets,
  plainText,
  onBodyType,
  onBullets,
  onPlainText,
}: {
  bodyType: QuoteBodyType
  bullets: string[]
  plainText: string
  onBodyType: (t: QuoteBodyType) => void
  onBullets: (next: string[]) => void
  onPlainText: (text: string) => void
}) {
  return (
    <div className="space-y-2">
      <BodyTypeToggle value={bodyType} onChange={onBodyType} />
      {bodyType === "plain" ? (
        <textarea
          value={plainText}
          onChange={(e) => onPlainText(e.target.value)}
          rows={3}
          placeholder="Write details as plain text…"
          className="w-full rounded-md border px-3 py-2 text-sm"
        />
      ) : (
        <div className="space-y-1.5">
          {(bullets.length ? bullets : [""]).map((bullet, bIdx) => (
            <div key={bIdx} className="flex gap-2">
              <span className="text-[hsl(var(--muted-foreground))] mt-1.5">•</span>
              <input
                value={bullet}
                onChange={(e) => {
                  const base = bullets.length ? [...bullets] : [""]
                  base[bIdx] = e.target.value
                  onBullets(base)
                }}
                placeholder="Bullet point"
                className="flex-1 h-8 rounded border px-2 text-sm"
              />
              <button
                type="button"
                className="text-xs text-[hsl(var(--muted-foreground))] cursor-pointer"
                onClick={() => onBullets(bullets.filter((_, j) => j !== bIdx))}
              >
                ×
              </button>
            </div>
          ))}
          <button
            type="button"
            className="text-[11px] text-[#1faca6] cursor-pointer"
            onClick={() => onBullets([...(bullets.length ? bullets : [""]), ""])}
          >
            + Add bullet
          </button>
        </div>
      )}
    </div>
  )
}

export function Q2IntroField({
  introText,
  onIntro,
}: {
  introText: string
  onIntro: (v: string) => void
}) {
  return (
    <label className="text-xs font-semibold space-y-1 block border-t pt-4">
      <span>Opening message</span>
      <p className="text-[10px] font-normal text-[hsl(var(--muted-foreground))]">
        Short note under the client details on the PDF. Leave blank to skip.
      </p>
      <textarea
        value={introText}
        onChange={(e) => onIntro(e.target.value)}
        rows={3}
        placeholder="Thank you for the opportunity to quote…"
        className="w-full rounded-md border px-3 py-2 text-sm font-normal"
      />
    </label>
  )
}

export function Q2FooterField({
  footerText,
  onFooter,
}: {
  footerText: string
  onFooter: (v: string) => void
}) {
  return (
    <label className="text-xs font-semibold space-y-1 block border-t pt-4">
      <span>Custom footer</span>
      <p className="text-[10px] font-normal text-[hsl(var(--muted-foreground))]">
        Appears on each PDF page (under the default Voltrix line when branding is on).
      </p>
      <textarea
        value={footerText}
        onChange={(e) => onFooter(e.target.value)}
        rows={2}
        placeholder="e.g. Prices valid for 14 days. Subject to stock availability."
        className="w-full rounded-md border px-3 py-2 text-sm font-normal"
      />
    </label>
  )
}

function emptyProject(id = `project-${Date.now()}`): QuoteProjectCard {
  return {
    id,
    title: "Solar Power Plants",
    client: "",
    location: "",
    summary: "",
    projectValue: "",
    capacityMw: "",
    completionDate: "",
    imageUrls: [],
  }
}

export function Q2ProjectsEditor({
  projects,
  onChange,
  onResetDefaults,
}: {
  projects: QuoteProjectCard[]
  onChange: (next: QuoteProjectCard[]) => void
  onResetDefaults?: () => void
}) {
  const { toast } = useToast()
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({})

  function patch(id: string, partial: Partial<QuoteProjectCard>) {
    onChange(projects.map((p) => (p.id === id ? { ...p, ...partial } : p)))
  }

  async function handleUpload(projectId: string, files: FileList | null) {
    if (!files?.length) return
    setUploadingId(projectId)
    try {
      const urls = await uploadQuoteImages(files)
      onChange(
        projects.map((p) =>
          p.id === projectId ? { ...p, imageUrls: [...p.imageUrls, ...urls] } : p,
        ),
      )
    } catch (err) {
      toast({
        title: "Image upload failed",
        message: err instanceof Error ? err.message : undefined,
        type: "error",
      })
    } finally {
      setUploadingId(null)
    }
  }

  return (
    <div className="border-t pt-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold">Our previous projects</p>
          <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
            Pre-filled recent projects — edit freely. Photos optional.
          </p>
        </div>
        <div className="flex gap-1.5">
          {onResetDefaults && (
            <Button type="button" size="sm" variant="outline" className="h-7 text-[10px]" onClick={onResetDefaults}>
              Reset defaults
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 text-[10px]"
            onClick={() => onChange([...projects, emptyProject()])}
          >
            <Plus className="h-3 w-3 mr-1" />
            Add project
          </Button>
        </div>
      </div>
      {projects.length === 0 ? (
        <p className="text-xs text-[hsl(var(--muted-foreground))]">No projects added yet.</p>
      ) : (
        <div className="space-y-3">
          {projects.map((project, idx) => (
            <div key={project.id} className="rounded-md border p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-semibold text-[hsl(var(--muted-foreground))]">#{idx + 1}</p>
                <button
                  type="button"
                  className="text-red-600 text-xs cursor-pointer shrink-0"
                  onClick={() => onChange(projects.filter((p) => p.id !== project.id))}
                >
                  Remove
                </button>
              </div>
              <div className="grid sm:grid-cols-2 gap-2">
                <input
                  value={project.title}
                  onChange={(e) => patch(project.id, { title: e.target.value })}
                  placeholder="Project type"
                  className="h-8 rounded border px-2 text-sm"
                />
                <input
                  value={project.client || project.location}
                  onChange={(e) => patch(project.id, { client: e.target.value, location: e.target.value })}
                  placeholder="Client"
                  className="h-8 rounded border px-2 text-sm"
                />
              </div>
              <textarea
                value={project.summary}
                onChange={(e) => patch(project.id, { summary: e.target.value })}
                rows={3}
                placeholder="Description of the project"
                className="w-full rounded border px-2 py-1.5 text-sm"
              />
              <div className="grid grid-cols-3 gap-2">
                <label className="text-[10px] space-y-0.5">
                  <span className="text-[hsl(var(--muted-foreground))]">Value (M)</span>
                  <input
                    value={project.projectValue || ""}
                    onChange={(e) => patch(project.id, { projectValue: e.target.value })}
                    placeholder="e.g. 11.937"
                    className="w-full h-8 rounded border px-2 text-sm"
                  />
                </label>
                <label className="text-[10px] space-y-0.5">
                  <span className="text-[hsl(var(--muted-foreground))]">Capacity (MW)</span>
                  <input
                    value={project.capacityMw || ""}
                    onChange={(e) => patch(project.id, { capacityMw: e.target.value })}
                    placeholder="e.g. 5"
                    className="w-full h-8 rounded border px-2 text-sm"
                  />
                </label>
                <label className="text-[10px] space-y-0.5">
                  <span className="text-[hsl(var(--muted-foreground))]">Completion</span>
                  <input
                    value={project.completionDate || ""}
                    onChange={(e) => patch(project.id, { completionDate: e.target.value })}
                    placeholder="e.g. 05 June 2024"
                    className="w-full h-8 rounded border px-2 text-sm"
                  />
                </label>
              </div>
              <div className="flex flex-wrap gap-2">
                {project.imageUrls.map((url) => (
                  <div key={url} className="relative w-14 h-14 rounded border overflow-hidden bg-[hsl(var(--muted))]/30">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded p-0.5 cursor-pointer"
                      onClick={() =>
                        patch(project.id, { imageUrls: project.imageUrls.filter((u) => u !== url) })
                      }
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                <input
                  ref={(el) => {
                    fileRefs.current[project.id] = el
                  }}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    void handleUpload(project.id, e.target.files)
                    e.target.value = ""
                  }}
                />
                <button
                  type="button"
                  className="w-14 h-14 rounded border border-dashed flex flex-col items-center justify-center text-[10px] text-[hsl(var(--muted-foreground))] cursor-pointer hover:bg-[hsl(var(--muted))]/30"
                  disabled={uploadingId === project.id}
                  onClick={() => fileRefs.current[project.id]?.click()}
                >
                  {uploadingId === project.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <ImagePlus className="h-3.5 w-3.5 mb-0.5" />
                      Photo
                    </>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function Q2WarrantiesEditor({
  warranties,
  onChange,
  onResetDefaults,
}: {
  warranties: QuoteWarrantySection[]
  onChange: (next: QuoteWarrantySection[]) => void
  onResetDefaults?: () => void
}) {
  return (
    <div className="border-t pt-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold">Product warranties</p>
          <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
            Pre-filled table — edit Product, Brand, and Warranty freely.
          </p>
        </div>
        <div className="flex gap-1.5">
          {onResetDefaults && (
            <Button type="button" size="sm" variant="outline" className="h-7 text-[10px]" onClick={onResetDefaults}>
              Reset defaults
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 text-[10px]"
            onClick={() =>
              onChange([
                ...warranties,
                {
                  id: `warranty-${Date.now()}`,
                  productName: "",
                  heading: "",
                  bodyType: "plain",
                  bullets: [],
                  plainText: "",
                },
              ])
            }
          >
            <Plus className="h-3 w-3 mr-1" />
            Add row
          </Button>
        </div>
      </div>
      <div className="overflow-x-auto rounded border">
        <table className="w-full min-w-[640px] text-xs">
          <thead>
            <tr className="bg-[hsl(var(--muted))]/40">
              <th className="px-2 py-2 text-left w-10">#</th>
              <th className="px-2 py-2 text-left">Product</th>
              <th className="px-2 py-2 text-left">Brand</th>
              <th className="px-2 py-2 text-left w-28">Warranty</th>
              <th className="px-2 py-2 w-16" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {warranties.map((row, idx) => (
              <tr key={row.id}>
                <td className="px-2 py-1.5 text-[hsl(var(--muted-foreground))]">{idx + 1}</td>
                <td className="px-2 py-1.5">
                  <textarea
                    value={row.productName}
                    onChange={(e) =>
                      onChange(
                        warranties.map((w) =>
                          w.id === row.id ? { ...w, productName: e.target.value, bodyType: "plain" } : w,
                        ),
                      )
                    }
                    rows={2}
                    placeholder="Product / warranty name"
                    className="w-full rounded border px-2 py-1 text-xs"
                  />
                </td>
                <td className="px-2 py-1.5">
                  <input
                    value={row.heading}
                    onChange={(e) =>
                      onChange(warranties.map((w) => (w.id === row.id ? { ...w, heading: e.target.value } : w)))
                    }
                    placeholder="Brand"
                    className="w-full h-8 rounded border px-2 text-xs"
                  />
                </td>
                <td className="px-2 py-1.5">
                  <input
                    value={row.plainText}
                    onChange={(e) =>
                      onChange(
                        warranties.map((w) =>
                          w.id === row.id ? { ...w, plainText: e.target.value, bodyType: "plain", bullets: [] } : w,
                        ),
                      )
                    }
                    placeholder="e.g. 10 years"
                    className="w-full h-8 rounded border px-2 text-xs"
                  />
                </td>
                <td className="px-2 py-1.5 text-right">
                  <button
                    type="button"
                    className="text-red-600 text-[10px] cursor-pointer"
                    onClick={() => onChange(warranties.filter((w) => w.id !== row.id))}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function Q2TestimonialsEditor({
  testimonials,
  onChange,
}: {
  testimonials: QuoteTestimonial[]
  onChange: (next: QuoteTestimonial[]) => void
}) {
  return (
    <div className="border-t pt-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold">Testimonials</p>
          <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
            Client quotes for the proposal PDF.
          </p>
        </div>
        <div className="flex gap-1.5">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 text-[10px]"
            onClick={() => {
              const stamp = Date.now()
              onChange([
                ...testimonials,
                ...DEFAULT_Q2_TESTIMONIALS.map((t, i) => ({
                  id: `testimonial-default-${stamp}-${i}`,
                  ...t,
                })),
              ])
            }}
          >
            Add from defaults
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 text-[10px]"
            onClick={() =>
              onChange([
                ...testimonials,
                { id: `testimonial-${Date.now()}`, name: "", role: "", quote: "" },
              ])
            }
          >
            <Plus className="h-3 w-3 mr-1" />
            Custom
          </Button>
        </div>
      </div>
      {testimonials.map((row) => (
        <div key={row.id} className="rounded-md border p-3 space-y-2">
          <div className="grid sm:grid-cols-2 gap-2">
            <input
              value={row.name}
              onChange={(e) =>
                onChange(testimonials.map((t) => (t.id === row.id ? { ...t, name: e.target.value } : t)))
              }
              placeholder="Name"
              className="h-8 rounded border px-2 text-sm"
            />
            <div className="flex gap-2">
              <input
                value={row.role}
                onChange={(e) =>
                  onChange(testimonials.map((t) => (t.id === row.id ? { ...t, role: e.target.value } : t)))
                }
                placeholder="Role / company"
                className="flex-1 h-8 rounded border px-2 text-sm"
              />
              <button
                type="button"
                className="text-red-600 text-xs cursor-pointer shrink-0"
                onClick={() => onChange(testimonials.filter((t) => t.id !== row.id))}
              >
                Remove
              </button>
            </div>
          </div>
          <textarea
            value={row.quote}
            onChange={(e) =>
              onChange(testimonials.map((t) => (t.id === row.id ? { ...t, quote: e.target.value } : t)))
            }
            rows={2}
            placeholder="Testimonial quote"
            className="w-full rounded border px-2 py-1.5 text-sm"
          />
        </div>
      ))}
    </div>
  )
}

export function Q2CustomSectionsEditor({
  sections,
  onChange,
  onResetDefaults,
}: {
  sections: QuoteCustomSection[]
  onChange: (next: QuoteCustomSection[]) => void
  onResetDefaults?: () => void
}) {
  return (
    <div className="border-t pt-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold">Unit generation & custom sections</p>
          <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
            Unit generation averages and other free-form headings — all editable.
          </p>
        </div>
        <div className="flex gap-1.5">
          {onResetDefaults && (
            <Button type="button" size="sm" variant="outline" className="h-7 text-[10px]" onClick={onResetDefaults}>
              Reset defaults
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 text-[10px]"
            onClick={() =>
              onChange([
                ...sections,
                {
                  id: `custom-${Date.now()}`,
                  heading: "",
                  bodyType: "bullets",
                  bullets: [""],
                  plainText: "",
                },
              ])
            }
          >
            <Plus className="h-3 w-3 mr-1" />
            Add section
          </Button>
        </div>
      </div>
      {sections.map((row) => (
        <div key={row.id} className="rounded-md border p-3 space-y-2">
          <div className="flex gap-2">
            <input
              value={row.heading}
              onChange={(e) =>
                onChange(sections.map((s) => (s.id === row.id ? { ...s, heading: e.target.value } : s)))
              }
              placeholder="Heading"
              className="flex-1 h-8 rounded border px-2 text-sm font-medium"
            />
            <button
              type="button"
              className="text-red-600 text-xs cursor-pointer"
              onClick={() => onChange(sections.filter((s) => s.id !== row.id))}
            >
              Remove
            </button>
          </div>
          <BulletsOrPlainFields
            bodyType={row.bodyType}
            bullets={row.bullets}
            plainText={row.plainText}
            onBodyType={(bodyType) =>
              onChange(sections.map((s) => (s.id === row.id ? { ...s, bodyType } : s)))
            }
            onBullets={(bullets) =>
              onChange(sections.map((s) => (s.id === row.id ? { ...s, bullets } : s)))
            }
            onPlainText={(plainText) =>
              onChange(sections.map((s) => (s.id === row.id ? { ...s, plainText } : s)))
            }
          />
        </div>
      ))}
    </div>
  )
}

export function Q2TermsEditor({
  terms,
  onChange,
  onResetDefaults,
}: {
  terms: QuoteTermSection[]
  onChange: (next: QuoteTermSection[]) => void
  onResetDefaults?: () => void
}) {
  return (
    <div className="border-t pt-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold">Terms & conditions</p>
          <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
            Pre-reqs, payment terms, notes — all editable.
          </p>
        </div>
        <div className="flex gap-1.5">
          {onResetDefaults && (
            <Button type="button" size="sm" variant="outline" className="h-7 text-[10px]" onClick={onResetDefaults}>
              Reset defaults
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 text-[10px]"
            onClick={() =>
              onChange([
                ...terms,
                { id: `term-${Date.now()}`, heading: "", bodyType: "bullets", bullets: [""], plainText: "" },
              ])
            }
          >
            Add heading
          </Button>
        </div>
      </div>
      {terms.map((section) => {
        const bodyType = section.bodyType || "bullets"
        return (
          <div key={section.id} className="rounded-md border p-3 space-y-2">
            <div className="flex gap-2">
              <input
                value={section.heading}
                onChange={(e) =>
                  onChange(terms.map((t) => (t.id === section.id ? { ...t, heading: e.target.value } : t)))
                }
                placeholder="Heading (e.g. Payment, Delivery, Warranty)"
                className="flex-1 h-8 rounded border px-2 text-sm font-medium"
              />
              <button
                type="button"
                className="text-red-600 text-xs cursor-pointer"
                onClick={() => onChange(terms.filter((t) => t.id !== section.id))}
              >
                Remove
              </button>
            </div>
            <BulletsOrPlainFields
              bodyType={bodyType}
              bullets={section.bullets}
              plainText={section.plainText || ""}
              onBodyType={(next) =>
                onChange(terms.map((t) => (t.id === section.id ? { ...t, bodyType: next } : t)))
              }
              onBullets={(bullets) =>
                onChange(terms.map((t) => (t.id === section.id ? { ...t, bullets } : t)))
              }
              onPlainText={(plainText) =>
                onChange(terms.map((t) => (t.id === section.id ? { ...t, plainText } : t)))
              }
            />
          </div>
        )
      })}
    </div>
  )
}
