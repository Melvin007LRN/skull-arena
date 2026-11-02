CREATE OR REPLACE FUNCTION public.create_room(
  p_room_name text,
  p_is_private boolean DEFAULT false,
  p_max_players integer DEFAULT 8,
  p_extensions jsonb DEFAULT '{"loot":true,"kraken":true,"white_whale":true,"expansion_2025":true,"last_shot":true,"second":true,"spotted_stingray":true,"davys_locker":true,"walk_the_plank":true}'::jsonb
)
RETURNS TABLE(room_id uuid, room_code text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  new_room_id uuid;
  new_code text;
  current_user_id uuid;
  current_username text;
BEGIN
  current_user_id := auth.uid();

  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Tu dois être connecté.';
  END IF;

  IF length(trim(p_room_name)) < 3 OR length(trim(p_room_name)) > 30 THEN
    RAISE EXCEPTION 'Le nom doit contenir entre 3 et 30 caractères.';
  END IF;

  IF p_max_players < 2 OR p_max_players > 9 THEN
    RAISE EXCEPTION 'Nombre de joueurs invalide.';
  END IF;

  IF jsonb_typeof(p_extensions) <> 'object' THEN
    RAISE EXCEPTION 'Configuration des extensions invalide.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM jsonb_each(p_extensions) AS item(key, value)
    WHERE jsonb_typeof(item.value) <> 'boolean'
  ) THEN
    RAISE EXCEPTION 'Chaque extension doit être activée ou désactivée.';
  END IF;

  SELECT username INTO current_username
  FROM public.profiles
  WHERE id = current_user_id;

  IF current_username IS NULL THEN
    RAISE EXCEPTION 'Profil joueur introuvable.';
  END IF;

  new_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  INSERT INTO public.game_rooms (
    code, room_name, host_id, status, is_private, max_players, extensions
  )
  VALUES (
    new_code, trim(p_room_name), current_user_id, 'waiting',
    p_is_private, p_max_players, p_extensions
  )
  RETURNING id INTO new_room_id;

  INSERT INTO public.room_players (room_id, player_id, username)
  VALUES (new_room_id, current_user_id, current_username);

  RETURN QUERY SELECT new_room_id, new_code;
END;
$function$;
