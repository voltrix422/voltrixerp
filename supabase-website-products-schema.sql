-- Run this in your Supabase SQL editor

-- Products table
create table if not exists website_products (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz default now(),
  name         text not null,
  category     text not null,
  description  text,
  full_desc    text,
  price        text,
  warranty     text,
  stock        text default 'in' check (stock in ('in', 'low', 'out')),
  specs        jsonb default '[]',
  published    boolean default false
);

-- Product images table (multiple per product)
create table if not exists website_product_images (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid references website_products(id) on delete cascade,
  url         text not null,
  position    int default 0,
  created_at  timestamptz default now()
);

-- Storage bucket for product images
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict do nothing;

-- Allow public read
create policy "Public read product images"
  on storage.objects for select
  using (bucket_id = 'product-images');

-- Allow authenticated upload
create policy "Auth upload product images"
  on storage.objects for insert
  with check (bucket_id = 'product-images');

-- Allow authenticated delete
create policy "Auth delete product images"
  on storage.objects for delete
  using (bucket_id = 'product-images');
