-- Personnalisations : dos de cartes, tapis, effets de pli, entrées, célébrations, titres, bannières,
-- compagnons, thème du site, packs de phrases et d'emotes, néons animés, cadeaux entre amis et coffres de niveau.

-- Nouveau type d'article permanent : 'perso' (rangé comme les cadres dans cadres_possedes).
alter table public.boutique drop constraint if exists boutique_type_check;
alter table public.boutique add constraint boutique_type_check check (type in ('objet', 'cadre', 'perso'));

-- Ce que chaque pirate a équipé : { "dos": "dos_or", "titre": "titre_roi", ... }
alter table public.profils add column if not exists perso jsonb not null default '{}'::jsonb;
alter table public.salon_joueurs add column if not exists perso jsonb not null default '{}'::jsonb;

insert into public.boutique (id, type, nom, icone, prix, ordre) values
  ('dos_bois', 'perso', 'Bois flotté', '⚓', 300, 300),
  ('dos_rubis', 'perso', 'Rubis sanglant', '☠', 500, 301),
  ('dos_parchemin', 'perso', 'Carte au trésor', '✖', 700, 302),
  ('dos_abysses', 'perso', 'Abysses', '🐚', 900, 303),
  ('dos_kraken', 'perso', 'Tentacules', '🐙', 1500, 304),
  ('dos_or', 'perso', 'Or massif', '👑', 2500, 305),
  ('dos_spectral', 'perso', 'Spectral', '💀', 4000, 306),
  ('tapis_velours', 'perso', 'Velours royal', '', 400, 307),
  ('tapis_lagon', 'perso', 'Lagon', '', 400, 308),
  ('tapis_pont', 'perso', 'Pont du navire', '', 800, 309),
  ('tapis_carte', 'perso', 'Carte au trésor', '', 900, 310),
  ('tapis_abysses', 'perso', 'Abysses lumineux', '', 1500, 311),
  ('tapis_tresor', 'perso', 'Salle du trésor', '', 2500, 312),
  ('pli_pieces', 'perso', 'Pluie de pièces', '🪙', 300, 313),
  ('pli_eclair', 'perso', 'Éclair', '⚡', 500, 314),
  ('pli_flammes', 'perso', 'Flammes', '🔥', 600, 315),
  ('pli_fumee', 'perso', 'Fumée spectrale', '👻', 800, 316),
  ('pli_cranes', 'perso', 'Crânes', '💀', 1200, 317),
  ('pli_etoiles', 'perso', 'Pluie d’étoiles', '⭐', 1500, 318),
  ('pli_kraken', 'perso', 'Tentacules', '🐙', 2500, 319),
  ('entree_canon', 'perso', 'Coup de canon', '💥', 300, 320),
  ('entree_brouillard', 'perso', 'Brouillard', '🌫️', 500, 321),
  ('entree_orage', 'perso', 'Orage', '⚡', 800, 322),
  ('entree_tresor', 'perso', 'Coffre au trésor', '💰', 1200, 323),
  ('entree_kraken', 'perso', 'Kraken', '🐙', 2000, 324),
  ('victoire_roses', 'perso', 'Pluie de roses', '🌹', 600, 325),
  ('victoire_artifice', 'perso', 'Feu d’artifice', '🎆', 800, 326),
  ('victoire_couronnes', 'perso', 'Pluie de couronnes', '👑', 1200, 327),
  ('victoire_fantome', 'perso', 'Armée fantôme', '👻', 1500, 328),
  ('victoire_kraken', 'perso', 'Kraken triomphant', '🐙', 2000, 329),
  ('titre_loup', 'perso', 'Loup de mer', '', 200, 330),
  ('titre_flibustier', 'perso', 'Flibustier', '', 300, 331),
  ('titre_corsaire', 'perso', 'Corsaire du roi', '', 500, 332),
  ('titre_canonnier', 'perso', 'Canonnier fou', '', 500, 333),
  ('titre_chasseur', 'perso', 'Chasseur de primes', '', 800, 334),
  ('titre_sirene', 'perso', 'Charmeur de sirènes', '', 1000, 335),
  ('titre_terreur', 'perso', 'Terreur des Sept Mers', '', 1500, 336),
  ('titre_roi', 'perso', 'Roi des pirates', '', 5000, 337),
  ('banniere_coucher', 'perso', 'Coucher de soleil', '', 300, 338),
  ('banniere_tempete', 'perso', 'Tempête', '', 600, 339),
  ('banniere_abysses', 'perso', 'Abysses', '', 800, 340),
  ('banniere_aurore', 'perso', 'Aurore boréale', '', 1500, 341),
  ('banniere_tresor', 'perso', 'Trésor maudit', '', 2500, 342),
  ('compagnon_crabe', 'perso', 'Crabe', '🦀', 300, 343),
  ('compagnon_rat', 'perso', 'Rat de cale', '🐀', 300, 344),
  ('compagnon_perroquet', 'perso', 'Perroquet', '🦜', 500, 345),
  ('compagnon_singe', 'perso', 'Singe', '🐒', 500, 346),
  ('compagnon_chat', 'perso', 'Chat noir', '🐈‍⬛', 700, 347),
  ('compagnon_pieuvre', 'perso', 'Pieuvre', '🐙', 1200, 348),
  ('compagnon_requin', 'perso', 'Requin', '🦈', 1800, 349),
  ('compagnon_dragon', 'perso', 'Dragon des mers', '🐉', 3500, 350),
  ('theme_rubis', 'perso', 'Rubis', '', 400, 351),
  ('theme_lagon', 'perso', 'Lagon', '', 400, 352),
  ('theme_emeraude', 'perso', 'Émeraude', '', 400, 353),
  ('theme_amethyste', 'perso', 'Améthyste', '', 400, 354),
  ('theme_or', 'perso', 'Doublon', '', 400, 355),
  ('theme_braise', 'perso', 'Braise', '', 400, 356),
  ('theme_corail', 'perso', 'Corail', '', 400, 357),
  ('phrase_fairplay', 'perso', 'Pack Fair-play', '', 200, 358),
  ('phrase_pirate', 'perso', 'Pack Pirate', '', 300, 359),
  ('phrase_moqueur', 'perso', 'Pack Moqueur', '', 300, 360),
  ('phrase_drame', 'perso', 'Pack Dramatique', '', 400, 361),
  ('emote_pirate', 'perso', 'Pack Pirate', '🏴‍☠️', 300, 362),
  ('emote_fete', 'perso', 'Pack Fête', '🎉', 300, 363),
  ('emote_mer', 'perso', 'Pack Océan', '🐙', 300, 364),
  ('emote_troll', 'perso', 'Pack Troll', '🤡', 400, 365)
