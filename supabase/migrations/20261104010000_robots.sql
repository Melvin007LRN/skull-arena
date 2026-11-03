-- Étape 4 : robots et entraînement solo.
alter table public.salons add column if not exists entrainement boolean not null default false;
