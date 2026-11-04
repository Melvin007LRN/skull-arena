-- Louidors, boutique (objets consommables et cadres), objets lancés en partie, défis du jour, saisons, face-à-face.

alter table public.profils
  add column if not exists louidors int not null default 0 check (louidors >= 0),
  add column if not exists cadre text;
alter table public.salon_joueurs add column if not exists cadre text;
alter table public.historique_parties add column if not exists louidors_gagnes int not null default 0;

-- Catalogue de la boutique.
create table if not exists public.boutique (
  id text primary key,
  type text not null check (type in ('objet', 'cadre')),
  nom text not null,
  icone text not null default '',
  prix int not null check (prix > 0),
  ordre int not null default 0,
  actif boolean not null default true
);
alter table public.boutique enable row level security;
create policy "Boutique visible" on public.boutique for select to authenticated using (true);
grant select on public.boutique to authenticated;

insert into public.boutique (id, type, nom, icone, prix, ordre) values
  ('mouchoirs', 'objet', 'Boîte de mouchoirs', '🧻', 5, 1),
  ('drapeau_blanc', 'objet', 'Drapeau blanc', '🏳️', 5, 2),
  ('tomate', 'objet', 'Tomate pourrie', '🍅', 5, 3),
  ('poisson', 'objet', 'Poisson pourri', '🐟', 5, 4),
  ('rhum', 'objet', 'Chope de rhum', '🍺', 5, 5),
  ('rose', 'objet', 'Rose', '🌹', 5, 6),
  ('perroquet', 'objet', 'Perroquet moqueur', '🦜', 8, 7),
  ('doigt', 'objet', 'Doigt d’honneur', '🖕', 8, 8),
  ('boulet', 'objet', 'Boulet de canon', '💣', 10, 9),
  ('couronne', 'objet', 'Couronne en carton', '👑', 10, 10),
  ('rubis', 'cadre', 'Cadre Rubis', '', 150, 101),
  ('emeraude', 'cadre', 'Cadre Émeraude', '', 150, 102),
  ('saphir', 'cadre', 'Cadre Saphir', '', 150, 103),
  ('corail', 'cadre', 'Cadre Corail', '', 200, 104),
  ('obsidienne', 'cadre', 'Cadre Obsidienne', '', 250, 105),
  ('flamme', 'cadre', 'Cadre de Feu', '', 400, 106),
  ('abysses', 'cadre', 'Cadre des Abysses', '', 500, 107),
  ('tresor', 'cadre', 'Cadre du Trésor maudit', '', 800, 108)
on conflict (id) do nothing;

create table if not exists public.inventaire (
  joueur uuid not null references public.profils (id) on delete cascade,
  objet text not null references public.boutique (id),
  quantite int not null default 0 check (quantite >= 0),
  primary key (joueur, objet)
);
alter table public.inventaire enable row level security;
create policy "Mon inventaire" on public.inventaire for select to authenticated using (joueur = auth.uid());
grant select on public.inventaire to authenticated;

create table if not exists public.cadres_possedes (
  joueur uuid not null references public.profils (id) on delete cascade,
  cadre text not null references public.boutique (id),
  achete_le timestamptz not null default now(),
  primary key (joueur, cadre)
);
alter table public.cadres_possedes enable row level security;
create policy "Mes cadres" on public.cadres_possedes for select to authenticated using (joueur = auth.uid());
grant select on public.cadres_possedes to authenticated;

-- Objets lancés en partie (visibles par les joueurs de la partie, en temps réel).
create table if not exists public.lancers (
  id bigint generated always as identity primary key,
  partie_id uuid not null references public.parties (id) on delete cascade,
  de uuid not null references public.profils (id) on delete cascade,
  a uuid not null,
  objet text not null,
  cree_le timestamptz not null default now()
);
create index if not exists lancers_partie on public.lancers (partie_id, cree_le desc);
alter table public.lancers enable row level security;
create policy "Lancers de ma partie" on public.lancers for select to authenticated
  using (exists (select 1 from public.mains m where m.partie_id = lancers.partie_id and m.joueur_id = auth.uid()));
grant select on public.lancers to authenticated;
alter publication supabase_realtime add table public.lancers;

-- Défis du jour réussis.
create table if not exists public.defis_reussis (
  joueur uuid not null references public.profils (id) on delete cascade,
  jour date not null,
  defi text not null,
  primary key (joueur, jour, defi)
);
alter table public.defis_reussis enable row level security;
create policy "Mes défis" on public.defis_reussis for select to authenticated using (joueur = auth.uid());
grant select on public.defis_reussis to authenticated;

