-- Add missing columns to existing products table
alter table products add column if not exists full_desc text default '';
alter table products add column if not exists warranty text default '';
alter table products add column if not exists specs jsonb default '[]';
alter table products add column if not exists published boolean default false;

-- Disable RLS
alter table products disable row level security;
