-- Keep Rosie's backend validation aligned with the game UI:
-- her choice only changes the leader of a following trick in the same round.
CREATE OR REPLACE FUNCTION public.choose_rosie_next_leader(
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
  v_trick_number integer;
  v_round_number integer;
  v_resolution jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Connexion requise.';
  END IF;

  SELECT gt.round_id, gr.room_id, gt.trick_number, gr.round_number, gt.resolution
  INTO v_round_id, v_room_id, v_trick_number, v_round_number, v_resolution
  FROM public.game_tricks gt
  JOIN public.game_rounds gr ON gr.id = gt.round_id
  WHERE gt.id = p_trick_id AND gt.status = 'resolved'
  FOR UPDATE OF gt;

  IF v_round_id IS NULL THEN
    RAISE EXCEPTION 'Pli résolu introuvable.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.room_players rp
    WHERE rp.room_id = v_room_id AND rp.player_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Tu ne participes pas à cette partie.';
  END IF;

  IF v_trick_number >= v_round_number THEN
    RAISE EXCEPTION 'Le pouvoir de Rosie ne peut pas être utilisé après le dernier pli.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(v_resolution->'pirate_power_triggers', '[]'::jsonb)) t
    WHERE t->>'player_id' = v_user_id::text AND t->>'power' = 'rosie'
  ) THEN
    RAISE EXCEPTION 'Tu ne possèdes pas ce pouvoir sur ce pli.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.room_players rp
    WHERE rp.room_id = v_room_id AND rp.player_id = p_target_player_id
  ) THEN
    RAISE EXCEPTION 'Le joueur choisi ne fait pas partie du salon.';
  END IF;

  IF v_resolution ? 'rosie_next_leader_player_id' THEN
    RAISE EXCEPTION 'Le choix de Rosie a déjà été effectué.';
  END IF;

  UPDATE public.game_tricks
  SET resolution = COALESCE(resolution, '{}'::jsonb)
    || jsonb_build_object('rosie_next_leader_player_id', p_target_player_id)
  WHERE id = p_trick_id;

  RETURN jsonb_build_object('success', true, 'leader_player_id', p_target_player_id);
END;
$function$;
