-- Mary Throne (règle du livret français) :
-- le gagnant choisit un adversaire ; une carte aléatoire de sa main
-- est réservée secrètement pour être jouée à la manche suivante.
CREATE TABLE IF NOT EXISTS public.mary_throne_forced_plays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.game_rooms(id) ON DELETE CASCADE,
  source_round_id uuid NOT NULL REFERENCES public.game_rounds(id) ON DELETE CASCADE,
  source_trick_id uuid NOT NULL REFERENCES public.game_tricks(id) ON DELETE CASCADE,
  source_player_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_player_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_round_id uuid REFERENCES public.game_rounds(id) ON DELETE CASCADE,
  card jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','ready','played','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  played_at timestamptz,
  CONSTRAINT mary_throne_not_self CHECK (source_player_id <> target_player_id)
);

CREATE INDEX IF NOT EXISTS mary_throne_forced_plays_target_idx
  ON public.mary_throne_forced_plays(target_player_id, status);
CREATE INDEX IF NOT EXISTS mary_throne_forced_plays_source_round_idx
  ON public.mary_throne_forced_plays(source_round_id, status);

ALTER TABLE public.mary_throne_forced_plays ENABLE ROW LEVEL SECURITY;
-- No direct client policies: private card data is accessed only through
-- authenticated, membership-checked RPCs.

CREATE OR REPLACE FUNCTION public.choose_mary_throne_target(
  p_trick_id uuid,
  p_target_player_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_room_id uuid;
  v_round_id uuid;
  v_round_number integer;
  v_trick_number integer;
  v_extensions jsonb;
  v_winner_id uuid;
  v_hand jsonb;
  v_card jsonb;
  v_card_id text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Connexion requise.';
  END IF;

  SELECT gr.room_id, gr.id, gr.round_number, gt.trick_number,
         room.extensions, gt.winner_player_id
    INTO v_room_id, v_round_id, v_round_number, v_trick_number,
         v_extensions, v_winner_id
  FROM public.game_tricks gt
  JOIN public.game_rounds gr ON gr.id = gt.round_id
  JOIN public.game_rooms room ON room.id = gr.room_id
  WHERE gt.id = p_trick_id
    AND gt.status = 'resolved'
    AND gt.resolution->>'mary_throne_winner_player_id' = v_user_id::text
  FOR UPDATE OF gt, gr;

  IF v_round_id IS NULL OR v_winner_id IS DISTINCT FROM v_user_id THEN
    RAISE EXCEPTION 'Seul le gagnant de Mary Throne peut choisir un adversaire.';
  END IF;

  IF v_round_number >= 10
     OR v_trick_number >= v_round_number
     OR NOT COALESCE((v_extensions->>'expansion_2025')::boolean, false)
     OR NOT EXISTS (
       SELECT 1 FROM public.game_rounds
       WHERE id = v_round_id AND status = 'playing'
     ) THEN
    RAISE EXCEPTION 'Mary Throne ne peut être utilisée que si son extension est active et qu''une manche suivante existe.';
  END IF;

  IF p_target_player_id IS NULL OR p_target_player_id = v_user_id
     OR NOT EXISTS (
       SELECT 1 FROM public.room_players
       WHERE room_id = v_room_id AND player_id = p_target_player_id
     ) THEN
    RAISE EXCEPTION 'Choisis un autre joueur de cette partie.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.mary_throne_forced_plays
    WHERE source_trick_id = p_trick_id
  ) THEN
    RAISE EXCEPTION 'Le pouvoir de Mary Throne a déjà été utilisé.';
  END IF;

  SELECT cards INTO v_hand
  FROM public.player_hands
  WHERE round_id = v_round_id AND player_id = p_target_player_id
  FOR UPDATE;

  IF v_hand IS NULL OR jsonb_array_length(v_hand) = 0 THEN
    RAISE EXCEPTION 'Ce joueur n’a plus de carte en main.';
  END IF;

  SELECT item INTO v_card
  FROM jsonb_array_elements(v_hand) AS item
  ORDER BY random()
  LIMIT 1;

  v_card_id := v_card->>'id';
  IF v_card_id IS NULL THEN
    RAISE EXCEPTION 'Carte sélectionnée invalide.';
  END IF;

  UPDATE public.player_hands
  SET cards = (
    SELECT COALESCE(jsonb_agg(item), '[]'::jsonb)
    FROM jsonb_array_elements(cards) AS item
    WHERE item->>'id' <> v_card_id
  ), updated_at = now()
  WHERE round_id = v_round_id AND player_id = p_target_player_id;

  INSERT INTO public.mary_throne_forced_plays(
    room_id, source_round_id, source_trick_id,
    source_player_id, target_player_id, card
  ) VALUES (
    v_room_id, v_round_id, p_trick_id,
    v_user_id, p_target_player_id, v_card
  );

  RETURN jsonb_build_object(
    'success', true,
    'target_player_id', p_target_player_id,
    'card_reserved', true
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.choose_mary_throne_target(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.choose_mary_throne_target(uuid, uuid) TO authenticated;

-- When the next round is created, bind the secret card to that round.
CREATE OR REPLACE FUNCTION public.bind_mary_throne_forced_plays()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  UPDATE public.mary_throne_forced_plays
  SET target_round_id = NEW.id,
      status = 'ready'
  WHERE room_id = NEW.room_id
    AND source_round_id = (
      SELECT previous.id
      FROM public.game_rounds previous
      WHERE previous.room_id = NEW.room_id
        AND previous.round_number = NEW.round_number - 1
      LIMIT 1
    )
    AND status = 'pending';
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS bind_mary_throne_forced_plays_on_round
  ON public.game_rounds;
CREATE TRIGGER bind_mary_throne_forced_plays_on_round
AFTER INSERT ON public.game_rounds
FOR EACH ROW EXECUTE FUNCTION public.bind_mary_throne_forced_plays();
