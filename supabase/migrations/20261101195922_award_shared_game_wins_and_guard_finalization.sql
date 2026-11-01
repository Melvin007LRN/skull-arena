CREATE OR REPLACE FUNCTION public.advance_game_round(p_round_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_room_id uuid;
  v_round_number integer;
  v_round_status text;
  v_room_status text;
  v_extensions jsonb;
  v_player_count integer;
  v_next_round_id uuid;
  v_deck jsonb;
  v_hand jsonb;
  v_draw_pile jsonb;
  v_position integer := 1;
  v_player record;
  v_winner_id uuid;
  v_winner_ids jsonb;
  v_top_score integer;
  v_tie_count integer;
BEGIN
  SELECT gr.room_id, gr.round_number, gr.status, room.status, room.extensions
  INTO v_room_id, v_round_number, v_round_status, v_room_status, v_extensions
  FROM public.game_rounds gr
  JOIN public.game_rooms room ON room.id = gr.room_id
  WHERE gr.id = p_round_id
  FOR UPDATE OF gr, room;

  IF v_room_id IS NULL THEN
    RAISE EXCEPTION 'Manche introuvable.';
  END IF;

  IF v_user_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.room_players
    WHERE room_id = v_room_id AND player_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Tu ne participes pas à cette partie.';
  END IF;

  -- Finalization is idempotent: a retry must never award the same game twice.
  IF v_room_status = 'finished' THEN
    RETURN jsonb_build_object('success', true, 'game_finished', true, 'already_finished', true);
  END IF;

  IF v_round_status <> 'completed' THEN
    RAISE EXCEPTION 'La manche doit être terminée avant de continuer.';
  END IF;

  SELECT id INTO v_next_round_id
  FROM public.game_rounds
  WHERE room_id = v_room_id AND round_number = v_round_number + 1
  LIMIT 1;

  IF v_next_round_id IS NOT NULL THEN
    RETURN jsonb_build_object('success',true,'already_advanced',true,'next_round_id',v_next_round_id);
  END IF;

  IF v_round_number >= 10 THEN
    SELECT max(COALESCE(ps.total_score, 0)) INTO v_top_score
    FROM public.room_players rp
    LEFT JOIN public.player_scores ps
      ON ps.room_id = v_room_id AND ps.player_id = rp.player_id
    WHERE rp.room_id = v_room_id;

    SELECT count(*)::integer INTO v_tie_count
    FROM public.room_players rp
    LEFT JOIN public.player_scores ps
      ON ps.room_id = v_room_id AND ps.player_id = rp.player_id
    WHERE rp.room_id = v_room_id
      AND COALESCE(ps.total_score, 0) = v_top_score;

    SELECT jsonb_agg(rp.player_id ORDER BY rp.joined_at, rp.player_id)
    INTO v_winner_ids
    FROM public.room_players rp
    LEFT JOIN public.player_scores ps
      ON ps.room_id = v_room_id AND ps.player_id = rp.player_id
    WHERE rp.room_id = v_room_id
      AND COALESCE(ps.total_score, 0) = v_top_score;

    IF v_tie_count = 1 THEN
      SELECT rp.player_id INTO v_winner_id
      FROM public.room_players rp
      LEFT JOIN public.player_scores ps
        ON ps.room_id = v_room_id AND ps.player_id = rp.player_id
      WHERE rp.room_id = v_room_id
        AND COALESCE(ps.total_score, 0) = v_top_score
      LIMIT 1;
    END IF;

    -- Every player sharing the highest final score receives one game win.
    UPDATE public.player_scores ps
    SET games_won = ps.games_won + CASE WHEN ps.total_score = v_top_score THEN 1 ELSE 0 END,
        updated_at = now()
    WHERE ps.room_id = v_room_id;

    INSERT INTO public.player_statistics(player_id, games_played, games_won)
    SELECT rp.player_id,
      1,
      CASE WHEN COALESCE(ps.total_score, 0) = v_top_score THEN 1 ELSE 0 END
    FROM public.room_players rp
    LEFT JOIN public.player_scores ps
      ON ps.room_id = v_room_id AND ps.player_id = rp.player_id
    WHERE rp.room_id = v_room_id
    ON CONFLICT (player_id) DO UPDATE
    SET games_played = public.player_statistics.games_played + 1,
        games_won = public.player_statistics.games_won + EXCLUDED.games_won,
        updated_at = now();

    UPDATE public.game_rooms SET status = 'finished' WHERE id = v_room_id;

    RETURN jsonb_build_object(
      'success',true,
      'game_finished',true,
      'winner_player_id',v_winner_id,
      'winner_player_ids',COALESCE(v_winner_ids, '[]'::jsonb),
      'top_score',v_top_score,
      'tie',v_tie_count > 1
    );
  END IF;

  SELECT count(*)::integer INTO v_player_count
  FROM public.room_players WHERE room_id = v_room_id;

  v_extensions := COALESCE(v_extensions, '{}'::jsonb);

  SELECT jsonb_agg(card ORDER BY random())
  INTO v_deck
  FROM jsonb_array_elements(public.build_skull_arena_deck(v_extensions)) AS cards(card);

  IF jsonb_array_length(v_deck) < v_player_count * (v_round_number + 1) THEN
    RAISE EXCEPTION 'Le paquet ne contient pas assez de cartes pour la prochaine manche.';
  END IF;

  INSERT INTO public.game_rounds(room_id, round_number, status, leader_player_id)
  SELECT v_room_id, v_round_number + 1, 'dealing',
    COALESCE(
      (SELECT winner_player_id FROM public.game_tricks
       WHERE round_id = p_round_id AND trick_number = v_round_number
       ORDER BY trick_number DESC LIMIT 1),
      (SELECT leader_player_id FROM public.game_rounds WHERE id = p_round_id)
    )
  RETURNING id INTO v_next_round_id;

  FOR v_player IN
    SELECT player_id
    FROM public.room_players
    WHERE room_id = v_room_id
    ORDER BY joined_at, player_id
  LOOP
    SELECT COALESCE(jsonb_agg(card ORDER BY ordinality), '[]'::jsonb)
    INTO v_hand
    FROM jsonb_array_elements(v_deck) WITH ORDINALITY AS dealt(card, ordinality)
    WHERE ordinality >= v_position
      AND ordinality < v_position + v_round_number + 1;

    INSERT INTO public.player_hands(round_id, player_id, cards)
    VALUES (v_next_round_id, v_player.player_id, v_hand);

    v_position := v_position + v_round_number + 1;
  END LOOP;

  SELECT COALESCE(jsonb_agg(card ORDER BY ordinality), '[]'::jsonb)
  INTO v_draw_pile
  FROM jsonb_array_elements(v_deck) WITH ORDINALITY AS remaining(card, ordinality)
  WHERE ordinality >= v_position;

  INSERT INTO public.game_round_private_state(round_id, draw_pile)
  VALUES (v_next_round_id, v_draw_pile);

  UPDATE public.game_rounds
  SET status = 'bidding', updated_at = now()
  WHERE id = v_next_round_id;

  RETURN jsonb_build_object(
    'success',true,
    'game_finished',false,
    'next_round_id',v_next_round_id,
    'round_number',v_round_number + 1,
    'cards_per_player',v_round_number + 1
  );
END;
$function$;
