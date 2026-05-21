import { composeProductTermsContent } from "@/lib/parse-product-terms"

export const DEFAULT_PRODUCT_TERMS_NAME = "5 Year Warranty"

/** Shared default terms for every product unless overridden in admin. */
export const DEFAULT_PRODUCT_TERMS_FIELDS = {
  title: "5 YEAR WARRANTY",
  subtitle: "",
  intro:
    "Voltrix Batteries Pvt. Ltd. provides advanced lithium-based energy storage solutions for residential and commercial use. Known for innovation and reliability, Voltrix offers high-performance, durable products designed to meet modern energy needs efficiently.",
  bullets: [
    "For indoor use only (IP21); keep away from water, moisture, and high humidity.",
    "Install correctly with approved inverters and chargers as per guidelines.",
    "The warranty covers manufacturing defects under normal use with valid proof of purchase.",
    "The warranty does not cover water damage, physical damage, misuse, or unauthorized repairs.",
    "Avoid overloading, short-circuiting, or bypassing the BMS; monitor performance via the mobile app.",
    "The company is not liable for indirect damage, losses, or misuse-related issues.",
    "Operate within the recommended temperature range (-10°C to 60°C) and voltage limits to ensure safe and efficient performance.",
    "Any modification, tampering, or disassembly of the battery will immediately void the warranty.",
    "For warranty claims, the product will first be inspected and investigated at the company's lab. If the inspection finds any damage, misuse, tampering, unauthorized modifications, or any issue not covered under the warranty terms, no warranty claim or replacement will be provided. If a manufacturing defect or warranty-covered issue is confirmed, warranty service or replacement will be provided according to the company's warranty policy.",
  ],
}

export const DEFAULT_PRODUCT_TERMS_CONTENT = composeProductTermsContent({
  title: DEFAULT_PRODUCT_TERMS_FIELDS.title,
  subtitle: DEFAULT_PRODUCT_TERMS_FIELDS.subtitle,
  intro: DEFAULT_PRODUCT_TERMS_FIELDS.intro,
  bullets: DEFAULT_PRODUCT_TERMS_FIELDS.bullets,
})
