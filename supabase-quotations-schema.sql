create table if not exists public.quotations (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  product_type text,
  voltage text,
  capacity text,
  quantity integer,
  budget text,
  application text,
  specifications text,
  timeline text,
  full_name text not null,
  company text,
  email text not null,
  phone text not null,
  status text default 'new' check (status in ('new','in_review','quoted','closed'))
);

alter table public.quotations enable row level security;

-- Allow anonymous inserts (from the public website form)
create policy "Allow public insert" on public.quotations
  for insert to anon with check (true);

-- Allow authenticated users to read all
create policy "Allow auth read" on public.quotations
  for select to authenticated using (true);

-- Allow authenticated users to update status
create policy "Allow auth update" on public.quotations
  for update to authenticated using (true);
