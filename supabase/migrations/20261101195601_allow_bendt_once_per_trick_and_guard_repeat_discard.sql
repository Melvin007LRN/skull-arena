-- Allow Bendt to activate once for every distinct won trick.
-- Also make the discard step strictly one-shot for each player/trick pair.

CREATE OR REPLACE FUNCTION public.draw_bendt_cards(p_trick_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_round uuid;
  v_room uuid;
  v_trick_number integer;
  v_round_number integer;
  v_resolution jsonb;
  v_state public.game_round_private_state%ROWTYPE;
  v_hand jsonb;
  v_drawn jsonb;
  v_remaining jsonb;
  v_pending jsonb;
  v_power_key text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Connexion requise';
  END IF;

  SELECT t.round_id, r.room_id, t.trick_number, r.round_number, t.resolution
  INTO v_round, v_room, v_trick_number, v_round_number, v_resolution
  FROM public.game_tricks t
  JOIN public.game_rounds r ON r.id = t.round_id
  WHERE t.id = p_trick_id AND t.status = 'resolved'
  FOR UPDATE OF t;

  IF v_round IS NULL THEN RAISE EXCEPTION 'Pli introuvable'; END IF;
  IF v_trick_number >= v_round_number THEN
    RAISE EXCEPTION 'Le pouvoir de Bendt ne peut pas être utilisé après le dernier pli';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.room_players
    WHERE room_id = v_room AND player_id = v_uid
  ) THEN RAISE EXCEPTION 'Joueur non autorisé'; END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(v_resolution->'pirate_power_triggers','[]'::jsonb)) trigger_item
    WHERE trigger_item->>'player_id' = v_uid::text
      AND trigger_item->>'power' = 'bendt'
  ) THEN RAISE EXCEPTION 'Le pouvoir de Bendt ne t’appartient pas'; END IF;

  SELECT * INTO v_state
  FROM public.game_round_private_state
  WHERE round_id = v_round
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Pioche introuvable'; END IF;

  v_power_key := p_trick_id::text || ':' || v_uid::text;
  v_pending := v_state.private_power_draws->v_power_key;
  IF v_pending IS NOT NULL THEN
    RAISE EXCEPTION 'Le pouvoir de Bendt a déjà été utilisé pour ce pli';
  END IF;

  IF jsonb_array_length(COALESCE(v_state.draw_pile,'[]'::jsonb)) < 2 THEN
    RAISE EXCEPTION 'Il ne reste pas assez de cartes dans la pioche';
  END IF;

  SELECT COALESCE(jsonb_agg(card ORDER BY ordinality),'[]'::jsonb)
  INTO v_drawn
  FROM jsonb_array_elements(v_state.draw_pile) WITH ORDINALITY d(card,ordinality)
  WHERE ordinality <= 2;

  SELECT COALESCE(jsonb_agg(card ORDER BY ordinality),'[]'::jsonb)
  INTO v_remaining
  FROM jsonb_array_elements(v_state.draw_pile) WITH ORDINALITY d(card,ordinality)
  WHERE ordinality > 2;

  SELECT cards INTO v_hand
  FROM public.player_hands
  WHERE round_id = v_round AND player_id = v_uid
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Main du joueur introuvable'; END IF;

  UPDATE public.player_hands
  SET cards = COALESCE(v_hand,'[]'::jsonb) || v_drawn,
      updated_at = now()
  WHERE round_id = v_round AND player_id = v_uid;

  UPDATE public.game_round_private_state
  SET draw_pile = v_remaining,
      private_power_draws = COALESCE(private_power_draws,'{}'::jsonb) ||
        jsonb_build_object(v_power_key,jsonb_build_object('player_id',v_uid,'trick_id',p_trick_id,'completed',false)),
      updated_at = now()
  WHERE round_id = v_round;

  RETURN jsonb_build_object('success',true,'drawn_cards',v_drawn,'remaining_in_pile',jsonb_array_length(v_remaining));
END;
$function$;

CREATE OR REPLACE FUNCTION public.discard_bendt_cards(p_trick_id uuid, p_card_ids text[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_round uuid;
  v_room uuid;
  v_pending jsonb;
  v_hand jsonb;
  v_remaining jsonb;
  v_found integer;
  v_power_key text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Connexion requise'; END IF;
  IF COALESCE(array_length(p_card_ids,1),0)<>2 OR (SELECT count(DISTINCT x) FROM unnest(p_card_ids) x)<>2 THEN
    RAISE EXCEPTION 'Sélectionne exactement deux cartes différentes';
  END IF;

  SELECT t.round_id,r.room_id INTO v_round,v_room
  FROM public.game_tricks t JOIN public.game_rounds r ON r.id=t.round_id
  WHERE t.id=p_trick_id AND t.status='resolved'
  FOR UPDATE OF t;

  IF v_round IS NULL THEN RAISE EXCEPTION 'Pli introuvable'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.room_players p WHERE p.room_id=v_room AND p.player_id=v_uid) THEN
    RAISE EXCEPTION 'Joueur non autorisé';
  END IF;

  v_power_key := p_trick_id::text || ':' || v_uid::text;
  SELECT private_power_draws->v_power_key INTO v_pending
  FROM public.game_round_private_state WHERE round_id=v_round FOR UPDATE;

  IF v_pending IS NULL THEN
    RAISE EXCEPTION 'Aucune défausse Bendt en attente';
  END IF;
  IF v_pending->>'trick_id'<>p_trick_id::text OR v_pending->>'player_id'<>v_uid::text THEN
    RAISE EXCEPTION 'Cette défausse Bendt ne t’appartient pas';
  END IF;
  IF COALESCE((v_pending->>'completed')::boolean,false) THEN
    RAISE EXCEPTION 'La défausse Bendt est déjà terminée pour ce pli';
  END IF;

  SELECT cards INTO v_hand FROM public.player_hands
  WHERE round_id=v_round AND player_id=v_uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Main du joueur introuvable'; END IF;

  SELECT count(*) INTO v_found
  FROM jsonb_array_elements(COALESCE(v_hand,'[]'::jsonb)) c
  WHERE c->>'id'=ANY(p_card_ids);
  IF v_found<>2 THEN RAISE EXCEPTION 'Les cartes choisies ne sont pas dans ta main'; END IF;

  SELECT COALESCE(jsonb_agg(c ORDER BY n),'[]'::jsonb) INTO v_remaining
  FROM jsonb_array_elements(v_hand) WITH ORDINALITY h(c,n)
  WHERE NOT (c->>'id'=ANY(p_card_ids));

  UPDATE public.player_hands SET cards=v_remaining,updated_at=now()
  WHERE round_id=v_round AND player_id=v_uid;

  UPDATE public.game_round_private_state
  SET private_power_draws=COALESCE(private_power_draws,'{}'::jsonb)||
      jsonb_build_object(v_power_key,jsonb_build_object('player_id',v_uid,'trick_id',p_trick_id,'completed',true)),
      updated_at=now()
  WHERE round_id=v_round;

  UPDATE public.game_tricks
  SET resolution=COALESCE(resolution,'{}'::jsonb)||jsonb_build_object('bendt_discard_completed',true)
  WHERE id=p_trick_id;

  RETURN jsonb_build_object('success',true,'remaining_count',jsonb_array_length(v_remaining));
END;
$function$;