,
  -- Pseudos animés (rangés avec les néons)
  ('neon_flamme', 'cadre', 'Pseudo de feu', '', 1200, 210),
  ('neon_spectre', 'cadre', 'Pseudo spectral', '', 1500, 211),
  ('neon_eclair', 'cadre', 'Pseudo électrique', '', 1800, 212),
  ('neon_maree', 'cadre', 'Pseudo marée', '', 2000, 213),
  ('neon_tresor', 'cadre', 'Or scintillant', '', 2500, 214)
on conflict (id) do update set nom = excluded.nom, icone = excluded.icone, prix = excluded.prix, ordre = excluded.ordre, type = excluded.type;

-- Articles à gagner (jamais vendus).
create or replace function public.perso_gagnes(p public.profils) returns text[]
  language sql stable as $$
  select case when p.est_admin then array[
    'dos_matelot','tapis_capitaine','pli_couronne','entree_roi','banniere_legende','compagnon_corbeau',
    'titre_premier_sang','titre_briscard','titre_veteran','titre_devin','titre_tueur_rois','titre_fantome','titre_centurion','titre_legende']
  else array_remove(array[
    case when public.niveau_de(p.xp) >= 10 then 'dos_matelot' end,
    case when public.niveau_de(p.xp) >= 25 then 'tapis_capitaine' end,
    case when p.victoires >= 25 then 'pli_couronne' end,
    case when p.victoires >= 50 then 'entree_roi' end,
    case when 'legende' = any(p.badges) then 'banniere_legende' end,
    case when p.parties_jouees >= 100 then 'compagnon_corbeau' end,
    case when p.victoires >= 1 then 'titre_premier_sang' end,
    case when public.niveau_de(p.xp) >= 15 then 'titre_briscard' end,
    case when p.parties_jouees >= 50 then 'titre_veteran' end,
    case when 'devin' = any(p.badges) then 'titre_devin' end,
    case when p.regicides >= 25 then 'titre_tueur_rois' end,
    case when p.fantomes >= 10 then 'titre_fantome' end,
    case when p.victoires >= 100 then 'titre_centurion' end,
    case when 'legende' = any(p.badges) then 'titre_legende' end
  ], null) end
$$;

-- Les articles permanents (cadres, néons, personnalisations) ne s'achètent qu'une fois.
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
  if b.type in ('cadre', 'perso') then
    if exists (select 1 from cadres_possedes where joueur = auth.uid() and cadre = article) then raise exception 'Tu possèdes déjà cet article.'; end if;
    cout := b.prix;
  else
    if nombre not in (1, 5) then raise exception 'Quantité invalide.'; end if;
    cout := case when nombre = 5 then b.prix * 4 else b.prix end; -- le lot de 5 : une offerte
  end if;
  update profils set louidors = louidors - cout where id = auth.uid() and louidors >= cout returning louidors into solde;
  if solde is null then raise exception 'Pas assez de Louidors.'; end if;
  if b.type in ('cadre', 'perso') then
    insert into cadres_possedes (joueur, cadre) values (auth.uid(), article);
  else
    insert into inventaire (joueur, objet, quantite) values (auth.uid(), article, nombre)
      on conflict (joueur, objet) do update set quantite = inventaire.quantite + excluded.quantite;
  end if;
  return solde;
end $$;

-- Équiper (ou retirer, choix = null) une personnalisation.
create or replace function public.equiper_perso(categorie text, choix text) returns void
  language plpgsql security definer set search_path = public as $$
