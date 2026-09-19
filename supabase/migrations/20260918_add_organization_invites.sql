-- ============================================================
-- Invitaciones de equipo: unirse a una organización existente
-- con un rol asignado, en vez de crear una organización nueva
-- ============================================================

create table if not exists organization_invites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  email text not null,
  role text not null check (role in ('owner','admin','manager','cashier')),
  invited_by uuid references app_users(id),
  status text not null default 'pending'
    check (status in ('pending','accepted','cancelled')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);

-- Evita invitaciones pendientes duplicadas al mismo correo dentro de la misma org
create unique index if not exists organization_invites_org_email_pending_idx
  on organization_invites (organization_id, lower(email))
  where status = 'pending';

alter table organization_invites enable row level security;

drop policy if exists "org_isolation_organization_invites" on organization_invites;
create policy "org_isolation_organization_invites" on organization_invites
  for all using (organization_id = current_org_id());

-- ============================================================
-- Trigger handle_new_user: ahora revisa primero si el correo
-- que se está registrando tiene una invitación pendiente.
--   - Si la tiene: se une a ESA organización con el rol invitado
--     (no crea organización ni sucursal nueva) y marca la
--     invitación como aceptada.
--   - Si no la tiene: comportamiento original sin cambios
--     (crea su propia organización como owner).
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  new_org_id uuid;
  matched_invite organization_invites%rowtype;
begin
  select * into matched_invite
  from organization_invites
  where lower(email) = lower(new.email)
    and status = 'pending'
  order by created_at asc
  limit 1;

  if matched_invite.id is not null then
    insert into app_users (id, organization_id, full_name, email, role)
    values (
      new.id,
      matched_invite.organization_id,
      new.raw_user_meta_data->>'full_name',
      new.email,
      matched_invite.role
    );

    update organization_invites
    set status = 'accepted', accepted_at = now()
    where id = matched_invite.id;
  else
    insert into organizations (name, status)
    values (coalesce(new.raw_user_meta_data->>'full_name', new.email), 'active')
    returning id into new_org_id;

    insert into branches (organization_id, name, is_main)
    values (new_org_id, 'Sucursal Principal', true);

    insert into app_users (id, organization_id, full_name, email, role)
    values (new.id, new_org_id, new.raw_user_meta_data->>'full_name', new.email, 'owner');
  end if;

  return new;
end;
$function$;
