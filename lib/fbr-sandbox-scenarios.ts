import type { FbrInvoiceItemPayload } from "@/lib/fbr-digital-invoice"

/** FBR sandbox scenario codes assigned in the DI portal. */
export type FbrSandboxScenarioId =
  | "SN001"
  | "SN002"
  | "SN005"
  | "SN006"
  | "SN007"
  | "SN008"
  | "SN016"
  | "SN017"
  | "SN024"
  | "SN026"
  | "SN027"
  | "SN028"

export const FBR_SANDBOX_SCENARIO_LABELS: Record<FbrSandboxScenarioId, string> = {
  SN001: "Goods at standard rate — registered buyer",
  SN002: "Goods at standard rate — unregistered buyer",
  SN005: "Goods at reduced rate",
  SN006: "Exempt goods",
  SN007: "Zero-rated goods",
  SN008: "3rd Schedule goods",
  SN016: "Processing / conversion of goods",
  SN017: "Goods where FED is charged in ST mode",
  SN024: "Goods listed in SRO 297(1)/2023",
  SN026: "Standard rate to end consumer (retailer)",
  SN027: "3rd Schedule to end consumer (retailer)",
  SN028: "Reduced rate to end consumer (retailer)",
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100
}

export function defaultSandboxScenarioId(buyerRegistered: boolean): FbrSandboxScenarioId {
  return buyerRegistered ? "SN001" : "SN002"
}

export function parseSandboxScenarioId(raw: string | undefined | null): FbrSandboxScenarioId | "" {
  const id = String(raw || "").trim().toUpperCase()
  if (id in FBR_SANDBOX_SCENARIO_LABELS) return id as FbrSandboxScenarioId
  return ""
}

/** Apply PRAL sandbox item rules for a scenario (POS / DI test invoices). */
export function applySandboxScenarioToItems(
  scenarioId: FbrSandboxScenarioId,
  items: FbrInvoiceItemPayload[],
): FbrInvoiceItemPayload[] {
  if (!items.length) return items

  const mapOne = (item: FbrInvoiceItemPayload): FbrInvoiceItemPayload => {
    const excl = roundMoney(Math.max(0, Number(item.valueSalesExcludingST) || 0))
    const discount = roundMoney(Math.max(0, Number(item.discount) || 0))

    switch (scenarioId) {
      case "SN017": {
        const st = roundMoney(excl * 0.08)
        return {
          ...item,
          hsCode: item.hsCode || "0101.2100",
          rate: "8%",
          saleType: "Goods (FED in ST Mode)",
          valueSalesExcludingST: excl,
          salesTaxApplicable: st,
          fedPayable: 0,
          extraTax: 0,
          furtherTax: 0,
          totalValues: roundMoney(excl + st),
          discount,
          sroScheduleNo: "",
          sroItemSerialNo: "",
        }
      }
      case "SN005":
        return {
          ...item,
          rate: "1%",
          saleType: "Goods at Reduced Rate",
          salesTaxApplicable: roundMoney(excl * 0.01),
          totalValues: roundMoney(excl + roundMoney(excl * 0.01)),
          sroScheduleNo: item.sroScheduleNo || "EIGHTH SCHEDULE Table 1",
          sroItemSerialNo: item.sroItemSerialNo || "82",
          fedPayable: 0,
        }
      case "SN006":
        return {
          ...item,
          rate: "Exempt",
          saleType: "Exempt goods",
          salesTaxApplicable: 0,
          totalValues: excl,
          sroScheduleNo: item.sroScheduleNo || "6th Schd Table I",
          sroItemSerialNo: item.sroItemSerialNo || "100",
          fedPayable: 0,
        }
      case "SN007":
        return {
          ...item,
          rate: "0%",
          saleType: "Goods at zero-rate",
          salesTaxApplicable: 0,
          totalValues: excl,
          sroScheduleNo: item.sroScheduleNo || "327(I)/2008",
          sroItemSerialNo: item.sroItemSerialNo || "1",
          fedPayable: 0,
        }
      case "SN008":
      case "SN027": {
        const mrp = roundMoney(Math.max(excl, Number(item.fixedNotifiedValueOrRetailPrice) || 100))
        const st = roundMoney(mrp * 0.18)
        return {
          ...item,
          rate: "18%",
          saleType: "3rd Schedule Goods",
          valueSalesExcludingST: 0,
          fixedNotifiedValueOrRetailPrice: mrp,
          salesTaxApplicable: st,
          totalValues: roundMoney(st),
          fedPayable: 0,
        }
      }
      case "SN016": {
        const st = roundMoney(excl * 0.05)
        return {
          ...item,
          rate: "5%",
          saleType: "Processing/Conversion of Goods",
          salesTaxApplicable: st,
          totalValues: roundMoney(excl + st),
          fedPayable: 0,
        }
      }
      case "SN024": {
        const st = roundMoney(excl * 0.25)
        return {
          ...item,
          rate: "25%",
          saleType: "Goods as per SRO.297(|)/2023",
          salesTaxApplicable: st,
          totalValues: roundMoney(excl + st),
          sroScheduleNo: item.sroScheduleNo || "297(I)/2023-Table-I",
          sroItemSerialNo: item.sroItemSerialNo || "12",
          fedPayable: 0,
        }
      }
      case "SN028": {
        const st = roundMoney(excl * 0.01)
        return {
          ...item,
          rate: "1%",
          saleType: "Goods at Reduced Rate",
          salesTaxApplicable: st,
          totalValues: roundMoney(excl + st),
          sroScheduleNo: item.sroScheduleNo || "EIGHTH SCHEDULE Table 1",
          sroItemSerialNo: item.sroItemSerialNo || "70",
          fedPayable: 0,
        }
      }
      case "SN001":
      case "SN002":
      case "SN026":
      default:
        return {
          ...item,
          rate: item.rate || "18%",
          saleType: item.saleType || "Goods at standard rate (default)",
          fedPayable: 0,
        }
    }
  }

  return items.map(mapOne)
}
