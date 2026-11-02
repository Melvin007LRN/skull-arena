CREATE OR REPLACE FUNCTION public.start_room(p_room_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_host_id uuid;
  v_status text;
  v_extensions jsonb;
  v_max_players integer;
  v_player_count integer;
  v_deck_count integer;
  v_deck jsonb;
  v_hand jsonb;
  v_draw_pile jsonb;
  v_position integer := 1;
  v_player record;
  v_round_id uuid;
  v_leader_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Tu dois être connecté.';
  END IF;

  SELECT host_id, status, extensions, max_players
  INTO v_host_id, v_status, v_extensions, v_max_players
  FROM public.game_rooms
  WHERE id = p_room_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Salon introuvable.';
  END IF;

  IF v_host_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Seul le capitaine peut lancer la partie.';
  END IF;

  IF v_status <> 'waiting' THEN
    RAISE EXCEPTION 'Ce salon ne peut plus être lancé.';
  END IF;

  SELECT count(*)::integer
  INTO v_player_count
  FROM public.room_players
  WHERE room_id = p_room_id;

  IF v_player_count < 2 OR v_player_count > v_max_players THEN
    RAISE EXCEPTION 'Nombre de joueurs invalide.';
  END IF;

  v_extensions := COALESCE(v_extensions, '{}'::jsonb);

  -- La taille doit provenir du générateur réel : les noms des options
  -- ont évolué et un calcul parallèle pouvait sous-estimer le paquet.
  v_deck_count := jsonb_array_length(
    public.build_skull_arena_deck(v_extensions)
  );

  IF v_deck_count < v_player_count * 10 THEN
    RAISE EXCEPTION
      'Paquet insuffisant : % cartes pour % joueurs. Il faut au moins % cartes.',
      v_deck_count, v_player_count, v_player_count * 10;
  END IF;

  -- Construire et mélanger le paquet côté serveur.
  SELECT jsonb_agg(card ORDER BY random())
  INTO v_deck
  FROM jsonb_array_elements(
    public.build_skull_arena_deck(v_extensions)
  ) AS deck_cards(card);

  IF jsonb_array_length(v_deck) <> v_deck_count THEN
    RAISE EXCEPTION 'Le nombre de cartes du paquet est incohérent.';
  END IF;

  -- Choisir aléatoirement le premier joueur.
  SELECT player_id
  INTO v_leader_id
  FROM public.room_players
  WHERE room_id = p_room_id
  ORDER BY random()
  LIMIT 1;

  -- Créer la première manche.
  INSERT INTO public.game_rounds (
    room_id, round_number, status, leader_player_id
  )
  VALUES (p_room_id, 1, 'dealing', v_leader_id)
  RETURNING id INTO v_round_id;

  -- Distribuer une carte à chaque joueur pour la manche 1.
  FOR v_player IN
    SELECT player_id
    FROM public.room_players
    WHERE room_id = p_room_id
    ORDER BY joined_at, id
  LOOP
    SELECT COALESCE(jsonb_agg(card ORDER BY ordinality), '[]'::jsonb)
    INTO v_hand
    FROM jsonb_array_elements(v_deck)
      WITH ORDINALITY AS dealt(card, ordinality)
    WHERE ordinality >= v_position
      AND ordinality < v_position + 1;

    INSERT INTO public.player_hands (round_id, player_id, cards)
    VALUES (v_round_id, v_player.player_id, v_hand);

    v_position := v_position + 1;
  END LOOP;

  -- Conserver les cartes non distribuées dans la pioche secrète.
  SELECT COALESCE(jsonb_agg(card ORDER BY ordinality), '[]'::jsonb)
  INTO v_draw_pile
  FROM jsonb_array_elements(v_deck)
    WITH ORDINALITY AS remaining(card, ordinality)
  WHERE ordinality >= v_position;

  INSERT INTO public.game_round_private_state (round_id, draw_pile)
  VALUES (v_round_id, v_draw_pile);

  UPDATE public.game_rounds
  SET status = 'bidding', updated_at = now()
  WHERE id = v_round_id;

  UPDATE public.game_rooms
  SET status = 'playing',
      countdown_ends_at = now() + interval '3 seconds'
  WHERE id = p_room_id;

  RETURN true;
END;
$function$;