declare p profils;
begin
  select * into p from profils where id = auth.uid();
  if p.id is null then raise exception 'Non connecté.'; end if;
  if categorie not in ('dos', 'tapis', 'pli', 'entree', 'victoire', 'titre', 'banniere', 'compagnon', 'theme') then
    raise exception 'Catégorie inconnue.';
  end if;
  if choix is null then
    update profils set perso = perso - categorie where id = p.id;
  else
    if left(choix, char_length(categorie) + 1) <> categorie || '_' then raise exception 'Cet article ne va pas ici.'; end if;
    if not (choix = any(perso_gagnes(p))) then
      if not exists (select 1 from boutique where id = choix and type = 'perso') then raise exception 'Cet article n’existe pas.'; end if;
      if not p.est_admin and not exists (select 1 from cadres_possedes where joueur = p.id and cadre = choix) then
        raise exception 'Tu ne possèdes pas cet article.';
      end if;
    end if;
    update profils set perso = jsonb_set(perso, array[categorie], to_jsonb(choix)) where id = p.id;
  end if;
  update salon_joueurs set perso = (select perso from profils where id = p.id) where joueur_id = p.id;
end $$;

-- Offrir un article à un ami (payé par celui qui offre, avec un petit message).
create or replace function public.offrir(article text, ami uuid) returns int
  language plpgsql security definer set search_path = public as $$
declare
  b boutique;
  solde int;
begin
  if auth.uid() is null then raise exception 'Non connecté.'; end if;
  if ami = auth.uid() then raise exception 'Tu ne peux pas t’offrir un cadeau à toi-même.'; end if;
  if not exists (select 1 from amities where statut = 'acceptee'
                 and ((demandeur = auth.uid() and destinataire = ami) or (demandeur = ami and destinataire = auth.uid()))) then
    raise exception 'Tu ne peux offrir qu’à tes compagnons.';
  end if;
  if exists (select 1 from profils where id = ami and banni) then raise exception 'Ce pirate est banni.'; end if;
  select * into b from boutique where id = article and actif;
  if b.id is null then raise exception 'Cet article n’existe pas.'; end if;
  if b.type in ('cadre', 'perso') and exists (select 1 from cadres_possedes where joueur = ami and cadre = article) then
    raise exception 'Ton compagnon possède déjà cet article.';
  end if;
  update profils set louidors = louidors - b.prix where id = auth.uid() and louidors >= b.prix returning louidors into solde;
  if solde is null then raise exception 'Pas assez de Louidors.'; end if;
  if b.type in ('cadre', 'perso') then
    insert into cadres_possedes (joueur, cadre) values (ami, article);
  else
    insert into inventaire (joueur, objet, quantite) values (ami, article, 1)
      on conflict (joueur, objet) do update set quantite = inventaire.quantite + 1;
  end if;
  insert into messages_prives (de, a, texte) values (auth.uid(), ami, '🎁 Je t’ai offert « ' || b.nom || ' » ! Regarde dans la boutique du port.');
  return solde;
end $$;

-- Coffres de niveau : un coffre de Louidors tous les 5 niveaux.
create table if not exists public.paliers_reclames (
  joueur uuid not null references public.profils (id) on delete cascade,
  palier int not null,
  reclame_le timestamptz not null default now(),
  primary key (joueur, palier)
);
alter table public.paliers_reclames enable row level security;
drop policy if exists "Mes paliers" on public.paliers_reclames;
create policy "Mes paliers" on public.paliers_reclames for select to authenticated using (joueur = auth.uid());
grant select on public.paliers_reclames to authenticated;

create or replace function public.reclamer_palier(palier int) returns int
  language plpgsql security definer set search_path = public as $$
declare
  p profils;
  solde int;
begin
  select * into p from profils where id = auth.uid();
  if p.id is null then raise exception 'Non connecté.'; end if;
  if palier <= 0 or palier % 5 <> 0 then raise exception 'Coffre inconnu.'; end if;
  if public.niveau_de(p.xp) < palier then raise exception 'Tu n’as pas encore atteint ce niveau.'; end if;
  insert into paliers_reclames (joueur, palier) values (p.id, palier) on conflict do nothing;
  if not found then raise exception 'Coffre déjà ouvert.'; end if;
  update profils set louidors = louidors + 100 + palier * 10 where id = p.id returning louidors into solde;
  return solde;
end $$;

-- Chaque pirate arrive à table avec son néon et ses personnalisations.
create or replace function public.salon_joueur_neon() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if new.couleur_nom is null then
    select couleur_nom into new.couleur_nom from profils where id = new.joueur_id;
  end if;
  if new.perso is null or new.perso = '{}'::jsonb then
    select coalesce(perso, '{}'::jsonb) into new.perso from profils where id = new.joueur_id;
    new.perso := coalesce(new.perso, '{}'::jsonb);
  end if;
  return new;
end $$;

revoke execute on function public.equiper_perso(text, text), public.offrir(text, uuid), public.reclamer_palier(int) from public, anon;
grant execute on function public.equiper_perso(text, text), public.offrir(text, uuid), public.reclamer_palier(int), public.perso_gagnes(public.profils) to authenticated;
