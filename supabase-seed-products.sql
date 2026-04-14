-- Run this AFTER supabase-website-products-schema.sql
-- Seeds all existing website products into the database

insert into website_products (name, category, description, full_desc, price, warranty, stock, specs, published) values
(
  'WL-5', 'Residential',
  '5.2 KWh Battery with Built-in WiFi + Bluetooth — Wall Mount Sleek Design',
  'The Voltrix WL-5 is a 5.2 KWh wall-mount residential battery pack featuring built-in WiFi and Bluetooth connectivity for real-time monitoring. Its sleek design integrates seamlessly into any home environment while delivering reliable backup power.',
  'Rs. 210,000', '5 years', 'low',
  '[{"label":"Capacity","value":"5.2 KWh"},{"label":"Voltage","value":"48V"},{"label":"Connectivity","value":"WiFi + Bluetooth"},{"label":"Mount Type","value":"Wall Mount"},{"label":"Chemistry","value":"LiFePO₄"},{"label":"Warranty","value":"5 years"}]',
  true
),
(
  'WL-16', 'Residential',
  'Longer Backup Solution — 16 KWh wall-mount residential battery pack',
  'The WL-16 delivers 16 KWh of energy storage for homes requiring extended backup. Designed for longer outages, it pairs with solar systems and inverters for a complete off-grid or hybrid energy solution.',
  'Rs. 560,000', '10 years', 'in',
  '[{"label":"Capacity","value":"16 KWh"},{"label":"Voltage","value":"48V"},{"label":"Mount Type","value":"Wall Mount"},{"label":"Chemistry","value":"LiFePO₄"},{"label":"Cycle Life","value":"6,000+ cycles"},{"label":"Warranty","value":"10 years"}]',
  true
),
(
  'UP-12100', 'Residential',
  'Energy Storage Battery Pack — 12 Volt UPS replacement solution',
  'The UP-12100 is a 12V LiFePO₄ battery pack designed as a direct replacement for lead-acid UPS batteries. It offers significantly longer life, faster charging, and lighter weight.',
  'Rs. 55,000', '5 years', 'out',
  '[{"label":"Voltage","value":"12V"},{"label":"Capacity","value":"100Ah"},{"label":"Chemistry","value":"LiFePO₄"},{"label":"Application","value":"UPS Replacement"},{"label":"Weight","value":"~12 kg"},{"label":"Warranty","value":"5 years"}]',
  true
),
(
  'UP-24100', 'Residential',
  'UPS Battery Pack — 24V high-capacity residential energy storage',
  'The UP-24100 is a 24V 100Ah LiFePO₄ battery pack ideal for UPS systems and residential energy storage. It delivers reliable power with a long cycle life and built-in BMS protection.',
  'Rs. 95,000', '5 years', 'out',
  '[{"label":"Voltage","value":"24V"},{"label":"Capacity","value":"100Ah"},{"label":"Chemistry","value":"LiFePO₄"},{"label":"Application","value":"UPS / Residential"},{"label":"BMS","value":"Built-in Smart BMS"},{"label":"Warranty","value":"5 years"}]',
  true
),
(
  'A-100716', 'BMS',
  '7S–16S 100A Smart BMS with 1A balancing current — universal compatibility',
  'Pakistan''s first indigenously developed Battery Management System. The A-100716 supports 7S to 16S LiFePO₄ configurations with 100A continuous current and 1A active balancing. Features over-charge, over-discharge, short circuit, and thermal protection.',
  'Rs. 14,000', '1 year', 'out',
  '[{"label":"Cell Configuration","value":"7S–16S"},{"label":"Continuous Current","value":"100A"},{"label":"Balancing Current","value":"1A"},{"label":"Chemistry","value":"LiFePO₄"},{"label":"Communication","value":"Bluetooth"},{"label":"Warranty","value":"1 year"}]',
  true
),
(
  'EV Champ V-24', 'EV',
  '24V 27Ah LiFePO₄ — ideal drop-in replacement for graphene or lead-acid EV batteries',
  'The EV Champ V-24 is a 24V 27Ah LiFePO₄ battery pack engineered for electric rickshaws and light EVs. It is a direct drop-in replacement for graphene or lead-acid batteries with significantly better performance and lifespan.',
  'Rs. 32,000', '2 years', 'in',
  '[{"label":"Voltage","value":"24V"},{"label":"Capacity","value":"27Ah"},{"label":"Chemistry","value":"LiFePO₄"},{"label":"Application","value":"Electric Rickshaw / Light EV"},{"label":"BMS","value":"Smart BMS (Bluetooth)"},{"label":"Warranty","value":"2 years"}]',
  true
),
(
  'CS-80', 'Industrial',
  'Commercial Energy Storage — 80 KWh BESS for large-scale commercial deployments',
  'The CS-80 is an 80 KWh Battery Energy Storage System designed for commercial and industrial applications. It integrates with solar and grid systems to provide reliable, scalable energy storage for businesses.',
  'Rs. 35,00,000', '10 years', 'out',
  '[{"label":"Capacity","value":"80 KWh"},{"label":"Application","value":"Commercial / Industrial"},{"label":"Chemistry","value":"LiFePO₄"},{"label":"Integration","value":"Solar + Grid"},{"label":"Monitoring","value":"Remote SCADA"},{"label":"Warranty","value":"10 years"}]',
  true
),
(
  'BESS-232 KWh', 'Industrial',
  'Industrial Energy Storage — 232 KWh BESS for grid-scale and industrial applications',
  'The BESS-232 is a 232 KWh industrial-grade Battery Energy Storage System for grid-scale deployments, factories, and large commercial facilities. Pricing is available on request based on project scope.',
  'Request for Quote', '10 years', 'in',
  '[{"label":"Capacity","value":"232 KWh"},{"label":"Application","value":"Grid-scale / Industrial"},{"label":"Chemistry","value":"LiFePO₄"},{"label":"Scalable","value":"Yes — modular design"},{"label":"Monitoring","value":"Remote SCADA + BMS"},{"label":"Warranty","value":"10 years"}]',
  true
),
(
  'EV Champ 72V', 'EV',
  '72V 27Ah LiFePO₄ EV Battery | 2.0 KWh | 1C/3C | Smart BMS with Bluetooth',
  'The EV Champ 72V delivers 2.0 KWh of energy in a compact LiFePO₄ pack. With 1C continuous and 3C peak discharge, it powers high-performance electric motorcycles and three-wheelers with a Smart BMS featuring Bluetooth diagnostics.',
  'Rs. 78,000', '2 years', 'in',
  '[{"label":"Voltage","value":"72V"},{"label":"Capacity","value":"27Ah (2.0 KWh)"},{"label":"Discharge Rate","value":"1C continuous / 3C peak"},{"label":"Chemistry","value":"LiFePO₄"},{"label":"BMS","value":"Smart BMS (Bluetooth)"},{"label":"Warranty","value":"2 years"}]',
  true
),
(
  'EV Champ 60V', 'EV',
  '60.8V 27Ah ≈1.65 KWh | 19S1P | 1C/3C peak | Smart BMS with Bluetooth',
  'The EV Champ 60V is a 19S1P LiFePO₄ pack delivering 1.65 KWh at 60.8V. Designed for electric bikes and scooters, it features a Smart BMS with Bluetooth for real-time monitoring and diagnostics.',
  'Rs. 67,000', '2 years', 'in',
  '[{"label":"Voltage","value":"60.8V"},{"label":"Capacity","value":"27Ah (≈1.65 KWh)"},{"label":"Configuration","value":"19S1P"},{"label":"Discharge Rate","value":"1C continuous / 3C peak"},{"label":"BMS","value":"Smart BMS (Bluetooth)"},{"label":"Warranty","value":"2 years"}]',
  true
);
