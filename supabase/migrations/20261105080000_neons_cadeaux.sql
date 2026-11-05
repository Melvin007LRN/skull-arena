-- Néons de pseudo (achetés à la boutique, vus par tous en partie) et cadeaux spectaculaires.
alter table public.profils add column if not exists couleur_nom text;
alter table public.salon_joueurs add column if not exists couleur_nom text;

-- Les néons de pseudo sont des articles permanents (comme les cadres), identifiés par le préfixe neon_.
insert into public.boutique (id, type, nom, icone, prix, ordre) values
  ('neon_rouge', 'cadre', 'Néon Rubis', '', 120, 201),
  ('neon_cyan', 'cadre', 'Néon Lagon', '', 120, 202),
  ('neon_vert', 'cadre', 'Néon Émeraude', '', 120, 203),
  ('neon_violet', 'cadre', 'Néon Améthyste', '', 120, 204),
  ('neon_rose', 'cadre', 'Néon Corail', '', 150, 205),
  ('neon_orange', 'cadre', 'Néon Braise', '', 150, 206),
  ('neon_glace', 'cadre', 'Néon Glacier', '', 200, 207),
  ('neon_or', 'cadre', 'Néon Doublon', '', 250, 208),
  ('neon_arcenciel', 'cadre', 'Néon Arc-en-ciel', '', 600, 209),
  ('feu_artifice', 'objet', 'Feu d’artifice', '🎆', 40, 51),
  ('bordee', 'objet', 'Bordée de canons', '💥', 75, 52),
  ('pluie_tresor', 'objet', 'Pluie de trésor', '💰', 120, 53),
  ('navire_fantome', 'objet', 'Navire fantôme', '👻', 180, 54),
  ('kraken_poche', 'objet', 'Kraken de poche', '🐙', 250, 55)
on conflict (id) do nothing;

create or replace function public.equiper_couleur(choix text) returns void
  language plpgsql security definer set search_path = public as $$
declare p profils;
begin
  select * into p from profils where id = auth.uid();
  if p.id is null then raise exception 'Non connecté.'; end if;
  if choix is not null then
    if choix not like 'neon\_%' or not exists (select 1 from boutique where id = choix) then raise exception 'Ce néon n’existe pas.'; end if;
    if not p.est_admin and not exists (select 1 from cadres_possedes where joueur = p.id and cadre = choix) then
      raise exception 'Tu ne possèdes pas ce néon.';
    end if;
  end if;
  update profils set couleur_nom = choix where id = p.id;
  update salon_joueurs set couleur_nom = choix where joueur_id = p.id;
end $$;
grant execute on function public.equiper_couleur(text) to authenticated;

-- Chaque pirate arrive à table avec son néon.
create or replace function public.salon_joueur_neon() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if new.couleur_nom is null then
    select couleur_nom into new.couleur_nom from profils where id = new.joueur_id;
  end if;
  return new;
end $$;
create or replace trigger salon_joueur_neon before insert on public.salon_joueurs for each row execute function public.salon_joueur_neon();
