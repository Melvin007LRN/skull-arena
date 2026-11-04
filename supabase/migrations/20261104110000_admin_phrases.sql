-- Étape 8 : espace Admin (joueurs, bannissement, pseudos, photos) et phrases rapides modifiables.

create table if not exists public.phrases_rapides (
  id bigint generated always as identity primary key,
  texte text not null check (char_length(texte) between 1 and 40),
  ordre int not null default 0,
  supprimee boolean not null default false,
  cree_le timestamptz not null default now()
);
alter table public.phrases_rapides enable row level security;
drop policy if exists "Phrases visibles par les joueurs connectés" on public.phrases_rapides;
create policy "Phrases visibles par les joueurs connectés" on public.phrases_rapides for select to authenticated using (true);
grant select on public.phrases_rapides to authenticated;

insert into public.phrases_rapides (texte, ordre)
select t, o from (values ('C’est très fort', 1), ('Ah oui les jean', 2), ('Bravo', 3), ('Pardon', 4), ('Masterclass', 5),
  ('Tu fais chauffer', 6), ('C’est pour moi', 7), ('Il va la chercher', 8)) v(t, o)
where not exists (select 1 from public.phrases_rapides);

-- Vérifie que l'appelant est admin.
create or replace function public.exiger_admin() returns void
  language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from profils where id = auth.uid() and est_admin and not banni) then
    raise exception 'Réservé au capitaine du navire.';
  end if;
end $$;

create or replace function public.admin_bannir(joueur uuid, valeur boolean) returns void
  language plpgsql security definer set search_path = public as $$
begin
  perform exiger_admin();
  if joueur = auth.uid() then raise exception 'Tu ne peux pas te bannir toi-même.'; end if;
  update profils set banni = valeur where id = joueur;
end $$;

create or replace function public.admin_renommer(joueur uuid, nouveau text) returns void
  language plpgsql security definer set search_path = public as $$
declare p text := trim(nouveau);
begin
  perform exiger_admin();
  if p !~ '^[A-Za-z0-9_\-À-ÿ]{3,16}$' then raise exception 'Pseudo invalide : 3 à 16 lettres, chiffres, - ou _.'; end if;
  if exists (select 1 from profils where lower(pseudo) = lower(p) and id <> joueur) then raise exception 'Ce pseudo est déjà pris.'; end if;
  update profils set pseudo = p where id = joueur;
end $$;

-- « Supprimer » un pseudo : il est remplacé par un nom neutre (Pirate1234).
create or replace function public.admin_effacer_pseudo(joueur uuid) returns text
  language plpgsql security definer set search_path = public as $$
declare p text;
begin
  perform exiger_admin();
  loop
    p := 'Pirate' || (1000 + floor(random() * 9000))::int;
    exit when not exists (select 1 from profils where lower(pseudo) = lower(p));
  end loop;
  update profils set pseudo = p where id = joueur;
  return p;
end $$;

create or replace function public.admin_effacer_photo(joueur uuid) returns void
  language plpgsql security definer set search_path = public as $$
begin
  perform exiger_admin();
  update profils set photo_url = null where id = joueur;
end $$;

create or replace function public.admin_ajouter_phrase(texte text) returns void
  language plpgsql security definer set search_path = public as $$
begin
  perform exiger_admin();
  if char_length(trim(texte)) not between 1 and 40 then raise exception 'Une phrase fait de 1 à 40 caractères.'; end if;
  insert into phrases_rapides (texte, ordre) values (trim(texte), coalesce((select max(ordre) from phrases_rapides), 0) + 1);
end $$;

create or replace function public.admin_modifier_phrase(phrase bigint, texte text) returns void
  language plpgsql security definer set search_path = public as $$
begin
  perform exiger_admin();
  if char_length(trim(texte)) not between 1 and 40 then raise exception 'Une phrase fait de 1 à 40 caractères.'; end if;
  update phrases_rapides set texte = trim(admin_modifier_phrase.texte) where id = phrase;
end $$;

-- Une phrase retirée est masquée (on la garde pour l'historique).
create or replace function public.admin_retirer_phrase(phrase bigint) returns void
  language plpgsql security definer set search_path = public as $$
begin
  perform exiger_admin();
  update phrases_rapides set supprimee = true where id = phrase;
end $$;

revoke execute on function public.exiger_admin() from public, anon;
revoke execute on function public.admin_bannir(uuid, boolean) from public, anon;
revoke execute on function public.admin_renommer(uuid, text) from public, anon;
revoke execute on function public.admin_effacer_pseudo(uuid) from public, anon;
revoke execute on function public.admin_effacer_photo(uuid) from public, anon;
revoke execute on function public.admin_ajouter_phrase(text) from public, anon;
revoke execute on function public.admin_modifier_phrase(bigint, text) from public, anon;
revoke execute on function public.admin_retirer_phrase(bigint) from public, anon;
grant execute on function public.exiger_admin(), public.admin_bannir(uuid, boolean), public.admin_renommer(uuid, text),
  public.admin_effacer_pseudo(uuid), public.admin_effacer_photo(uuid), public.admin_ajouter_phrase(text),
  public.admin_modifier_phrase(bigint, text), public.admin_retirer_phrase(bigint) to authenticated;
