-- Run this in Supabase SQL editor

create table if not exists erp_website_products (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz default now(),
  name         text not null,
  category     text not null default 'Residential',
  description  text default '',
  full_desc    text default '',
  price        text default '',
  warranty     text default '',
  stock        text default 'in',
  specs        jsonb default '[]',
  published    boolean default false
);

create table if not exists erp_website_product_images (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid references erp_website_products(id) on delete cascade,
  url         text not null,
  position    int default 0,
  created_at  timestamptz default now()
);

alter table erp_website_products disable row level security;
alter table erp_website_product_images disable row level security;
