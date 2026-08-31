import type { ProductSpecRow } from "@/lib/product-specs"
import type { ProductSeoCopy } from "@/lib/product-seo-copy"
import Link from "next/link"

export function ProductSeoSections({
  copy,
  specRows,
  productName,
}: {
  copy: ProductSeoCopy
  specRows: ProductSpecRow[]
  productName: string
}) {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 space-y-10">
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-neutral-900">About this {productName}</h2>
        <p className="text-sm text-neutral-600 leading-relaxed">{copy.intro}</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-neutral-900">Key features</h2>
        <ul className="space-y-3">
          {copy.features.map((f) => (
            <li key={f.title}>
              <p className="text-sm font-semibold text-neutral-800">{f.title}</p>
              <p className="text-sm text-neutral-600 leading-relaxed">{f.body}</p>
            </li>
          ))}
        </ul>
      </section>

      {specRows.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-neutral-900">Technical specifications</h2>
          <div className="overflow-x-auto rounded-xl border border-neutral-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-neutral-50 text-left">
                  <th className="px-4 py-2.5 font-semibold text-neutral-700">Specification</th>
                  <th className="px-4 py-2.5 font-semibold text-neutral-700">Value</th>
                </tr>
              </thead>
              <tbody>
                {specRows.map((row, i) => (
                  <tr key={`${row.label}-${i}`} className="border-t border-neutral-100">
                    <td className="px-4 py-2 text-neutral-600">{row.label || "—"}</td>
                    <td className="px-4 py-2 text-neutral-900">{row.value || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-neutral-900">Compatible systems</h2>
        <p className="text-sm text-neutral-600 leading-relaxed">{copy.compatible}</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-neutral-900">Installation requirements</h2>
        <p className="text-sm text-neutral-600 leading-relaxed">{copy.installation}</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-neutral-900">Warranty and support</h2>
        <p className="text-sm text-neutral-600 leading-relaxed">{copy.warranty}</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-neutral-900">Use cases</h2>
        <p className="text-sm text-neutral-600 leading-relaxed">{copy.useCases}</p>
        <p className="text-sm text-neutral-600 leading-relaxed">{copy.vsLeadAcid}</p>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-neutral-900">Frequently asked questions</h2>
        <dl className="space-y-4">
          {copy.faqs.map((faq) => (
            <div key={faq.q}>
              <dt className="text-sm font-semibold text-neutral-800">{faq.q}</dt>
              <dd className="text-sm text-neutral-600 leading-relaxed mt-1">{faq.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      <p className="text-sm text-neutral-500">
        See the full{" "}
        <Link href="/products" className="text-[#1a9f9a] font-medium hover:underline">
          lithium battery and inverter catalog
        </Link>
        , get a{" "}
        <Link href="/quote" className="text-[#1a9f9a] font-medium hover:underline">
          free quote
        </Link>
        , or read{" "}
        <Link
          href="/blog/lifepo4-battery-price-pakistan-2026"
          className="text-[#1a9f9a] font-medium hover:underline"
        >
          LiFePO4 battery prices in Pakistan
        </Link>
        .
      </p>
    </div>
  )
}
