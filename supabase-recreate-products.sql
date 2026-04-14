-- Drop and recreate products table to force PostgREST schema refresh
drop table if exists products cascade;

create table products (
  id          text primary key default gen_random_uuid()::text,
  created_at  timestamptz default now(),
  created_by  text default 'admin',
  name        text not null default '',
  category    text default 'Residential',
  description text default '',
  full_desc   text default '',
  specification text default '',
  price       text default '',
  warranty    text default '',
  stock       text default 'in',
  unit        text default 'pcs',
  specs       jsonb default '[]',
  images      text[] default '{}',
  published   boolean default false
);

alter table products disable row level security;

-- Grant access to anon and authenticated roles
grant all on products to anon;
grant all on products to authenticated;
grant all on products to service_role;

notify pgrst, 'reload schema';
