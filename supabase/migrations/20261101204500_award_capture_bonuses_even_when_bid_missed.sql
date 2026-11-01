-- Keep capture bonuses independent from bid accuracy.
-- A missed bid still receives bonuses earned from captured cards and trick effects.
CREATE OR REPLACE FUNCTION public.complete_game_round(p_round_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_room_id uuid;
  v_round_number integer;
  v_round_status text;
  v_player_count integer;
  v_trick_count integer;
  v_resolved_count integer;
  v_result jsonb;
BEGIN
  SELECT room_id, round_number, status INTO v_room_id, v_round_number, v_round_status
  FROM public.game_rounds WHERE id = p_round_id FOR UPDATE;

  IF v_room_id IS NULL THEN RAISE EXCEPTION 'Manche introuvable.'; END IF;
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Connexion requise.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.room_players WHERE room_id = v_room_id AND player_id = v_user_id) THEN
    RAISE EXCEPTION 'Tu ne participes pas à cette partie.';
  END IF;

  IF v_round_status = 'completed' THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(s) ORDER BY s.total_points DESC), '[]'::jsonb)
    INTO v_result FROM public.player_round_scores s WHERE s.round_id = p_round_id;
    RETURN jsonb_build_object('success', true, 'already_completed', true, 'scores', v_result);
  END IF;
  IF v_round_status <> 'playing' THEN RAISE EXCEPTION 'La manche ne peut pas encore être terminée.'; END IF;

  SELECT count(*)::integer INTO v_player_count FROM public.room_players WHERE room_id = v_room_id;
  SELECT count(*)::integer, count(*) FILTER (WHERE status = 'resolved')::integer
  INTO v_trick_count, v_resolved_count FROM public.game_tricks WHERE round_id = p_round_id;
  IF v_trick_count <> v_round_number OR v_resolved_count <> v_round_number THEN
    RAISE EXCEPTION 'Tous les plis de cette manche doivent être résolus (%/%).', v_resolved_count, v_round_number;
  END IF;
  IF (SELECT count(*) FROM public.player_bids WHERE round_id = p_round_id) <> v_player_count THEN
    RAISE EXCEPTION 'Les enchères de tous les joueurs sont introuvables.';
  END IF;

  WITH player_tricks AS (
    SELECT rp.player_id,
      COALESCE(count(gt.id) FILTER (WHERE gt.winner_player_id = rp.player_id), 0)::integer AS tricks_won
    FROM public.room_players rp LEFT JOIN public.game_tricks gt ON gt.round_id = p_round_id
    WHERE rp.room_id = v_room_id GROUP BY rp.player_id
  ),
  captured AS (
    SELECT winner.player_id,
      COALESCE(sum(CASE
        WHEN loser.card->>'type' = 'number'
          AND COALESCE(loser.chosen_value, (loser.card->>'value')::integer, -1) = 14
          THEN CASE WHEN loser.card->>'suit' = 'black' THEN 20 ELSE 10 END
        WHEN loser.card->>'type' = 'number'
          AND COALESCE((loser.card->>'isExpansionCard')::boolean, false)
          AND COALESCE(loser.chosen_value, (loser.card->>'value')::integer, -1) = 7 THEN -5
        WHEN loser.card->>'type' = 'number'
          AND COALESCE((loser.card->>'isExpansionCard')::boolean, false)
          AND COALESCE(loser.chosen_value, (loser.card->>'value')::integer, -1) = 8 THEN 5
        WHEN winner.effective_type = 'pirate' AND loser.effective_type = 'mermaid' THEN 20
        WHEN winner.effective_type = 'skull_king' AND loser.effective_type = 'pirate' THEN 30
        WHEN winner.effective_type = 'mermaid' AND loser.effective_type = 'skull_king' THEN 40
        WHEN winner.effective_type IN ('skull_king','mermaid') AND loser.effective_type = 'second' THEN 30
        ELSE 0 END), 0)::integer AS capture_bonus
    FROM (
      SELECT gt.id AS trick_id, gt.winner_player_id AS player_id,
        CASE WHEN win.card->>'type'='tigress' THEN win.tigress_mode ELSE win.card->>'type' END AS effective_type
      FROM public.game_tricks gt JOIN public.trick_plays win
        ON win.trick_id = gt.id AND win.player_id = gt.winner_player_id
      WHERE gt.round_id = p_round_id AND gt.winner_player_id IS NOT NULL
    ) winner
    JOIN LATERAL (
      SELECT tp.*, CASE WHEN tp.card->>'type'='tigress' THEN tp.tigress_mode ELSE tp.card->>'type' END AS effective_type
      FROM public.trick_plays tp
      WHERE tp.trick_id = winner.trick_id AND tp.player_id <> winner.player_id
        AND NOT (
          tp.player_id = (SELECT gt.walk_the_plank_target_player_id FROM public.game_tricks gt WHERE gt.id = winner.trick_id)
          AND (tp.card->>'type'='pirate' OR (tp.card->>'type'='tigress' AND tp.tigress_mode='pirate'))
        )
    ) loser ON true GROUP BY winner.player_id
  ),
  raw_scores AS (
    SELECT rp.player_id, pb.bid, pt.tricks_won,
      CASE
        WHEN pb.bid = 0 AND pt.tricks_won = 0 THEN 10 * v_round_number
        WHEN pb.bid = 0 THEN -10 * v_round_number
        WHEN pb.bid = pt.tricks_won THEN 20 * pb.bid
        ELSE -10 * abs(pb.bid - pt.tricks_won)
      END + COALESCE((
        SELECT sum(CASE WHEN pb.bid = pt.tricks_won
          THEN (gt.resolution->'rascal_extra_bet'->>'stake')::integer
          ELSE -((gt.resolution->'rascal_extra_bet'->>'stake')::integer) END)
        FROM public.game_tricks gt
        WHERE gt.round_id = p_round_id
          AND gt.resolution->'rascal_extra_bet'->>'player_id' = rp.player_id::text
      ), 0) AS base_points,
      COALESCE(c.capture_bonus, 0) + COALESCE((
        SELECT sum(gt.bonus_points)::integer FROM public.game_tricks gt
        WHERE gt.round_id = p_round_id AND gt.winner_player_id = rp.player_id
      ), 0) AS bonus_points
    FROM public.room_players rp
    JOIN public.player_bids pb ON pb.round_id = p_round_id AND pb.player_id = rp.player_id
    JOIN player_tricks pt ON pt.player_id = rp.player_id
    LEFT JOIN captured c ON c.player_id = rp.player_id
    WHERE rp.room_id = v_room_id
  )
  INSERT INTO public.player_round_scores (round_id, room_id, player_id, bid, tricks_won, base_points, bonus_points, total_points)
  SELECT p_round_id, v_room_id, player_id, bid, tricks_won, base_points, bonus_points,
    base_points + bonus_points
  FROM raw_scores ON CONFLICT (round_id, player_id) DO NOTHING;

  UPDATE public.player_scores ps
  SET total_score = ps.total_score + prs.total_points,
      rounds_played = ps.rounds_played + 1,
      tricks_won = ps.tricks_won + prs.tricks_won,
      updated_at = now()
  FROM public.player_round_scores prs
  WHERE prs.round_id = p_round_id AND ps.room_id = v_room_id AND ps.player_id = prs.player_id;

  INSERT INTO public.player_scores (room_id, player_id, total_score, rounds_played, tricks_won)
  SELECT v_room_id, prs.player_id, prs.total_points, 1, prs.tricks_won
  FROM public.player_round_scores prs
  WHERE prs.round_id = p_round_id AND NOT EXISTS (
    SELECT 1 FROM public.player_scores ps WHERE ps.room_id = v_room_id AND ps.player_id = prs.player_id
  );

  INSERT INTO public.player_statistics (player_id, games_played, total_points, total_tricks_won)
  SELECT prs.player_id, 0, prs.total_points, prs.tricks_won
  FROM public.player_round_scores prs WHERE prs.round_id = p_round_id
  ON CONFLICT (player_id) DO UPDATE
  SET total_points = public.player_statistics.total_points + EXCLUDED.total_points,
      total_tricks_won = public.player_statistics.total_tricks_won + EXCLUDED.total_tricks_won,
      updated_at = now();

  UPDATE public.game_rounds SET status = 'completed', updated_at = now() WHERE id = p_round_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'player_id', prs.player_id, 'bid', prs.bid, 'tricks_won', prs.tricks_won,
    'base_points', prs.base_points, 'bonus_points', prs.bonus_points, 'total_points', prs.total_points
  ) ORDER BY prs.total_points DESC), '[]'::jsonb)
  INTO v_result FROM public.player_round_scores prs WHERE prs.round_id = p_round_id;

  RETURN jsonb_build_object('success', true, 'round_id', p_round_id, 'scores', v_result);
END;
$function$;
