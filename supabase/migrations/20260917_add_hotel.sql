-- ============================================================
-- Hotel: habitaciones y reservaciones
-- ============================================================

create table if not exists hotel_rooms (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  branch_id uuid not null references branches(id),
  giro_id uuid references giros(id),
  name text not null,
  status text not null default 'available'
    check (status in ('available', 'occupied', 'cleaning')),
  created_at timestamptz not null default now()
);

create table if not exists reservations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  branch_id uuid not null references branches(id),
  giro_id uuid not null references giros(id),
  room_id uuid not null references hotel_rooms(id),
  room_product_id uuid not null references products(id),
  guest_name text not null,
  guest_phone text,
  check_in_date date not null,
  check_out_date date not null,
  status text not null default 'reservada'
    check (status in ('reservada','check_in','check_out','cancelada')),
  sale_id uuid references sales(id),
  created_at timestamptz not null default now()
);

alter table hotel_rooms enable row level security;
alter table reservations enable row level security;

drop policy if exists "org_isolation_hotel_rooms" on hotel_rooms;
create policy "org_isolation_hotel_rooms" on hotel_rooms
  for all using (organization_id = current_org_id());

drop policy if exists "org_isolation_reservations" on reservations;
create policy "org_isolation_reservations" on reservations
  for all using (organization_id = current_org_id());