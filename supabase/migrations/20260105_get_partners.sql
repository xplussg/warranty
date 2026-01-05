create or replace function get_partners()
returns table (
  id uuid,
  email varchar,
  username text,
  role text,
  created_at timestamptz
)
security definer
as $$
begin
  -- Check if the user is an owner or admin (or service role)
  if auth.role() = 'service_role' or exists (
    select 1 from auth.users 
    where id = auth.uid() 
    and (raw_user_meta_data->>'role')::text in ('owner', 'admin')
  ) then
    return query
    select 
      au.id, 
      au.email::varchar, 
      (au.raw_user_meta_data->>'username')::text as username,
      (au.raw_user_meta_data->>'role')::text as role,
      au.created_at
    from auth.users au
    where (au.raw_user_meta_data->>'role')::text = 'partner'
    order by au.created_at desc;
  else
    raise exception 'Access denied';
  end if;
end;
$$ language plpgsql;
