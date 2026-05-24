export type WarrantyTermsSection = {
  title: string
  paragraphs?: string[]
  bullets?: string[]
}

export const VOLTRIX_COMPREHENSIVE_WARRANTY = {
  company: "Voltrix Batteries Pvt. Ltd.",
  documentTitle: "Comprehensive Warranty Terms & Conditions",
  sections: [
    {
      title: "1. Warranty Coverage",
      paragraphs: [
        "Voltrix Batteries Pvt. Ltd. warrants that its products are free from manufacturing defects in material and workmanship under normal operating conditions during the applicable warranty period.",
        "This warranty applies only to genuine Voltrix products purchased through authorized dealers, distributors, or official sales channels.",
      ],
    },
    {
      title: "2. Warranty Start Date",
      paragraphs: [
        "The warranty period shall start from: the original date of purchase mentioned on the customer invoice, and the warranty activation/start date mentioned on the digital warranty card. Both dates must match for the warranty claim to be considered valid.",
        "Failure to provide matching purchase and warranty registration records may result in rejection of the warranty claim.",
      ],
    },
    {
      title: "3. Product Warranty Categories",
      bullets: [
        "Residential / Solar Batteries — limited replacement warranty for manufacturing defects, internal battery malfunction, and BMS malfunction caused by factory defects.",
        "Solar Inverters — limited replacement warranty for manufacturing defects and PCB or internal component malfunction under normal usage.",
        "EV Battery Packs — warranty per specified years or kilometer limitation on product/invoice, whichever comes first.",
      ],
    },
    {
      title: "4. Replacement Warranty Policy",
      paragraphs: [
        "Voltrix products are covered under a replacement warranty policy. The product will first be inspected and tested at the designated Voltrix Warranty Claim Lab or authorized service center.",
        "If the issue is a manufacturing defect or internal malfunction, Voltrix may repair the product. If it cannot be technically resolved, the product may be replaced with an equivalent unit.",
        "Replacement does not mean immediate exchange at dealer location. All warranty claims are subject to technical inspection and approval by Voltrix Batteries Pvt. Ltd.",
      ],
    },
    {
      title: "5. Conditions for Warranty Validity",
      bullets: [
        "Product installed per Voltrix installation guidelines by a qualified technician/electrician.",
        "Approved and compatible charging/inverter equipment is used.",
        "Serial number and warranty seals remain intact and readable.",
        "No unauthorized repair or modification is performed.",
      ],
    },
    {
      title: "6. Water Protection & IP Rating Conditions",
      paragraphs: [
        "Products with IP-20, IP-21, or IP-54 ratings are not fully waterproof. Warranty claims related to water, moisture, humidity, or liquid damage shall not be accepted if the installation environment exceeds the product's rated protection level.",
      ],
    },
    {
      title: "7. Transportation Responsibility",
      paragraphs: [
        "Transportation of the product to the designated local warranty claim center is the responsibility of the customer/client.",
        "Voltrix Batteries Pvt. Ltd. shall not be responsible for transportation costs, shipping charges, handling charges, or packaging damage during transportation for warranty claims.",
      ],
    },
    {
      title: "8. Warranty Exclusions",
      bullets: [
        "Improper installation or wiring; incompatible inverter/charger systems; reverse polarity.",
        "Operation beyond rated limits; physical damage or mishandling.",
        "Fire, flooding, lightning, or natural disasters; unauthorized repair or modification.",
        "Tampering with warranty seals; removal or alteration of serial numbers.",
        "Voltage surges or external electrical faults.",
      ],
    },
    {
      title: "9. Battery Performance Disclaimer",
      paragraphs: [
        "Battery backup timing, runtime, and performance may vary depending on load, charging patterns, temperature, usage, and connected equipment.",
        "Normal capacity degradation over time is standard behavior and shall not be treated as a manufacturing defect unless otherwise specified by Voltrix.",
      ],
    },
    {
      title: "10. Warranty Claim Procedure",
      paragraphs: [
        "To process a warranty claim, the customer must provide: original purchase invoice, digital warranty registration details, product serial number, and claim description. The product must be submitted to an authorized Voltrix warranty claim center for technical evaluation.",
      ],
    },
    {
      title: "11. Claim Approval Rights",
      paragraphs: [
        "Voltrix Batteries Pvt. Ltd. reserves the right to inspect and diagnose the product, analyze system logs where applicable, and approve or reject claims based on technical findings. The final decision regarding warranty approval shall remain solely with Voltrix Batteries Pvt. Ltd.",
      ],
    },
    {
      title: "12. Limitation of Liability",
      paragraphs: [
        "Voltrix Batteries Pvt. Ltd. shall not be liable for indirect or consequential damages, business losses, downtime losses, data loss, labor charges, installation charges, or third-party equipment damage.",
        "The company's maximum liability shall be limited only to repair or replacement of the defective product under approved warranty conditions.",
      ],
    },
    {
      title: "13. Commercial & Industrial Usage",
      paragraphs: [
        "Warranty terms for commercial, industrial, telecom, or high-load applications may differ from residential warranty policies. Voltrix reserves the right to apply separate warranty conditions depending on the application type.",
      ],
    },
    {
      title: "14. General Terms",
      bullets: [
        "Warranty is non-transferable unless approved in writing by Voltrix Batteries Pvt. Ltd.",
        "Warranty terms may vary depending on product model and category.",
        "Voltrix Batteries Pvt. Ltd. reserves the right to modify warranty policies without prior notice.",
        "Use of the product implies acceptance of these warranty terms and conditions.",
      ],
    },
  ] satisfies WarrantyTermsSection[],
  footer: {
    company: "Voltrix Batteries Pvt. Ltd.",
    location: "Islamabad, Pakistan",
    website: "voltrixbatteries.com",
  },
} as const
