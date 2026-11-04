-- Lot 3 : messages privés entre amis, chat de la salle d'attente, blocages, signalements, filtre de mots.

-- Filtre de grossièretés : les mots interdits sont remplacés par des étoiles.
create or replace function public.filtrer_texte(t text) returns text
  language plpgsql immutable as $$
declare
  w text;
  mots text[] := array[
    'connard','connards','connasse','connasses','conne','con','cons','salope','salopes','salaud','salauds','pute','putes','putain',
    'encule','enculé','enculés','enculer','fdp','ntm','nique','niquer','niktamer','batard','bâtard','bâtards','batards','pd','pédé','pede',
    'tapette','tafiole','gouine','merde','merdes','chier','couille','couilles','bite','bites','teub','zob','branleur','branleuse',
    'nègre','negre','negro','bougnoule','youpin','raton','bicot','chinetoque','bamboula','nazi','hitler','tg','ftg','vtff','vtf'
  ];
begin
  if t is null then return null; end if;
  foreach w in array mots loop
    t := regexp_replace(t, '(^|[^[:alnum:]])(' || w || ')([^[:alnum:]]|$)', '\1' || repeat('*', char_length(w)) || '\3', 'gi');
  end loop;
  return t;
end $$;

-- Blocages : un joueur bloqué ne peut plus m'écrire, et je ne vois plus ses messages.
create table if not exists public.blocages (
  bloqueur uuid not null references public.profils (id) on delete cascade,
  bloque uuid not null references public.profils (id) on delete cascade,
  cree_le timestamptz not null default now(),
  actif boolean not null default true,
  primary key (bloqueur, bloque)
);
alter table public.blocages enable row level security;
create policy "Mes blocages" on public.blocages for select to authenticated using (bloqueur = auth.uid());
grant select on public.blocages to authenticated;

create or replace function public.est_bloque(x uuid, y uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from blocages where actif and ((bloqueur = x and bloque = y) or (bloqueur = y and bloque = x)))
$$;

create or replace function public.bloquer(joueur uuid, valeur boolean) returns void
  language plpgsql security definer set search_path = public as $$
begin
  if joueur = auth.uid() then raise exception 'Tu ne peux pas te bloquer toi-même.'; end if;
  insert into blocages (bloqueur, bloque, actif) values (auth.uid(), joueur, valeur)
    on conflict (bloqueur, bloque) do update set actif = excluded.actif, cree_le = now();
  -- Bloquer met fin à l'amitié.
  if valeur then
    update amities set statut = 'retiree', maj_le = now()
      where (demandeur = auth.uid() and destinataire = joueur) or (demandeur = joueur and destinataire = auth.uid());
  end if;
end $$;