-- 3 défis par jour (heure de Paris), les mêmes pour tout le monde.
create or replace function public.jour_paris() returns date language sql stable as $$ select (now() at time zone 'Europe/Paris')::date $$;
create or replace function public.defis_du_jour(j date default null) returns text[]
  language sql stable as $$
  select array(select d from unnest(array['mise_zero','mise_haute','six_mises','victoire','podium','quatorze_noir','regicide','chasseur','bonus_50','deux_cents']) d
               order by md5(coalesce(j, public.jour_paris())::text || d) limit 3)
$$;
grant execute on function public.defis_du_jour(date), public.jour_paris() to authenticated;

-- Cadres gagnés (grades et badges) : jamais achetés, toujours disponibles.
create or replace function public.cadres_gagnes(p public.profils) returns text[]
  language sql stable as $$
  select array_remove(array[
    'or',
    case when public.niveau_de(p.xp) >= 10 then 'bronze' end,
    case when public.niveau_de(p.xp) >= 25 then 'argent' end,
    case when public.niveau_de(p.xp) >= 50 then 'capitaine' end,
    case when public.niveau_de(p.xp) >= 100 then 'amiral' end,
    case when public.niveau_de(p.xp) >= 200 then 'legende' end,
    case when p.victoires >= 100 then 'centurion' end,
    case when 'devin' = any(p.badges) then 'devin' end,
    case when p.regicides >= 25 then 'regicide' end,
    case when p.fantomes >= 10 then 'fantome' end,
    case when 'legende' = any(p.badges) then 'legende_mers' end
  ], null)
$$;

create or replace function public.acheter(article text, nombre int default 1) returns int
  language plpgsql security definer set search_path = public as $$
declare
  b boutique;
  cout int;
  solde int;
begin
  if auth.uid() is null then raise exception 'Non connecté.'; end if;
  select * into b from boutique where id = article and actif;
  if b.id is null then raise exception 'Cet article n’existe pas.'; end if;
  if b.type = 'cadre' then
    if exists (select 1 from cadres_possedes where joueur = auth.uid() and cadre = article) then raise exception 'Tu possèdes déjà ce cadre.'; end if;
    cout := b.prix;
  else
    if nombre not in (1, 5) then raise exception 'Quantité invalide.'; end if;
    cout := case when nombre = 5 then b.prix * 4 else b.prix end; -- le lot de 5 : une offerte
  end if;
  update profils set louidors = louidors - cout where id = auth.uid() and louidors >= cout returning louidors into solde;
  if solde is null then raise exception 'Pas assez de Louidors.'; end if;
  if b.type = 'cadre' then
    insert into cadres_possedes (joueur, cadre) values (auth.uid(), article);
  else
    insert into inventaire (joueur, objet, quantite) values (auth.uid(), article, nombre)
      on conflict (joueur, objet) do update set quantite = inventaire.quantite + excluded.quantite;
  end if;
  return solde;
end $$;

create or replace function public.equiper_cadre(choix text) returns void
  language plpgsql security definer set search_path = public as $$
declare p profils;
begin
  select * into p from profils where id = auth.uid();
  if p.id is null then raise exception 'Non connecté.'; end if;
  if choix is not null and not (choix = any(cadres_gagnes(p)))
     and not exists (select 1 from cadres_possedes where joueur = p.id and cadre = choix) then
    raise exception 'Tu ne possèdes pas ce cadre.';
  end if;
  update profils set cadre = nullif(choix, 'or') where id = p.id;
  update salon_joueurs set cadre = nullif(choix, 'or') where joueur_id = p.id;
end $$;

