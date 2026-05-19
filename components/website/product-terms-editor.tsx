"use client"

import { useEffect, useState } from "react"
import { RotateCcw } from "lucide-react"
import {
  DEFAULT_PRODUCT_TERMS_CONTENT,
  DEFAULT_PRODUCT_TERMS_FIELDS,
} from "@/lib/default-product-terms"
import {
  composeProductTermsContent,
  decomposeProductTermsContent,
} from "@/lib/parse-product-terms"

type TermsState = {
  terms: string
  termsTemplateId: string
  termsFile: string
}

type Props = {
  value: TermsState
  onChange: (value: TermsState) => void
}

type StructuredFields = {
  title: string
  subtitle: string
  intro: string
  bullets: string
}

function fieldsFromContent(content: string): StructuredFields {
  const d = decomposeProductTermsContent(content || DEFAULT_PRODUCT_TERMS_CONTENT)
  return {
    title: d.title,
    subtitle: d.subtitle,
    intro: d.intro,
    bullets: d.bullets.join("\n"),
  }
}

function contentFromFields(fields: StructuredFields): string {
  return composeProductTermsContent({
    title: fields.title,
    subtitle: fields.subtitle,
    intro: fields.intro,
    bullets: fields.bullets.split("\n"),
  })
}

const DEFAULT_FIELDS: StructuredFields = {
  title: DEFAULT_PRODUCT_TERMS_FIELDS.title,
  subtitle: DEFAULT_PRODUCT_TERMS_FIELDS.subtitle,
  intro: DEFAULT_PRODUCT_TERMS_FIELDS.intro,
  bullets: DEFAULT_PRODUCT_TERMS_FIELDS.bullets.join("\n"),
}

export default function ProductTermsEditor({ value, onChange }: Props) {
  const [fields, setFields] = useState<StructuredFields>(() =>
    fieldsFromContent(value.terms || DEFAULT_PRODUCT_TERMS_CONTENT),
  )

  useEffect(() => {
    setFields(fieldsFromContent(value.terms || DEFAULT_PRODUCT_TERMS_CONTENT))
  }, [value.terms])

  function applyFields(next: StructuredFields) {
    setFields(next)
    onChange({
      terms: contentFromFields(next),
      termsTemplateId: "",
      termsFile: "",
    })
  }

  function resetToDefault() {
    applyFields({ ...DEFAULT_FIELDS })
  }

  return (
    <div className="rounded-xl border p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Terms & Conditions
          </p>
          <p className="text-[11px] text-muted-foreground mt-1 max-w-md">
            Same default text for all products. Edit below for this product only, or reset to the
            company default.
          </p>
        </div>
        <button
          type="button"
          onClick={resetToDefault}
          className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border hover:bg-accent"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Reset to default
        </button>
      </div>

      <TermsFieldsForm fields={fields} onChange={applyFields} idPrefix="product" />
    </div>
  )
}

function FieldBlock({
  label,
  value,
  onChange,
  placeholder,
  singleLine,
  rows = 4,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  singleLine?: boolean
  rows?: number
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {singleLine ? (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full h-9 px-3 rounded-lg border text-sm outline-none focus:border-[#1a9f9a] bg-white"
          placeholder={placeholder}
        />
      ) : (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          className="w-full px-3 py-2 rounded-lg border text-sm outline-none focus:border-[#1a9f9a] resize-y bg-white"
          placeholder={placeholder}
        />
      )}
    </div>
  )
}

function TermsFieldsForm({
  fields,
  onChange,
  idPrefix,
}: {
  fields: StructuredFields
  onChange: (fields: StructuredFields) => void
  idPrefix: string
}) {
  return (
    <div className="grid grid-cols-1 gap-4 rounded-lg border border-[#1a9f9a]/20 bg-[#1a9f9a]/5 p-4">
      <FieldBlock
        label="Title"
        value={fields.title}
        onChange={(title) => onChange({ ...fields, title })}
        placeholder="5 Year Warranty"
        singleLine
      />
      <FieldBlock
        label="Subtitle (optional — model line)"
        value={fields.subtitle}
        onChange={(subtitle) => onChange({ ...fields, subtitle })}
        placeholder="12KW Hybrid Inverter | AEP-12KS48P3"
        singleLine
      />
      <FieldBlock
        label="Introduction"
        value={fields.intro}
        onChange={(intro) => onChange({ ...fields, intro })}
        placeholder="Company and product overview…"
        rows={6}
      />
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground" htmlFor={`${idPrefix}-bullets`}>
          Terms and conditions (one bullet per line)
        </label>
        <textarea
          id={`${idPrefix}-bullets`}
          value={fields.bullets}
          onChange={(e) => onChange({ ...fields, bullets: e.target.value })}
          rows={10}
          className="w-full px-3 py-2 rounded-lg border text-sm outline-none focus:border-[#1a9f9a] resize-y bg-white"
          placeholder="For indoor use only (IP21)…"
        />
      </div>
    </div>
  )
}
