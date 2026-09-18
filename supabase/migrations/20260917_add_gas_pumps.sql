-- ============================================================
-- Gasolinera: bombas y registro de despacho
-- ============================================================

create table if not exists gas_pumps (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  branch_id uuid not null references branches(id),
  giro_id uuid references giros(id),
  name text not null,
  created_at timestamptz not null default now()
);

alter table sales add column if not exists pump_id uuid references gas_pumps(id);

alter table gas_pumps enable row level security;

drop policy if exists "org_isolation_gas_pumps" on gas_pumps;
create policy "org_isolation_gas_pumps" on gas_pumps
  for all using (organization_id = current_org_id());