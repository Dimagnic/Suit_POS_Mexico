-- ============================================================
-- Agenda de citas: servicios, clínica_general, spa
-- ============================================================

-- Marca qué productos son "agendables" con duración fija
alter table products add column if not exists duration_minutes integer;

create table if not exists appointments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  branch_id uuid not null references branches(id),
  giro_id uuid not null references giros(id),
  service_product_id uuid not null references products(id),
  customer_name text not null,
  customer_phone text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  status text not null default 'pendiente'
    check (status in ('pendiente','confirmada','en_curso','completada','cancelada','no_asistio')),
  sale_id uuid references sales(id),
  created_at timestamptz not null default now()
);

alter table appointments enable row level security;

create policy if not exists "org_isolation_appointments" on appointments
  for all using (organization_id = current_org_id());