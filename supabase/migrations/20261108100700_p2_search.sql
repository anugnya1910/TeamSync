-- Phase 2 · M7 workspace search (spec §B.16). SECURITY INVOKER so RLS applies to every row returned.
-- tasks.search_vector + GIN index were created in p2_tasks.

create or replace function public.search_workspace(p_workspace uuid, p_query text, p_limit int default 20)
returns table (kind text, id uuid, title text, subtitle text, url text, rank real)
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
declare
  v_q text := btrim(coalesce(p_query, ''));
  v_limit int := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_slug text;
  v_key text;
  v_num int;
  v_ts tsquery;
  v_like text;
begin
  if char_length(v_q) < 1 or char_length(v_q) > 200 then
    return;
  end if;
  select w.slug::text into v_slug from public.workspaces w where w.id = p_workspace;  -- RLS: members only
  if v_slug is null then
    return;
  end if;
  v_like := '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%';

  -- Exact task key, e.g. TS-42
  if v_q ~* '^[a-z]{2,5}-\d{1,9}$' then
    v_key := upper(split_part(v_q, '-', 1));
    v_num := split_part(v_q, '-', 2)::int;
    return query
      select 'task'::text, t.id, t.title, pr.key || '-' || t.number || ' · ' || pr.name,
             '/w/' || v_slug || '/t/' || pr.key || '-' || t.number, 10::real
        from public.tasks t join public.projects pr on pr.id = t.project_id
       where t.workspace_id = p_workspace and pr.key = v_key and t.number = v_num;
  end if;

  begin
    v_ts := websearch_to_tsquery('simple', v_q);
  exception when others then
    v_ts := null;
  end;

  return query
  (
    select 'task'::text, t.id, t.title, pr.key || '-' || t.number || ' · ' || pr.name,
           '/w/' || v_slug || '/t/' || pr.key || '-' || t.number,
           (case when v_ts is not null then ts_rank(t.search_vector, v_ts) else 0 end
            + case when t.title ilike v_like then 0.5 else 0 end)::real
      from public.tasks t join public.projects pr on pr.id = t.project_id
     where t.workspace_id = p_workspace
       and pr.deleted_at is null
       and ((v_ts is not null and t.search_vector @@ v_ts) or t.title ilike v_like)
     order by 6 desc, t.updated_at desc
     limit v_limit
  )
  union all
  (
    select 'project'::text, pr.id, pr.name, pr.key || ' · ' || initcap(replace(pr.status::text, '_', ' ')),
           '/w/' || v_slug || '/p/' || pr.key, 1::real
      from public.projects pr
     where pr.workspace_id = p_workspace and (pr.name ilike v_like or pr.key ilike v_like)
     order by pr.name
     limit 8
  )
  union all
  (
    select 'member'::text, p.id, p.full_name, '@' || p.handle::text,
           '/w/' || v_slug || '/members', 0.5::real
      from public.workspace_members m join public.profiles p on p.id = m.user_id
     where m.workspace_id = p_workspace and (p.full_name ilike v_like or p.handle::text ilike v_like)
     order by p.full_name
     limit 8
  );
end;
$$;

revoke all on function public.search_workspace(uuid, text, int) from public, anon;
grant execute on function public.search_workspace(uuid, text, int) to authenticated;
