-- push_tokens.token is UNIQUE, but its UPDATE policy only lets a user modify their own rows. When a
-- device signs out of account A and into account B, B's upsert on the same token hits A's row, fails
-- RLS, and B never gets a token row (the client only console.warns). This function re-homes a token
-- to the calling user, which is the intended behaviour: a token identifies a device, and the device
-- is now signed in as the caller.
create or replace function public.register_push_token(p_token text, p_platform text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_platform not in ('ios', 'android') then
    raise exception 'invalid platform' using errcode = '22023';
  end if;
  if p_token is null or length(p_token) = 0 then
    raise exception 'token is required' using errcode = '22023';
  end if;

  insert into public.push_tokens (user_id, token, platform, last_seen_at)
  values (v_uid, p_token, p_platform, now())
  on conflict (token) do update
    set user_id = excluded.user_id,
        platform = excluded.platform,
        last_seen_at = excluded.last_seen_at;
end;
$$;

revoke all on function public.register_push_token(text, text) from public, anon;
grant execute on function public.register_push_token(text, text) to authenticated;
