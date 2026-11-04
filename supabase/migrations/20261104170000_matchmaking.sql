-- Partie rapide (matchmaking) : file d'attente et constitution automatique des tables.
create table if not exists public.file_attente (
  joueur uuid primary key references public.profils(id) on delete cascade,
  depuis timestamptz not null default now(),
  maj_le timestamptz not null default now(),
  actif boolean not null default true,
  salon_id uuid references public.salons(id) on delete set null
);
alter table public.file_attente enable row level security;
drop policy if exists "ma place dans la file" on public.file_attente;
create policy "ma place dans la file" on public.file_attente for select using (joueur = auth.uid());

alter table public.salons add column if not exists rapide boolean not null default false;

-- Appelée par le serveur de jeu uniquement : forme une table dès 4 joueurs,
-- ou dès 2 si le plus ancien attend depuis 30 secondes. Renvoie le salon créé (ou null).
create or replace function public.matcher_file() returns uuid
language plpgsql security definer set search_path = public as $$
declare
  ids uuid[];
  plus_ancien timestamptz;
  s_id uuid;
  s_code text;
  alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'Réservé au serveur.'; end if;
  ids := array(
    select f.joueur from file_attente f join profils p on p.id = f.joueur
    where f.actif and f.salon_id is null and f.maj_le > now() - interval '12 seconds' and not p.banni
    order by f.depuis limit 4
    for update of f skip locked
  );
  if coalesce(array_length(ids, 1), 0) < 2 then return null; end if;
  select min(depuis) into plus_ancien from file_attente where joueur = any(ids);
  if array_length(ids, 1) < 4 and plus_ancien > now() - interval '30 seconds' then return null; end if;
  loop
    s_code := '';
    for i in 1..6 loop s_code := s_code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1); end loop;
    begin
      insert into salons(code, public, hote, entrainement, extension, rapide)
        values (s_code, false, ids[1], false, true, true) returning id into s_id;
      exit;
    exception when unique_violation then null;
    end;
  end loop;
  insert into salon_joueurs(salon_id, joueur_id, pseudo, photo_url, cadre, place, pret)
    select s_id, p.id, p.pseudo, p.photo_url, p.cadre, (k.ord - 1)::int, true
    from unnest(ids) with ordinality as k(id, ord) join profils p on p.id = k.id;
  update file_attente set salon_id = s_id, actif = false where joueur = any(ids);
  return s_id;
end $$;

-- Nombre de pirates qui cherchent une partie en ce moment.
create or replace function public.nb_file() returns int
language sql security definer set search_path = public stable as $$
  select count(*)::int from file_attente where actif and salon_id is null and maj_le > now() - interval '12 seconds'
$$;
