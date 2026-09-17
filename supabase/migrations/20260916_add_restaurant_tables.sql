-- ============================================================
-- Mesas y comandas: restaurante, bar
-- ============================================================

create table if not exists restaurant_tables (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  branch_id uuid not null references branches(id),
  giro_id uuid references giros(id),
  name text not null,
  status text not null default 'available' check (status in ('available', 'occupied')),
  created_at timestamptz not null default now()
);

create table if not exists table_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  table_id uuid not null references restaurant_tables(id) on delete cascade,
  waiter_id uuid references app_users(id),
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

create table if not exists table_order_items (
  id uuid primary key default gen_random_uuid(),
  table_order_id uuid not null references table_orders(id) on delete cascade,
  product_id uuid not null references products(id),
  quantity numeric(12,3) not null default 1,
  unit_price numeric(12,2) not null,
  created_at timestamptz not null default now()
);

alter table restaurant_tables enable row level security;
alter table table_orders enable row level security;
alter table table_order_items enable row level security;

create policy if not exists "org_isolation_restaurant_tables" on restaurant_tables
  for all using (organization_id = current_org_id());

create policy if not exists "org_isolation_table_orders" on table_orders
  for all using (organization_id = current_org_id());

create policy if not exists "org_isolation_table_order_items" on table_order_items
  for all using (
    table_order_id in (
      select id from table_orders where organization_id = current_org_id()
    )
  );