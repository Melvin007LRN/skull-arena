
alter table public.profiles add column if not exists avatar_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 5242880, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set public = true, file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif'];

drop policy if exists "Public avatars are viewable" on storage.objects;
create policy "Public avatars are viewable" on storage.objects
for select to public using (bucket_id = 'avatars');

drop policy if exists "Users upload their own avatar" on storage.objects;
create policy "Users upload their own avatar" on storage.objects
for insert to authenticated with check (
  bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Users update their own avatar" on storage.objects;
create policy "Users update their own avatar" on storage.objects
for update to authenticated using (
  bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text
) with check (
  bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Users delete their own avatar" on storage.objects;
create policy "Users delete their own avatar" on storage.objects
for delete to authenticated using (
  bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text
);

insert into public.quick_chat_phrases (phrase, sort_order, is_active)
select seed.phrase, seed.sort_order, true
from (values
 ('C’est très fort zinc.', 10),
 ('Ah oui c’est pers.', 20),
 ('Ferme ton cul.', 30),
 ('Il va la chercher.', 40),
 ('C’est une masterclass.', 50),
 ('La grosse chatte.', 60),
 ('Mais pourquoi ?', 70),
 ('Pardon..', 80)
) as seed(phrase, sort_order)
where not exists (
  select 1 from public.quick_chat_phrases existing where existing.phrase = seed.phrase
);
