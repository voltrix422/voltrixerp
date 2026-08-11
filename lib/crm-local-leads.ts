/** Import batch for Rawalpindi + Islamabad industrial company lists. */
export const RWP_ISB_INDUSTRIAL_BATCH_ID = "rwp-isb-industrial-2026-08-11"

export const RWP_ISB_INDUSTRIAL_LABEL = "RWP/ISB Industrial Data Aug 2026"

export function isLocalIndustrialLead(lead: { importBatchId?: string | null }) {
  return lead.importBatchId === RWP_ISB_INDUSTRIAL_BATCH_ID
}