-- Lancer un objet sur un joueur de la partie en cours (consomme l'objet).
create or replace function public.utiliser_objet(article text, partie uuid, cible uuid) returns int
  language plpgsql security definer set search_path = public as $$
declare
  v jsonb;
  reste int;
begin
  select vue into v from parties where id = partie and not termine;
  if v is null then raise exception 'La partie est terminée.'; end if;
  if not (v->'joueurs' ? auth.uid()::text) or not (v->'joueurs' ? cible::text) or cible = auth.uid() then
    raise exception 'Cible invalide.';
  end if;
  if exists (select 1 from lancers where partie_id = partie and de = auth.uid() and cree_le > now() - interval '3 seconds') then
    raise exception 'Doucement, moussaillon ! Attends un peu.';
  end if;
  update inventaire set quantite = quantite - 1 where joueur = auth.uid() and inventaire.objet = article and quantite > 0
    returning quantite into reste;
  if reste is null then raise exception 'Tu n’as plus cet objet. Passe à la boutique !'; end if;
  insert into lancers (partie_id, de, a, objet) values (partie, auth.uid(), cible, article);
  return reste;
end $$;

-- Classement de la saison (mois en cours, heure de Paris) : au moins 3 parties.
create or replace function public.classement_saison() returns table (
  id uuid, pseudo text, photo_url text, cadre text, xp int, parties int, victoires int, pm int
) language sql stable security definer set search_path = public as $$
  select p.id, p.pseudo, p.photo_url, p.cadre, p.xp, count(*)::int, count(*) filter (where h.victoire)::int, round(avg(h.score))::int
  from historique_parties h join profils p on p.id = h.joueur_id
  where not p.banni and (h.joue_le at time zone 'Europe/Paris') >= date_trunc('month', now() at time zone 'Europe/Paris')
  group by p.id
  having count(*) >= 3
  order by 8 desc, 7 desc, p.xp desc
  limit 200
$$;
grant execute on function public.classement_saison() to authenticated;

-- Bilan entre moi et d'autres joueurs (parties comptées jouées ensemble).
create or replace function public.bilan_face_a_face(autres uuid[]) returns table (adversaire uuid, mes_victoires int, ses_victoires int, parties int)
  language sql stable security definer set search_path = public as $$
  select o.joueur_id, count(*) filter (where m.rang < o.rang)::int, count(*) filter (where o.rang < m.rang)::int, count(*)::int
  from historique_parties m join historique_parties o on o.partie_id = m.partie_id and o.joueur_id <> m.joueur_id
  where m.joueur_id = auth.uid() and o.joueur_id = any(autres)
  group by o.joueur_id
$$;
grant execute on function public.bilan_face_a_face(uuid[]) to authenticated;

-- Résultats de partie : XP, Louidors, statistiques, badges et défis du jour.
create or replace function public.enregistrer_resultats(p_partie uuid, p_resultats jsonb) returns void
  language plpgsql security definer set search_path = public as $$
declare
  r jsonb;
  nouveaux text[];
  jour date := public.jour_paris();
  du_jour text[] := public.defis_du_jour(jour);
  d text;
  bonus_xp int;
  bonus_or int;
begin
  if auth.role() <> 'service_role' then raise exception 'Interdit.'; end if;
  for r in select * from jsonb_array_elements(p_resultats) loop
    if not exists (select 1 from profils where id = (r->>'joueur')::uuid) then continue; end if;
    insert into historique_parties (partie_id, joueur_id, rang, nb_joueurs, score, xp_gagne, victoire, abandon, mises_reussies, adversaires, louidors_gagnes)
    values (p_partie, (r->>'joueur')::uuid, (r->>'rang')::int, (r->>'nb')::int, (r->>'score')::int, (r->>'xp')::int,
            (r->>'victoire')::boolean, (r->>'abandon')::boolean, (r->>'mises_reussies')::int,
            array(select jsonb_array_elements_text(coalesce(r->'adversaires', '[]'::jsonb))), coalesce((r->>'louidors')::int, 0))
    on conflict do nothing;
    if not found then continue; end if; -- déjà comptée

    -- Défis du jour : 20 XP et 15 Louidors chacun, une seule fois par jour.
    bonus_xp := 0; bonus_or := 0;
    for d in select jsonb_array_elements_text(coalesce(r->'defis', '[]'::jsonb)) loop
      if d = any(du_jour) then
        insert into defis_reussis (joueur, jour, defi) values ((r->>'joueur')::uuid, jour, d) on conflict do nothing;
        if found then bonus_xp := bonus_xp + 20; bonus_or := bonus_or + 15; end if;
      end if;
    end loop;
    if bonus_xp > 0 then
      update historique_parties set xp_gagne = xp_gagne + bonus_xp, louidors_gagnes = louidors_gagnes + bonus_or
        where partie_id = p_partie and joueur_id = (r->>'joueur')::uuid;
    end if;

    nouveaux := array(select jsonb_array_elements_text(coalesce(r->'badges', '[]'::jsonb)));
    update profils set
      xp = xp + (r->>'xp')::int + bonus_xp,
      louidors = louidors + coalesce((r->>'louidors')::int, 0) + bonus_or,
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

-- L'admin a accès à tous les cadres à gagner.
create or replace function public.cadres_gagnes(p public.profils) returns text[]
  language sql stable as $$
  select case when p.est_admin then
    array['or','bronze','argent','capitaine','amiral','legende','centurion','devin','regicide','fantome','legende_mers']
  else array_remove(array[
    'or',
    case when public.niveau_de(p.xp) >= 10 then 'bronze' end,
    case when public.niveau_de(p.xp) >= 25 then 'argent' end,
    case when public.niveau_de(p.xp) >= 50 then 'capitaine' end,
    case when public.niveau_de(p.xp) >= 100 then 'amiral' end,
    case when public.niveau_de(p.xp) >= 200 then 'legende' end,
    case when p.victoires >= 100 then 'centurion' end,
    case when 'devin' = any(p.badges) then 'devin' end,
    case when p.regicides >= 25 then 'regicide' end,
    case when p.fantomes >= 10 then 'fantome' end,
    case when 'legende' = any(p.badges) then 'legende_mers' end
  ], null) end
$$;
