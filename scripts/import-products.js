const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('crypto');

const DATA_FILE = path.join(__dirname, '..', 'data', 'products.json');

// Parsed product data from user input
const productsToImport = [
  {
    name: "HS-TQS4.2KW+8038.4Wh",
    category: "Energy Storage",
    description: "Stackable energy storage battery with off-grid inverter",
    full_desc: "Stackable energy storage battery with off-grid inverter. Features 4200W rated output power, 8038.4Wh battery capacity, and advanced LiFePO4 technology.",
    specification: "Rated Output Power: 4200W, Battery: 25.6V 314Ah 8038.4Wh, PV Input: 5000W max, AC Output: 208-240Vac",
    price: 0,
    warranty: "",
    stock: 1,
    specs: [
      { label: "Rated Output Power", value: "4200W" },
      { label: "Battery Voltage", value: "25.6V" },
      { label: "Battery Capacity", value: "314Ah" },
      { label: "Battery Energy", value: "8038.4Wh" },
      { label: "PV Input Power", value: "5000W max" },
      { label: "AC Output Voltage", value: "208/220/230/240Vac" },
      { label: "Inverter Type", value: "Off-grid" }
    ],
    images: [],
    published: true,
    unit: "pcs",
    created_by: "admin"
  },
  {
    name: "VOLTRIX 16 KWh",
    category: "Energy Storage",
    description: "Lithium Iron Phosphate Battery with 10 years warranty",
    full_desc: "VOLTRIX 16 KWh Lithium Iron Phosphate Battery. Features 10 years warranty, 10,000+ long cycle life, and intelligent battery management system (BMS).",
    specification: "Nominal Energy: 16.08 KWh, Nominal Voltage: 51.2Vdc, Nominal Capacity: 314 Ah, DoD: 95%, Cycle Life: ≥10000 cycles",
    price: 560000,
    warranty: "10 YEARS",
    stock: 1,
    specs: [
      { label: "Nominal Energy", value: "16.08 KWh" },
      { label: "Nominal Voltage", value: "51.2Vdc" },
      { label: "Nominal Capacity", value: "314 Ah" },
      { label: "DoD", value: "95%" },
      { label: "Cycle Life", value: "≥10000 cycles" },
      { label: "Dimensions", value: "915x445x280 mm" },
      { label: "Weight", value: "≈110 kg" },
      { label: "Communication", value: "CAN/RS485/RS232" }
    ],
    images: [],
    published: true,
    unit: "pcs",
    created_by: "admin"
  },
  {
    name: "HS-BG5000W-A6",
    category: "Energy Storage",
    description: "Energy storage battery 5.12 kWh",
    full_desc: "Energy storage battery with 5.12 kWh capacity. Features grid-connected functionality and advanced BMS protection.",
    specification: "Rated Voltage: 51.2V, Rated Capacity: 100Ah, Rated Energy: 5120Wh, Dimensions: 400x185x670mm",
    price: 0,
    warranty: "",
    stock: 1,
    specs: [
      { label: "Rated Voltage", value: "51.2V" },
      { label: "Rated Capacity", value: "100Ah" },
      { label: "Rated Energy", value: "5120Wh" },
      { label: "Dimensions", value: "400x185x670mm" },
      { label: "Weight", value: "49.3kg" },
      { label: "Communication", value: "RS485, CAN" }
    ],
    images: [],
    published: true,
    unit: "pcs",
    created_by: "admin"
  },
  {
    name: "HS-LD15KW-A2",
    category: "Energy Storage",
    description: "Energy storage battery 15.616 kWh for building load",
    full_desc: "Energy storage battery with 15.616 kWh capacity designed for building load applications. Features LED+LCD display and multiple communication ports.",
    specification: "Rated Voltage: 51.2V, Rated Capacity: 305Ah, Rated Energy: 15616Wh, Dimensions: 500x233x810mm",
    price: 0,
    warranty: "",
    stock: 1,
    specs: [
      { label: "Rated Voltage", value: "51.2V" },
      { label: "Rated Capacity", value: "305Ah" },
      { label: "Rated Energy", value: "15616Wh" },
      { label: "Dimensions", value: "500x233x810mm" },
      { label: "Weight", value: "117.5kg" },
      { label: "Communication", value: "RS485, CAN" },
      { label: "Cycle Life", value: ">8000 cycles" }
    ],
    images: [],
    published: true,
    unit: "pcs",
    created_by: "admin"
  },
  {
    name: "HS-12.8V100Ah",
    category: "Energy Storage",
    description: "12.8V 100Ah 1280Wh LiFePO4 battery",
    full_desc: "12.8V 100Ah 1280Wh LiFePO4 energy storage battery with 6000+ cycle life. Features square cell 3.2V100Ah technology.",
    specification: "Nominal Voltage: 12.8V, Nominal Capacity: 100Ah, Energy: 1280Wh, Dimensions: 532x207x215mm",
    price: 0,
    warranty: "",
    stock: 1,
    specs: [
      { label: "Nominal Voltage", value: "12.8V" },
      { label: "Nominal Capacity", value: "100Ah" },
      { label: "Energy", value: "1280Wh" },
      { label: "Dimensions", value: "532x207x215mm" },
      { label: "Weight", value: "20.5kg" },
      { label: "Cycle Life", value: "6000+" },
      { label: "Terminal", value: "M8" }
    ],
    images: [],
    published: true,
    unit: "pcs",
    created_by: "admin"
  },
  {
    name: "HS-25.6V100Ah",
    category: "Energy Storage",
    description: "25.6V 100Ah 2560Wh LiFePO4 battery",
    full_desc: "25.6V 100Ah 2560Wh LiFePO4 energy storage battery with 6000+ cycle life. Features square cell 3.2V100Ah technology.",
    specification: "Nominal Voltage: 25.6V, Nominal Capacity: 100Ah, Energy: 2560Wh, Dimensions: 532x207x215mm",
    price: 0,
    warranty: "",
    stock: 1,
    specs: [
      { label: "Nominal Voltage", value: "25.6V" },
      { label: "Nominal Capacity", value: "100Ah" },
      { label: "Energy", value: "2560Wh" },
      { label: "Dimensions", value: "532x207x215mm" },
      { label: "Weight", value: "20.5kg" },
      { label: "Cycle Life", value: "6000+" },
      { label: "Terminal", value: "M8" }
    ],
    images: [],
    published: true,
    unit: "pcs",
    created_by: "admin"
  }
];

async function importProducts() {
  try {
    // Read existing products
    const data = await fs.readFile(DATA_FILE, 'utf-8');
    const existingProducts = JSON.parse(data);
    
    // Add new products with IDs and timestamps
    const newProducts = productsToImport.map(product => ({
      ...product,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      order: existingProducts.length
    }));
    
    // Combine existing and new products
    const allProducts = [...newProducts, ...existingProducts];
    
    // Write back to file
    await fs.writeFile(DATA_FILE, JSON.stringify(allProducts, null, 2));
    
    console.log(`Successfully imported ${newProducts.length} products`);
    console.log('Imported products:', newProducts.map(p => p.name));
  } catch (error) {
    console.error('Error importing products:', error);
    process.exit(1);
  }
}

importProducts();
