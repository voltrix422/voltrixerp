-- Step 1: Run this first and check for errors
create table website_products (
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

create table website_product_images (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid references website_products(id) on delete cascade,
  url         text not null,
  position    int default 0,
  created_at  timestamptz default now()
);

-- Step 2: Disable RLS entirely for simplicity
alter table website_products disable row level security;
alter table website_product_images disable row level security;

-- Step 3: Insert one test product
insert into website_products (name, category, price, stock, published)
values ('WL-5', 'Residential', 'Rs. 210,000', 'low', true);
