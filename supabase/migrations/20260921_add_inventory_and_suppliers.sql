-- ============================================================
-- Inventario y compras a proveedores
--   - products.reorder_point: umbral de stock mínimo por producto
--   - suppliers: proveedores de la organización
--   - purchase_orders / purchase_order_items: órdenes de compra
--     (registro interno — no hay integración automática con el
--     proveedor todavía; el negocio le avisa por su cuenta, tal
--     como se acordó con el cliente)
-- ============================================================

alter table products
  add column if not exists reorder_point integer;

comment on column products.reorder_point is
  'Nivel de stock en el que se considera que el producto necesita reabastecerse. NULL = sin alerta configurada.';

create table if not exists suppliers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  contact_name text,
  phone text,
  email text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists purchase_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  supplier_id uuid not null references suppliers(id),
  status text not null default 'ordered'
    check (status in ('ordered', 'received', 'canceled')),
  created_by uuid references app_users(id),
  notes text,
  created_at timestamptz not null default now(),
  received_at timestamptz
);

create table if not exists purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references purchase_orders(id) on delete cascade,
  product_id uuid not null references products(id),
  quantity numeric not null,
  unit_cost numeric not null default 0
);

alter table suppliers enable row level security;
alter table purchase_orders enable row level security;
alter table purchase_order_items enable row level security;

drop policy if exists "org_isolation_suppliers" on suppliers;
create policy "org_isolation_suppliers" on suppliers
  for all using (organization_id = current_org_id());

drop policy if exists "org_isolation_purchase_orders" on purchase_orders;
create policy "org_isolation_purchase_orders" on purchase_orders
  for all using (organization_id = current_org_id());

-- purchase_order_items no tiene organization_id propio; se aísla a
-- través de la orden de compra a la que pertenece (mismo patrón que
-- table_order_items en la Fase 5).
drop policy if exists "org_isolation_purchase_order_items" on purchase_order_items;
create policy "org_isolation_purchase_order_items" on purchase_order_items
  for all using (
    purchase_order_id in (
      select id from purchase_orders where organization_id = current_org_id()
    )
  );
