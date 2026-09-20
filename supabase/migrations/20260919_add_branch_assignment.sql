-- ============================================================
-- Multi-sucursal: las invitaciones ahora pueden asignar sucursal,
-- y el trigger de alta de usuario respeta esa asignación.
-- ============================================================

alter table organization_invites
  add column if not exists branch_id uuid references branches(id);

-- Reemplazo completo de la función (no solo un ALTER) para que quede
-- documentada de una pieza en esta misma migración, igual que en la Fase 6.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  new_org_id uuid;
  new_branch_id uuid;
  matched_invite organization_invites%rowtype;
begin
  select * into matched_invite
  from organization_invites
  where lower(email) = lower(new.email)
    and status = 'pending'
  order by created_at asc
  limit 1;

  if matched_invite.id is not null then
    -- Si la invitación no especificó sucursal, usar la principal de esa organización
    select coalesce(matched_invite.branch_id, id) into new_branch_id
    from branches
    where organization_id = matched_invite.organization_id
      and (id = matched_invite.branch_id or is_main = true)
    order by (id = matched_invite.branch_id) desc
    limit 1;

    insert into app_users (id, organization_id, branch_id, full_name, email, role)
    values (
      new.id,
      matched_invite.organization_id,
      new_branch_id,
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
    values (new_org_id, 'Sucursal Principal', true)
    returning id into new_branch_id;

    insert into app_users (id, organization_id, branch_id, full_name, email, role)
    values (new.id, new_org_id, new_branch_id, new.raw_user_meta_data->>'full_name', new.email, 'owner');
  end if;

  return new;
end;
$function$;