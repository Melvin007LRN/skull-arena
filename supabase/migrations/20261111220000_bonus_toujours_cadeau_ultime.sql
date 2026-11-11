-- Variante « bonus toujours comptés » choisie par l'hôte, et le cadeau ultime : la Tempête d'insultes.
alter table public.salons add column if not exists bonus_toujours boolean not null default false;
insert into public.boutique (id, type, nom, icone, prix, ordre) values
  ('tempete_insultes', 'objet', 'Tempête d’insultes', '🌩️', 500, 56)
on conflict (id) do nothing;
