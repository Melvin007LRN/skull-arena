-- Étape 7 : résultats des parties, XP, statistiques, badges, historique et classement.

alter table public.profils
  add column if not exists regicides int not null default 0,      -- Skull King capturés avec une Sirène
  add column if not exists fantomes int not null default 0,       -- mises de 0 réussies à la manche 10
  add column if not exists badges text[] not null default '{}';   -- badges « d'un coup » obtenus (devin, legende)

-- Historique : une ligne par joueur humain et par partie comptée.
create table if not exists public.historique_parties (
  partie_id uuid not null references public.parties (id) on delete cascade,
  joueur_id uuid not null references public.profils (id) on delete cascade,
  rang int not null,
  nb_joueurs int not null,
  score int not null,
  xp_gagne int not null,
  victoire boolean not null,
  abandon boolean not null default false,
  mises_reussies int not null,
  adversaires text[] not null default '{}',
  joue_le timestamptz not null default now(),
  primary key (partie_id, joueur_id)
);
create index if not exists historique_joueur on public.historique_parties (joueur_id, joue_le desc);

alter table public.historique_parties enable row level security;
drop policy if exists "Historique visible par les joueurs connectés" on public.historique_parties;
create policy "Historique visible par les joueurs connectés" on public.historique_parties
  for select to authenticated using (true);
revoke all on public.historique_parties from anon;
revoke insert, update, delete, truncate on public.historique_parties from authenticated;
grant select on public.historique_parties to authenticated;

-- Enregistre les résultats d'une partie (appelée uniquement par l'arbitre). Une partie ne compte qu'une fois.
create or replace function public.enregistrer_resultats(p_partie uuid, p_resultats jsonb) returns void
  language plpgsql security definer set search_path = public as $$
declare
  r jsonb;
  nouveaux text[];
begin
  if auth.role() <> 'service_role' then raise exception 'Interdit.'; end if;
  for r in select * from jsonb_array_elements(p_resultats) loop
    if not exists (select 1 from profils where id = (r->>'joueur')::uuid) then continue; end if;
    insert into historique_parties (partie_id, joueur_id, rang, nb_joueurs, score, xp_gagne, victoire, abandon, mises_reussies, adversaires)
    values (p_partie, (r->>'joueur')::uuid, (r->>'rang')::int, (r->>'nb')::int, (r->>'score')::int, (r->>'xp')::int,
            (r->>'victoire')::boolean, (r->>'abandon')::boolean, (r->>'mises_reussies')::int,
            array(select jsonb_array_elements_text(coalesce(r->'adversaires', '[]'::jsonb))))
    on conflict do nothing;
    if not found then continue; end if; -- déjà comptée
    nouveaux := array(select jsonb_array_elements_text(coalesce(r->'badges', '[]'::jsonb)));
    update profils set
      xp = xp + (r->>'xp')::int,
      parties_jouees = parties_jouees + 1,
      victoires = victoires + case when (r->>'victoire')::boolean then 1 else 0 end,
      meilleur_score = greatest(coalesce(meilleur_score, (r->>'score')::int), (r->>'score')::int),
      points_total = points_total + (r->>'score')::int,
      mises_reussies = mises_reussies + (r->>'mises_reussies')::int,
      mises_total = mises_total + (r->>'mises_total')::int,
      regicides = regicides + (r->>'regicides')::int,
      fantomes = fantomes + (r->>'fantomes')::int,
      badges = array(select distinct unnest(badges || nouveaux))
    where id = (r->>'joueur')::uuid;
  end loop;
end $$;
revoke execute on function public.enregistrer_resultats(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.enregistrer_resultats(uuid, jsonb) to service_role;
