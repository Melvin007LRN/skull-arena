-- Keep Walk the Plank target selection in sync with Last Volley extra plays.
CREATE OR REPLACE FUNCTION public.choose_walk_the_plank_target(
  p_trick_id uuid,
  p_target_player_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_round_id uuid;
  v_room_id uuid;
  v_round_number integer;
  v_trick_number integer;
  v_skipped_ids uuid[] := '{}'::uuid[];
  v_plank_player_id uuid;
  v_play_count integer;
  v_normal_count integer;
  v_extra_count integer;
  v_expected_count integer;
  v_target_has_pirate boolean;
  v_resolution jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Connexion requise.';
  END IF;

  SELECT gr.id, gr.room_id, gr.round_number, gt.trick_number,
         COALESCE(gr.last_volley_skip_player_ids, '{}'::uuid[]),
         gt.walk_the_plank_player_id, gt.resolution
  INTO v_round_id, v_room_id, v_round_number, v_trick_number,
       v_skipped_ids, v_plank_player_id, v_resolution
  FROM public.game_tricks gt
  JOIN public.game_rounds gr ON gr.id = gt.round_id
  WHERE gt.id = p_trick_id
    AND gt.status = 'playing'
  FOR UPDATE OF gt;

  IF v_room_id IS NULL THEN
    RAISE EXCEPTION 'Pli introuvable ou déjà résolu.';
  END IF;

  IF v_plank_player_id IS DISTINCT FROM v_user_id THEN
    RAISE EXCEPTION 'Seul le joueur ayant posé le Supplice peut choisir la cible.';
  END IF;

  SELECT count(*)::integer
  INTO v_play_count
  FROM public.trick_plays
  WHERE trick_id = p_trick_id;

  SELECT count(*)::integer
  INTO v_normal_count
  FROM public.room_players rp
  WHERE rp.room_id = v_room_id
    AND (
      v_trick_number <> v_round_number
      OR NOT (rp.player_id = ANY(v_skipped_ids))
    );

  SELECT count(DISTINCT tp.player_id)::integer
  INTO v_extra_count
  FROM public.trick_plays tp
  WHERE tp.trick_id = p_trick_id
    AND tp.card->>'type' = 'last_volley'
    AND v_trick_number < v_round_number;

  v_expected_count := v_normal_count + v_extra_count;

  IF v_play_count <> v_expected_count THEN
    RAISE EXCEPTION 'Tous les joueurs doivent avoir joué, y compris les cartes supplémentaires Dernière Salve.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.room_players rp
    WHERE rp.room_id = v_room_id
      AND rp.player_id = p_target_player_id
  ) THEN
    RAISE EXCEPTION 'Le joueur choisi ne participe pas à cette manche.';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.trick_plays tp
    WHERE tp.trick_id = p_trick_id
      AND tp.player_id = p_target_player_id
      AND (
        tp.card->>'type' = 'pirate'
        OR (tp.card->>'type' = 'tigress' AND tp.tigress_mode = 'pirate')
      )
  )
  INTO v_target_has_pirate;

  IF NOT v_target_has_pirate THEN
    RAISE EXCEPTION 'Le joueur choisi n''a pas joué de Pirate dans ce pli.';
  END IF;

  UPDATE public.game_tricks
  SET walk_the_plank_target_player_id = p_target_player_id,
      resolution = COALESCE(resolution, '{}'::jsonb) || jsonb_build_object(
        'status', 'target_selected',
        'walk_the_plank_player_id', v_plank_player_id,
        'walk_the_plank_target_player_id', p_target_player_id
      )
  WHERE id = p_trick_id
    AND walk_the_plank_target_player_id IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La cible a déjà été choisie.';
  END IF;

  RETURN public.resolve_game_trick(p_trick_id);
END;
$function$;
