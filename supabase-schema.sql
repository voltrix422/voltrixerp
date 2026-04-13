-- ── Users ────────────────────────────────────────────────────────
create table if not exists erp_users (
  id text primary key,
  name text not null,
  email text not null unique,
  password text not null,
  role text not null default 'user',
  modules text[] not null default '{}'
);

-- ── Suppliers ────────────────────────────────────────────────────
create table if not exists erp_suppliers (
  id text primary key,
  name text not null,
  type text not null default 'local',
  contact text not null default '',
  email text not null default '',
  address text not null default '',
  company text not null default ''
);

-- ── Purchase Orders ──────────────────────────────────────────────
create table if not exists erp_purchase_orders (
  id text primary key,
  po_number text not null,
  type text not null default 'local',
  supplier_ids text[] not null default '{}',
  supplier_names text[] not null default '{}',
  items jsonb not null default '[]',
  notes text not null default '',
  status text not null default 'draft',
  created_by text not null default '',
  created_at timestamptz not null default now(),
  admin_note text not null default '',
  sent_to_supplier boolean not null default false,
  delivery_date text not null default '',
  receiving_location text not null default '',
  suppliers_sent jsonb not null default '[]',
  quotes jsonb not null default '[]'
);

-- Disable RLS for now (internal ERP, no public access)
alter table erp_users disable row level security;
alter table erp_suppliers disable row level security;
alter table erp_purchase_orders disable row level security;

-- Enable realtime
alter publication supabase_realtime add table erp_suppliers;
alter publication supabase_realtime add table erp_purchase_orders;

-- Seed default users
insert into erp_users (id, name, email, password, role, modules) values
  ('1', 'Super Admin',       'admin@voltrix.com',     'admin123',     'superadmin', array['dashboard','purchase','finance','crm','inventory','website','docs']),
  ('2', 'Purchase Manager',  'purchase@voltrix.com',  'purchase123',  'user',       array['purchase']),
  ('3', 'Finance Manager',   'finance@voltrix.com',   'finance123',   'user',       array['finance']),
  ('4', 'CRM Manager',       'crm@voltrix.com',       'crm123',       'user',       array['crm']),
  ('5', 'Inventory Manager', 'inventory@voltrix.com', 'inventory123', 'user',       array['inventory'])
on conflict (id) do nothing;
