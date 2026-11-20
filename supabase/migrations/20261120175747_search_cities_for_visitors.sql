-- Visitors can really search the city list.
--
-- 20261119030000_onboarding_before_sign_up granted search_cities to anon, because the onboarding now
-- asks for the city before the account exists. But the function still started with
-- require_user_uid(), so every search from a visitor failed with not_signed_in and the onboarding's
-- city step could not be completed. (Its pgTAP test passed only because it kept the signed-in user's
-- claims after switching to the anon role; the test now clears them.)
--
-- The list is public GeoNames data (CC BY 4.0) and this function only reads it, so it needs no
-- signed-in user. Everything else is unchanged: same signature, same search rules, same limits.
-- `create or replace` keeps the existing grants (authenticated and anon).

create or replace function public.search_cities(query text, max_rows int default 20)
returns table (id bigint, name text, region text, country_code text, country text, population int)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  q text := btrim(regexp_replace(lower(extensions.unaccent(coalesce(query, ''))), '[.,]', '', 'g'));
  q_saint text;
begin
  if char_length(q) < 2 then
    return;
  end if;
  q := replace(replace(replace(q, '\', '\\'), '%', '\%'), '_', '\_');
  q_saint := regexp_replace(q, '^(st|ste) ', 'saint ');
  return query
    select c.id, c.name, c.region, c.country_code, c.country, c.population
    from public.cities c
    where c.search_name like q || '%' or c.search_name like q_saint || '%'
    order by c.population desc, c.id
    limit least(greatest(coalesce(max_rows, 20), 1), 50);
end;
$$;
