import { composeProductTermsContent } from "@/lib/parse-product-terms"

export const DEFAULT_PRODUCT_TERMS_NAME = "5 Year Warranty"

/** Shared default terms for every product unless overridden in admin. */
export const DEFAULT_PRODUCT_TERMS_FIELDS = {
  title: "5 Year Warranty",
  subtitle: "12KW Hybrid Inverter | AEP-12KS48P3",
  intro: `Voltrix Batteries Pvt. Ltd. provides advanced lithium-based energy storage solutions for residential and commercial use. Known for innovation and reliability, Voltrix offers high-performance, durable products designed to meet modern energy needs efficiently.

Their WL-16 model is a compact, wall-mounted 16 kWh Lithium Iron Phosphate (LiFePO4) battery, delivering 16 kWh capacity with over 6000 charge cycles. It features an intelligent BMS for safety, supports CAN, RS485, and RS232 communication, and offers Bluetooth app monitoring for real-time tracking. Compliant with international safety standards, it ensures dependable operation with strong technical support and warranty coverage.`,
  bullets: [
    "For indoor use only (IP21); keep away from water, moisture, and high humidity.",
    "Install correctly with approved inverters and chargers as per guidelines.",
    "The warranty covers manufacturing defects under normal use with valid proof of purchase.",
    "For any battery warranty claim, the battery will first undergo a thorough inspection and testing process in our laboratory. If any manufacturing defect or issue covered under warranty is identified and deemed claimable, the battery will be replaced accordingly. If no claimable fault is found, the battery will not be eligible for replacement.",
    "The warranty does not cover water damage, physical damage, misuse, or unauthorized repairs.",
    "Avoid overloading, short-circuiting, or bypassing the BMS; monitor performance via the mobile app.",
    "The company is not liable for indirect damage, losses, or misuse-related issues.",
    "Operate within the recommended temperature (-10°C to 60°C) and voltage limits to ensure safe and efficient performance.",
    "Any modification, tampering, or disassembly of the battery will immediately void the warranty.",
  ],
}

export const DEFAULT_PRODUCT_TERMS_CONTENT = composeProductTermsContent({
  title: DEFAULT_PRODUCT_TERMS_FIELDS.title,
  subtitle: DEFAULT_PRODUCT_TERMS_FIELDS.subtitle,
  intro: DEFAULT_PRODUCT_TERMS_FIELDS.intro,
  bullets: DEFAULT_PRODUCT_TERMS_FIELDS.bullets,
})
