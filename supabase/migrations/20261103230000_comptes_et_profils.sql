-- Étape 2 : comptes et profils des joueurs.

-- Profil public de chaque joueur. Les statistiques ne sont modifiables que par le serveur (jamais par le joueur).
create table public.profils (
  id uuid primary key references auth.users (id) on delete cascade,
  pseudo text not null,
  photo_url text,
  changements_pseudo int not null default 0,
  est_admin boolean not null default false,
  banni boolean not null default false,
  xp int not null default 0,
  parties_jouees int not null default 0,
  victoires int not null default 0,
  meilleur_score int,
  points_total int not null default 0,
  mises_reussies int not null default 0,
  mises_total int not null default 0,
  cree_le timestamptz not null default now(),
  constraint pseudo_format check (pseudo ~ '^[A-Za-z0-9_\-À-ÿ]{3,16}$')
);
create unique index profils_pseudo_unique on public.profils (lower(pseudo));

alter table public.profils enable row level security;

-- Tout joueur connecté peut voir les profils (classement, profils des autres).
create policy "Profils visibles par les joueurs connectés" on public.profils
  for select to authenticated using (true);
-- Aucune politique d'écriture : toute modification passe par les fonctions ci-dessous.

-- Niveau : 100 XP par niveau, on commence au niveau 1.
create or replace function public.niveau_de(xp int) returns int
  language sql immutable as $$ select 1 + greatest(xp, 0) / 100 $$;

create or replace function public.grade_de(niveau int) returns text
  language sql immutable as $$
  select case
    when niveau >= 200 then 'Légende'
    when niveau >= 100 then 'Amiral'
    when niveau >= 50 then 'Capitaine'
    when niveau >= 25 then 'Quartier-maître'
    when niveau >= 10 then 'Matelot'
    else 'Mousse' end $$;

-- Pseudo libre ? (appelée avant l'inscription, donc accessible sans être connecté)
create or replace function public.pseudo_disponible(p text) returns boolean
  language sql stable security definer set search_path = public as $$
  select not exists (select 1 from public.profils where lower(pseudo) = lower(trim(p)))
$$;
grant execute on function public.pseudo_disponible(text) to anon, authenticated;

-- Création automatique du profil à l'inscription.
create or replace function public.creer_profil() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  p text := trim(coalesce(new.raw_user_meta_data ->> 'pseudo', ''));
begin
  if coalesce((new.raw_user_meta_data ->> 'age_15_ou_plus')::boolean, false) is not true then
    raise exception 'Il faut avoir 15 ans ou plus pour créer un compte.';
  end if;
  if p !~ '^[A-Za-z0-9_\-À-ÿ]{3,16}$' then
    raise exception 'Pseudo invalide : 3 à 16 lettres, chiffres, - ou _.';
  end if;
  if not public.pseudo_disponible(p) then
    raise exception 'Ce pseudo est déjà pris.';
  end if;
  insert into public.profils (id, pseudo, est_admin)
  values (new.id, p, lower(new.email) = '123melvin007@gmail.com');
  return new;
end $$;

create trigger profil_a_l_inscription
  after insert on auth.users
  for each row execute function public.creer_profil();

-- Changer de pseudo : 3 fois au total.
create or replace function public.changer_pseudo(nouveau text) returns void
  language plpgsql security definer set search_path = public as $$
declare
  p text := trim(nouveau);
  deja int;
begin
  select changements_pseudo into deja from public.profils where id = auth.uid() for update;
  if deja is null then raise exception 'Profil introuvable.'; end if;
  if deja >= 3 then raise exception 'Tu as déjà utilisé tes 3 changements de pseudo.'; end if;
  if p !~ '^[A-Za-z0-9_\-À-ÿ]{3,16}$' then
    raise exception 'Pseudo invalide : 3 à 16 lettres, chiffres, - ou _.';
  end if;
  if exists (select 1 from public.profils where lower(pseudo) = lower(p) and id <> auth.uid()) then
    raise exception 'Ce pseudo est déjà pris.';
  end if;
  update public.profils set pseudo = p, changements_pseudo = changements_pseudo + 1 where id = auth.uid();
end $$;
grant execute on function public.changer_pseudo(text) to authenticated;

-- Enregistrer la photo de profil (le fichier est déposé dans le dossier du joueur du bucket "avatars").
create or replace function public.changer_photo(url text) returns void
  language plpgsql security definer set search_path = public as $$
begin
  if url is not null and url not like '%/storage/v1/object/public/avatars/' || auth.uid()::text || '/%' then
    raise exception 'Photo invalide.';
  end if;
  update public.profils set photo_url = url where id = auth.uid();
end $$;
grant execute on function public.changer_photo(text) to authenticated;

-- Supprimer son compte (RGPD) : le profil part avec, grâce à "on delete cascade".
create or replace function public.supprimer_mon_compte() returns void
  language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then raise exception 'Non connecté.'; end if;
  delete from auth.users where id = auth.uid();
end $$;
grant execute on function public.supprimer_mon_compte() to authenticated;

-- Ces fonctions ne doivent pas être appelables par n'importe qui.
revoke execute on function public.creer_profil() from public, anon, authenticated;
revoke execute on function public.changer_pseudo(text) from public, anon;
revoke execute on function public.changer_photo(text) from public, anon;
revoke execute on function public.supprimer_mon_compte() from public, anon;
grant execute on function public.changer_pseudo(text) to authenticated;
grant execute on function public.changer_photo(text) to authenticated;
grant execute on function public.supprimer_mon_compte() to authenticated;

-- Les joueurs ne peuvent que lire la table ; les écritures passent par les fonctions ci-dessus.
revoke insert, update, delete, truncate, references, trigger on public.profils from anon, authenticated;
revoke all on public.profils from anon;
grant select on public.profils to authenticated;
