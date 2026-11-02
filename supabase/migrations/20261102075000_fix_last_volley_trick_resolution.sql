CREATE OR REPLACE FUNCTION public.detect_walk_the_plank_after_last_play()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_round_id uuid;
  v_room_id uuid;
  v_round_number integer;
  v_trick_number integer;
  v_player_count integer;
  v_normal_count integer;
  v_play_count integer;
  v_extra_count integer;
  v_expected_count integer;
  v_skipped_ids uuid[] := '{}'::uuid[];
  v_plank_player_id uuid;
  v_pirate_count integer;
BEGIN
  SELECT gr.id, gr.room_id, gr.round_number, gt.trick_number,
         COALESCE(gr.last_volley_skip_player_ids, '{}'::uuid[])
  INTO v_round_id, v_room_id, v_round_number, v_trick_number, v_skipped_ids
  FROM public.game_tricks gt
  JOIN public.game_rounds gr ON gr.id = gt.round_id
  WHERE gt.id = NEW.trick_id AND gt.status = 'playing';

  IF v_room_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT count(*)::integer
  INTO v_player_count
  FROM public.room_players
  WHERE room_id = v_room_id;

  v_normal_count := v_player_count;
  IF v_trick_number = v_round_number THEN
    SELECT count(*)::integer
    INTO v_normal_count
    FROM public.room_players rp
    WHERE rp.room_id = v_room_id
      AND NOT (rp.player_id = ANY(v_skipped_ids));
  END IF;

  SELECT count(*)::integer
  INTO v_play_count
  FROM public.trick_plays
  WHERE trick_id = NEW.trick_id;

  SELECT count(DISTINCT tp.player_id)::integer
  INTO v_extra_count
  FROM public.trick_plays tp
  WHERE tp.trick_id = NEW.trick_id
    AND tp.card->>'type' = 'last_volley'
    AND v_trick_number < v_round_number;

  v_expected_count := v_normal_count + v_extra_count;

  IF v_player_count = 0 OR v_play_count <> v_expected_count THEN
    RETURN NEW;
  END IF;

  SELECT tp.player_id
  INTO v_plank_player_id
  FROM public.trick_plays tp
  WHERE tp.trick_id = NEW.trick_id
    AND tp.card->>'type' = 'walk_the_plank'
  ORDER BY tp.play_order
  LIMIT 1;

  SELECT count(*)::integer
  INTO v_pirate_count
  FROM public.trick_plays tp
  WHERE tp.trick_id = NEW.trick_id
    AND (
      tp.card->>'type' = 'pirate'
      OR (tp.card->>'type' = 'tigress' AND tp.tigress_mode = 'pirate')
    );

  IF v_plank_player_id IS NOT NULL AND v_pirate_count > 0 THEN
    UPDATE public.game_tricks
    SET walk_the_plank_player_id = v_plank_player_id,
        resolution = COALESCE(resolution, '{}'::jsonb) || jsonb_build_object(
          'status', 'awaiting_walk_the_plank_target',
          'walk_the_plank_player_id', v_plank_player_id
        )
    WHERE id = NEW.trick_id;
  ELSE
    PERFORM public.resolve_game_trick(NEW.trick_id);
  END IF;

  RETURN NEW;
END;
$function$;
