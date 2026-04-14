-- Run this in Supabase SQL editor to fix RLS blocking reads

-- Enable RLS but allow all operations for now (admin ERP use)
alter table website_products enable row level security;
alter table website_product_images enable row level security;

-- Allow all operations (anon + authenticated)
create policy "Allow all on website_products"
  on website_products for all
  using (true)
  with check (true);

create policy "Allow all on website_product_images"
  on website_product_images for all
  using (true)
  with check (true);