-- Signalements (visibles par l'admin).
create table if not exists public.signalements (
  id bigint generated always as identity primary key,
  auteur uuid not null references public.profils (id) on delete cascade,
  cible uuid not null references public.profils (id) on delete cascade,
  motif text not null,
  contexte text,
  traite boolean not null default false,
  cree_le timestamptz not null default now()
);
alter table public.signalements enable row level security;
create policy "Signalements pour l'admin" on public.signalements for select to authenticated
  using (exists (select 1 from public.profils where id = auth.uid() and est_admin));
grant select on public.signalements to authenticated;

create or replace function public.signaler(cible uuid, motif text, contexte text default null) returns void
  language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or cible = auth.uid() then raise exception 'Signalement impossible.'; end if;
  if exists (select 1 from signalements s where s.auteur = auth.uid() and s.cible = signaler.cible and s.cree_le > now() - interval '1 minute') then
    raise exception 'Tu as déjà signalé ce joueur à l’instant.';
  end if;
  insert into signalements (auteur, cible, motif, contexte) values (auth.uid(), cible, left(motif, 60), left(contexte, 300));
end $$;

create or replace function public.admin_traiter_signalement(signalement bigint) returns void
  language plpgsql security definer set search_path = public as $$
begin
  perform exiger_admin();
  update signalements set traite = true where id = signalement;
end $$;

-- Messages privés entre amis (on affiche les 20 derniers de chaque conversation).
create table if not exists public.messages_prives (
  id bigint generated always as identity primary key,
  de uuid not null references public.profils (id) on delete cascade,
  a uuid not null references public.profils (id) on delete cascade,
  texte text not null,
  lu boolean not null default false,
  cree_le timestamptz not null default now()
);
create index if not exists messages_conversation on public.messages_prives (least(de, a), greatest(de, a), cree_le desc);
create index if not exists messages_non_lus on public.messages_prives (a) where not lu;
alter table public.messages_prives enable row level security;
create policy "Mes messages" on public.messages_prives for select to authenticated using (auth.uid() in (de, a));
grant select on public.messages_prives to authenticated;
alter publication supabase_realtime add table public.messages_prives;

create or replace function public.envoyer_message(a uuid, texte text) returns void
  language plpgsql security definer set search_path = public as $$
declare propre text := trim(texte);
begin
  if auth.uid() is null then raise exception 'Non connecté.'; end if;
  if char_length(propre) = 0 then return; end if;
  if char_length(propre) > 200 then raise exception 'Message trop long (200 caractères maximum).'; end if;
  if (lien_amitie(auth.uid(), a)).statut is distinct from 'acceptee' then raise exception 'Tu ne peux écrire qu’à tes amis.'; end if;
  if est_bloque(auth.uid(), a) then raise exception 'Impossible d’écrire à ce joueur.'; end if;
  if exists (select 1 from profils where id = auth.uid() and banni) then raise exception 'Ton compte a été banni.'; end if;
  if exists (select 1 from messages_prives m where m.de = auth.uid() and m.cree_le > now() - interval '1 second') then
    raise exception 'Doucement, moussaillon !';
  end if;
  insert into messages_prives (de, a, texte) values (auth.uid(), a, filtrer_texte(propre));
end $$;

create or replace function public.marquer_lus(autre uuid) returns void
  language sql security definer set search_path = public as $$
  update messages_prives set lu = true where a = auth.uid() and de = autre and not lu
$$;

-- Chat libre de la salle d'attente (avant le lancement de la partie).
create table if not exists public.messages_salon (
  id bigint generated always as identity primary key,
  salon_id uuid not null references public.salons (id) on delete cascade,
  de uuid not null references public.profils (id) on delete cascade,
  pseudo text not null,
  texte text not null,
  cree_le timestamptz not null default now()
);
create index if not exists messages_salon_salon on public.messages_salon (salon_id, cree_le desc);
alter table public.messages_salon enable row level security;
create policy "Messages de mon salon" on public.messages_salon for select to authenticated
  using (exists (select 1 from public.salon_joueurs j where j.salon_id = messages_salon.salon_id and j.joueur_id = auth.uid()));
grant select on public.messages_salon to authenticated;
alter publication supabase_realtime add table public.messages_salon;

create or replace function public.envoyer_message_salon(salon uuid, texte text) returns void
  language plpgsql security definer set search_path = public as $$
declare
  propre text := trim(texte);
  nom text;
begin
  if char_length(propre) = 0 then return; end if;
  if char_length(propre) > 150 then raise exception 'Message trop long (150 caractères maximum).'; end if;
  select pseudo into nom from salon_joueurs where salon_id = salon and joueur_id = auth.uid();
  if nom is null then raise exception 'Tu n’es pas dans ce salon.'; end if;
  if not exists (select 1 from salons where id = salon and statut = 'attente') then raise exception 'Le chat est fermé pendant la partie.'; end if;
  if exists (select 1 from profils where id = auth.uid() and banni) then raise exception 'Ton compte a été banni.'; end if;
  if exists (select 1 from messages_salon m where m.de = auth.uid() and m.cree_le > now() - interval '1 second') then
    raise exception 'Doucement, moussaillon !';
  end if;
  insert into messages_salon (salon_id, de, pseudo, texte) values (salon, auth.uid(), nom, filtrer_texte(propre));
end $$;

-- Une demande d'ami est impossible entre joueurs bloqués.
create or replace function public.demander_ami(pseudo_ami text) returns text
  language plpgsql security definer set search_path = public as $$
declare
  cible uuid;
  l amities;
begin
  if auth.uid() is null then raise exception 'Non connecté.'; end if;
  select id into cible from profils where lower(pseudo) = lower(trim(pseudo_ami)) and not banni;
  if cible is null then raise exception 'Aucun pirate ne porte ce pseudo.'; end if;
  if cible = auth.uid() then raise exception 'Tu ne peux pas t’ajouter toi-même.'; end if;
  if est_bloque(auth.uid(), cible) then raise exception 'Impossible d’ajouter ce joueur.'; end if;
  l := lien_amitie(auth.uid(), cible);
  if l.demandeur is null then
    insert into amities (demandeur, destinataire) values (auth.uid(), cible);
    return 'demande';
  elsif l.statut = 'acceptee' then
    return 'deja';
  elsif l.statut = 'attente' and l.destinataire = auth.uid() then
    update amities set statut = 'acceptee', maj_le = now() where demandeur = l.demandeur and destinataire = l.destinataire;
    return 'acceptee';
  elsif l.statut = 'attente' then
    return 'deja_demande';
  else
    update amities set demandeur = auth.uid(), destinataire = cible, statut = 'attente', maj_le = now()
      where demandeur = l.demandeur and destinataire = l.destinataire;
    return 'demande';
  end if;
end $$;
