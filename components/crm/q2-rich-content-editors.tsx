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

export function Q2ProjectsEditor({
  projects,
  onChange,
}: {
  projects: QuoteProjectCard[]
  onChange: (next: QuoteProjectCard[]) => void
}) {
  const { toast } = useToast()
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({})

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
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold">Recent projects</p>
          <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
            Showcase completed work with multiple photos per project.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 text-[10px]"
          onClick={() =>
            onChange([
              ...projects,
              {
                id: `project-${Date.now()}`,
                title: "",
                location: "",
                summary: "",
                imageUrls: [],
              },
            ])
          }
        >
          <Plus className="h-3 w-3 mr-1" />
          Add project
        </Button>
      </div>
      {projects.length === 0 ? (
        <p className="text-xs text-[hsl(var(--muted-foreground))]">No projects added yet.</p>
      ) : (
        projects.map((project) => (
          <div key={project.id} className="rounded-md border p-3 space-y-2">
            <div className="flex gap-2">
              <input
                value={project.title}
                onChange={(e) =>
                  onChange(projects.map((p) => (p.id === project.id ? { ...p, title: e.target.value } : p)))
                }
                placeholder="Project title"
                className="flex-1 h-8 rounded border px-2 text-sm font-medium"
              />
              <button
                type="button"
                className="text-red-600 text-xs cursor-pointer shrink-0"
                onClick={() => onChange(projects.filter((p) => p.id !== project.id))}
              >
                Remove
              </button>
            </div>
            <input
              value={project.location}
              onChange={(e) =>
                onChange(projects.map((p) => (p.id === project.id ? { ...p, location: e.target.value } : p)))
              }
              placeholder="Location (city / site)"
              className="w-full h-8 rounded border px-2 text-sm"
            />
            <textarea
              value={project.summary}
              onChange={(e) =>
                onChange(projects.map((p) => (p.id === project.id ? { ...p, summary: e.target.value } : p)))
              }
              rows={2}
              placeholder="Short project summary"
              className="w-full rounded border px-2 py-1.5 text-sm"
            />
            <div className="flex flex-wrap gap-2">
              {project.imageUrls.map((url) => (
                <div key={url} className="relative w-16 h-16 rounded border overflow-hidden bg-[hsl(var(--muted))]/30">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded p-0.5 cursor-pointer"
                    onClick={() =>
                      onChange(
                        projects.map((p) =>
                          p.id === project.id
                            ? { ...p, imageUrls: p.imageUrls.filter((u) => u !== url) }
                            : p,
                        ),
                      )
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
                className="w-16 h-16 rounded border border-dashed flex flex-col items-center justify-center text-[10px] text-[hsl(var(--muted-foreground))] cursor-pointer hover:bg-[hsl(var(--muted))]/30"
                disabled={uploadingId === project.id}
                onClick={() => fileRefs.current[project.id]?.click()}
              >
                {uploadingId === project.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <ImagePlus className="h-4 w-4 mb-0.5" />
                    Photos
                  </>
                )}
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  )
}

export function Q2WarrantiesEditor({
  warranties,
  onChange,
}: {
  warranties: QuoteWarrantySection[]
  onChange: (next: QuoteWarrantySection[]) => void
}) {
  return (
    <div className="border-t pt-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold">Product warranties</p>
          <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
            Per-product warranty details with bullets or plain text.
          </p>
        </div>
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
                heading: "Warranty",
                bodyType: "bullets",
                bullets: [""],
                plainText: "",
              },
            ])
          }
        >
          <Plus className="h-3 w-3 mr-1" />
          Add warranty
        </Button>
      </div>
      {warranties.map((row) => (
        <div key={row.id} className="rounded-md border p-3 space-y-2">
          <div className="flex gap-2">
            <input
              value={row.productName}
              onChange={(e) =>
                onChange(warranties.map((w) => (w.id === row.id ? { ...w, productName: e.target.value } : w)))
              }
              placeholder="Product name"
              className="flex-1 h-8 rounded border px-2 text-sm font-medium"
            />
            <button
              type="button"
              className="text-red-600 text-xs cursor-pointer"
              onClick={() => onChange(warranties.filter((w) => w.id !== row.id))}
            >
              Remove
            </button>
          </div>
          <input
            value={row.heading}
            onChange={(e) =>
              onChange(warranties.map((w) => (w.id === row.id ? { ...w, heading: e.target.value } : w)))
            }
            placeholder="Section heading (e.g. 5+5 Year Replacement)"
            className="w-full h-8 rounded border px-2 text-sm"
          />
          <BulletsOrPlainFields
            bodyType={row.bodyType}
            bullets={row.bullets}
            plainText={row.plainText}
            onBodyType={(bodyType) =>
              onChange(warranties.map((w) => (w.id === row.id ? { ...w, bodyType } : w)))
            }
            onBullets={(bullets) =>
              onChange(warranties.map((w) => (w.id === row.id ? { ...w, bullets } : w)))
            }
            onPlainText={(plainText) =>
              onChange(warranties.map((w) => (w.id === row.id ? { ...w, plainText } : w)))
            }
          />
        </div>
      ))}
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
}: {
  sections: QuoteCustomSection[]
  onChange: (next: QuoteCustomSection[]) => void
}) {
  return (
    <div className="border-t pt-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold">Custom sections</p>
          <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
            Free-form headings with bullet lists or plain paragraphs (scope, company profile, etc.).
          </p>
        </div>
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
}: {
  terms: QuoteTermSection[]
  onChange: (next: QuoteTermSection[]) => void
}) {
  return (
    <div className="border-t pt-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold">Terms & conditions</p>
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
