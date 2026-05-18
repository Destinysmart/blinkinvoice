
-- set_updated_at: lock search_path, restrict execute
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke execute on function public.set_updated_at() from public, anon, authenticated;

-- handle_new_user: revoke from anon/authenticated (trigger still works as SECURITY DEFINER owner)
revoke execute on function public.handle_new_user() from public, anon, authenticated;
