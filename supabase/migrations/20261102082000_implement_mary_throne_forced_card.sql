ALTER TABLE public.player_hands
  ADD COLUMN IF NOT EXISTS pending_forced_card_id text;

CREATE OR REPLACE FUNCTION public.choose_mary_throne_target(p_trick_id uuid, p_target_player_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_room_id uuid;
  v_round_id uuid;
  v_trick_number integer;
  v_resolution jsonb;
  v_card_id text;
  v_hand jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Connexion requise.'; END IF;
  SELECT gt.round_id, gr.room_id, gt.trick_number, gt.resolution
    INTO v_round_id, v_room_id, v_trick_number, v_resolution
  FROM public.game_tricks gt
  JOIN public.game_rounds gr ON gr.id = gt.round_id
  WHERE gt.id = p_trick_id AND gt.status = 'resolved'
  FOR UPDATE OF gt;
  IF v_round_id IS NULL THEN RAISE EXCEPTION 'Pli introuvable ou non résolu.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.room_players WHERE room_id=v_room_id AND player_id=v_uid)
    THEN RAISE EXCEPTION 'Tu ne participes pas à cette partie.'; END IF;
  IF (v_resolution->>'mary_throne_winner_player_id') IS DISTINCT FROM v_uid::text
    THEN RAISE EXCEPTION 'Seul le gagnant de Mary Throne peut choisir une cible.'; END IF;
  IF v_resolution ? 'mary_throne_target_player_id'
    THEN RAISE EXCEPTION 'Le pouvoir de Mary Throne a déjà été utilisé.'; END IF;
  IF p_target_player_id = v_uid OR NOT EXISTS (
    SELECT 1 FROM public.room_players WHERE room_id=v_room_id AND player_id=p_target_player_id
  ) THEN RAISE EXCEPTION 'Choisis un autre joueur de cette partie.'; END IF;
  IF EXISTS (SELECT 1 FROM public.game_tricks WHERE round_id=v_round_id AND trick_number=v_trick_number+1)
    THEN RAISE EXCEPTION 'Le pli suivant a déjà commencé.'; END IF;
  SELECT cards INTO v_hand FROM public.player_hands
  WHERE round_id=v_round_id AND player_id=p_target_player_id FOR UPDATE;
  IF v_hand IS NULL OR jsonb_array_length(v_hand)=0 THEN RAISE EXCEPTION 'La main de ce joueur est vide.'; END IF;
  SELECT item->>'id' INTO v_card_id
  FROM jsonb_array_elements(v_hand) item ORDER BY random() LIMIT 1;
  UPDATE public.player_hands SET pending_forced_card_id=v_card_id
  WHERE round_id=v_round_id AND player_id=p_target_player_id;
  UPDATE public.game_tricks SET resolution=COALESCE(resolution,'{}'::jsonb)||jsonb_build_object(
    'mary_throne_target_player_id',p_target_player_id,
    'mary_throne_forced_card_assigned',true
  ) WHERE id=p_trick_id;
  RETURN jsonb_build_object('success',true,'target_player_id',p_target_player_id);
END;
$function$;


CREATE OR REPLACE FUNCTION public.play_card(p_round_id uuid, p_card_id text, p_tigress_mode text DEFAULT NULL::text, p_chosen_value integer DEFAULT NULL::integer, p_chosen_suit text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_room_id uuid;
  v_leader_id uuid;
  v_player_count integer;
  v_play_count integer;
  v_expected_player uuid;
  v_trick_id uuid;
  v_trick_number integer;
  v_hand jsonb;
  v_card jsonb;
  v_plays jsonb;
  v_lead_suit text;
  v_has_lead_suit boolean;
  v_effective_type text;
  v_order integer;
  v_extension text;
  v_trick_leader_id uuid;
  v_previous_trick_status text;
  v_previous_winner_id uuid;
  v_round_number integer;
  v_skipped_ids uuid[] := '{}'::uuid[];
  v_normal_count integer;
  v_last_volley_queue uuid[];
  v_extra_index integer;
  v_forced_card_id text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Connexion requise.';
  END IF;

  -- Verrouille la manche pour éviter deux poses simultanées.
  SELECT gr.room_id, gr.leader_player_id, gr.round_number,
         COALESCE(gr.last_volley_skip_player_ids, '{}'::uuid[])
  INTO v_room_id, v_leader_id, v_round_number, v_skipped_ids
  FROM public.game_rounds AS gr
  WHERE gr.id = p_round_id
    AND gr.status = 'playing'
  FOR UPDATE;

  IF v_room_id IS NULL THEN
    RAISE EXCEPTION 'Manche introuvable ou inactive.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.room_players AS rp
    WHERE rp.room_id = v_room_id
      AND rp.player_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Tu ne participes pas à cette manche.';
  END IF;

  -- Récupère et verrouille la main du joueur.
  SELECT ph.cards
  INTO v_hand
  FROM public.player_hands AS ph
  WHERE ph.round_id = p_round_id
    AND ph.player_id = v_user_id
  FOR UPDATE;

  IF v_hand IS NULL THEN
    RAISE EXCEPTION 'Main du joueur introuvable.';
  END IF;

  SELECT item
  INTO v_card
  FROM jsonb_array_elements(v_hand) AS item
  WHERE item->>'id' = p_card_id
  LIMIT 1;

  IF v_card IS NULL THEN
    RAISE EXCEPTION 'Cette carte ne se trouve pas dans ta main.';
  END IF;

  SELECT ph.pending_forced_card_id INTO v_forced_card_id
  FROM public.player_hands ph
  WHERE ph.round_id = p_round_id AND ph.player_id = v_user_id;

  IF v_forced_card_id IS NOT NULL AND p_card_id <> v_forced_card_id THEN
    RAISE EXCEPTION 'Mary Throne t''impose de jouer la carte tirée au sort.';
  END IF;

  -- Vérifie le mode de la Tigresse.
  IF v_card->>'type' = 'tigress' THEN
    IF p_tigress_mode NOT IN ('pirate', 'escape') THEN
      RAISE EXCEPTION 'Choisis Pirate ou Fuite pour la Tigresse.';
    END IF;
  ELSIF p_tigress_mode IS NOT NULL THEN
    RAISE EXCEPTION 'Le mode Tigresse est réservé à la Tigresse.';
  END IF;

  -- Vérifie les valeurs sélectionnables.
  IF v_card ? 'selectableValue'
     AND jsonb_typeof(v_card->'selectableValue') = 'array'
     AND jsonb_array_length(v_card->'selectableValue') > 0 THEN
    IF p_chosen_value IS NULL OR NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements_text(v_card->'selectableValue') AS val
      WHERE val::integer = p_chosen_value
    ) THEN
      RAISE EXCEPTION 'Valeur choisie invalide pour cette carte.';
    END IF;
  ELSIF p_chosen_value IS NOT NULL THEN
    RAISE EXCEPTION 'Cette carte ne permet pas de choisir une valeur.';
  END IF;

  -- Vérifie le Joker. Si le noir a déjà été demandé, aucune couleur ne doit être déclarée.
  IF v_card->>'type' = 'joker' THEN
    SELECT CASE
      WHEN first_play.card->>'type' = 'number' THEN first_play.card->>'suit'
      WHEN first_play.card->>'type' = 'joker' THEN first_play.chosen_suit
      ELSE NULL
    END
    INTO v_lead_suit
    FROM public.game_tricks active_trick
    JOIN LATERAL (
      SELECT tp.card, tp.chosen_suit
      FROM public.trick_plays tp
      WHERE tp.trick_id = active_trick.id
        AND tp.card->>'type' IN ('number', 'joker')
      ORDER BY tp.play_order
      LIMIT 1
    ) first_play ON true
    WHERE active_trick.round_id = p_round_id
      AND active_trick.status = 'playing'
    ORDER BY active_trick.trick_number DESC
    LIMIT 1;

    IF v_lead_suit = 'black' THEN
      IF p_chosen_suit IS NOT NULL THEN
        RAISE EXCEPTION 'Quand le noir est demandé, le Joker ne déclare aucune couleur.';
      END IF;
    ELSIF p_chosen_suit NOT IN ('green', 'purple', 'yellow') THEN
      RAISE EXCEPTION 'Le Joker doit choisir une couleur valide.';
    END IF;
  ELSIF p_chosen_suit IS NOT NULL THEN
    RAISE EXCEPTION 'Le choix de couleur est réservé au Joker.';
  END IF;

  -- Vérifie que l'extension de la carte est activée.
  v_extension := v_card->>'extension';

  IF v_extension IS NOT NULL THEN
    IF NOT COALESCE(
      (SELECT (room.extensions->>v_extension)::boolean
       FROM public.game_rooms AS room
       WHERE room.id = v_room_id),
      false
    ) THEN
      RAISE EXCEPTION 'Cette extension est désactivée.';
    END IF;
  END IF;

  -- Récupère le pli en cours ou crée le premier pli.
  SELECT gt.id, gt.trick_number, gt.leader_player_id
  INTO v_trick_id, v_trick_number, v_trick_leader_id
  FROM public.game_tricks AS gt
  WHERE gt.round_id = p_round_id
    AND gt.status = 'playing'
  ORDER BY gt.trick_number DESC
  LIMIT 1;

  IF v_trick_id IS NULL THEN
    -- v_leader_id conserve le capitaine de la manche si aucun pli actif n'existe.
    IF v_leader_id IS NULL THEN
      RAISE EXCEPTION 'Le premier joueur de la manche est introuvable.';
    END IF;

    -- Si un pli précédent existe, il doit être résolu.
    -- Son gagnant devient le meneur du nouveau pli.
    SELECT gt.status, gt.winner_player_id
    INTO v_previous_trick_status, v_previous_winner_id
    FROM public.game_tricks AS gt
    WHERE gt.round_id = p_round_id
    ORDER BY gt.trick_number DESC
    LIMIT 1;

    IF FOUND THEN
      IF v_previous_trick_status <> 'resolved'
         OR v_previous_winner_id IS NULL THEN
        RAISE EXCEPTION 'Le pli précédent doit être résolu avant de continuer.';
      END IF;


      v_leader_id := v_previous_winner_id;

      -- Rosie peut désigner le meneur du pli suivant.
      IF EXISTS (
        SELECT 1
        FROM public.game_tricks AS previous_trick
        CROSS JOIN LATERAL jsonb_array_elements(
          COALESCE(previous_trick.resolution->'pirate_power_triggers', '[]'::jsonb)
        ) AS trigger_item
        WHERE previous_trick.round_id = p_round_id
          AND previous_trick.trick_number = (
            SELECT MAX(last_trick.trick_number)
            FROM public.game_tricks AS last_trick
            WHERE last_trick.round_id = p_round_id
          )
          AND trigger_item->>'power' = 'rosie'
      ) THEN
        SELECT (previous_trick.resolution->>'rosie_next_leader_player_id')::uuid
        INTO v_leader_id
        FROM public.game_tricks AS previous_trick
        WHERE previous_trick.round_id = p_round_id
        ORDER BY previous_trick.trick_number DESC
        LIMIT 1;

        IF v_leader_id IS NULL THEN
          RAISE EXCEPTION 'Rosie doit choisir le meneur du prochain pli.';
        END IF;
      END IF;

    END IF;

    SELECT COALESCE(MAX(gt.trick_number), 0) + 1
    INTO v_trick_number
    FROM public.game_tricks AS gt
    WHERE gt.round_id = p_round_id;

    v_trick_id := gen_random_uuid();

    INSERT INTO public.game_tricks (
      id, round_id, trick_number, status,
      leader_player_id, created_at
    )
    VALUES (
      v_trick_id, p_round_id, v_trick_number,
      'playing', v_leader_id, now()
    );
  ELSE
    -- Un pli existe : son meneur devient la référence du tour.
    v_leader_id := v_trick_leader_id;
  END IF;

  -- Compte les cartes déjà posées.
  SELECT COUNT(*)::integer
  INTO v_play_count
  FROM public.trick_plays AS tp
  WHERE tp.trick_id = v_trick_id;

  SELECT COUNT(*)::integer
  INTO v_player_count
  FROM public.room_players AS rp
  WHERE rp.room_id = v_room_id;

  v_normal_count := v_player_count;
  IF v_trick_number = v_round_number THEN
    SELECT count(*)::integer INTO v_normal_count
    FROM public.room_players rp
    WHERE rp.room_id = v_room_id
      AND NOT (rp.player_id = ANY(v_skipped_ids));
  END IF;

  IF v_normal_count <= 0 THEN
    RAISE EXCEPTION 'Aucun joueur disponible pour ce pli.';
  END IF;

  SELECT COALESCE(array_agg(q.player_id ORDER BY q.first_order), '{}'::uuid[])
  INTO v_last_volley_queue
  FROM (
    SELECT tp.player_id, min(tp.play_order) AS first_order
    FROM public.trick_plays tp
    WHERE tp.trick_id = v_trick_id
      AND tp.card->>'type' = 'last_volley'
      AND v_trick_number < v_round_number
    GROUP BY tp.player_id
  ) q;

  -- D'abord, chaque joueur autorisé joue une fois dans l'ordre du meneur.
  IF v_play_count < v_normal_count THEN
    WITH ordered AS (
      SELECT rp.player_id,
        row_number() OVER (ORDER BY rp.joined_at, rp.player_id) AS pos
      FROM public.room_players rp
      WHERE rp.room_id = v_room_id
    ), leader AS (
      SELECT pos FROM ordered WHERE player_id = v_leader_id
    ), eligible AS (
      SELECT o.player_id,
        row_number() OVER (
          ORDER BY ((o.pos - leader.pos + v_player_count) % v_player_count)
        ) AS turn_pos
      FROM ordered o CROSS JOIN leader
      WHERE v_trick_number <> v_round_number
         OR NOT (o.player_id = ANY(v_skipped_ids))
    )
    SELECT player_id INTO v_expected_player
    FROM eligible WHERE turn_pos = v_play_count + 1;
  ELSE
    -- Ensuite, les détenteurs de Last Volley rejouent dans l'ordre où ils l'ont posée.
    v_extra_index := v_play_count - v_normal_count + 1;
    v_expected_player := v_last_volley_queue[v_extra_index];
    IF v_expected_player IS NULL THEN
      RAISE EXCEPTION 'Aucune carte supplémentaire Dernière Salve n''est attendue.';
    END IF;
  END IF;

  IF v_expected_player IS DISTINCT FROM v_user_id THEN
    RAISE EXCEPTION 'Ce n''est pas ton tour de jouer.';
  END IF;

  IF v_play_count < v_normal_count AND EXISTS (
    SELECT 1 FROM public.trick_plays tp
    WHERE tp.trick_id = v_trick_id AND tp.player_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Tu as déjà joué dans ce pli.';
  END IF;

  -- Détermine la couleur demandée par le pli.
  SELECT
    CASE
      WHEN tp.card->>'type' = 'tigress'
        THEN CASE WHEN tp.tigress_mode = 'escape'
                  THEN 'escape' ELSE 'pirate' END
      ELSE tp.card->>'type'
    END,
    CASE
      WHEN tp.card->>'type' = 'joker'
        THEN tp.chosen_suit
      ELSE tp.card->>'suit'
    END
  INTO v_effective_type, v_lead_suit
  FROM public.trick_plays AS tp
  WHERE tp.trick_id = v_trick_id
  ORDER BY tp.play_order
  LIMIT 1;

  -- Une carte spéciale en tête peut neutraliser la couleur pour tout le pli.
  -- La Tigresse jouée en Pirate compte comme un Pirate.
  SELECT
    CASE
      WHEN tp.card->>'type' = 'tigress' AND tp.tigress_mode = 'pirate'
        THEN 'pirate'
      ELSE tp.card->>'type'
    END
  INTO v_effective_type
  FROM public.trick_plays AS tp
  WHERE tp.trick_id = v_trick_id
  ORDER BY tp.play_order
  LIMIT 1;

  IF v_effective_type IN ('pirate', 'skull_king', 'second') THEN
    v_lead_suit := NULL;
  ELSE
    -- Sinon, la première carte numérique/Joker valide fixe la couleur.
    SELECT
      CASE
        WHEN tp.card->>'type' = 'joker' THEN 'joker'
        ELSE 'number'
      END,
      CASE
        WHEN tp.card->>'type' = 'joker' THEN tp.chosen_suit
        ELSE tp.card->>'suit'
      END
    INTO v_effective_type, v_lead_suit
    FROM public.trick_plays AS tp
    WHERE tp.trick_id = v_trick_id
      AND tp.card->>'type' IN ('number', 'joker')
      AND (
        tp.card->>'type' <> 'joker'
        OR tp.chosen_suit IN ('green', 'purple', 'yellow')
      )
    ORDER BY tp.play_order
    LIMIT 1;
  END IF;

  -- Contrôle le suivi de couleur pour les cartes numériques.
  IF v_card->>'type' = 'number' AND v_lead_suit IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(v_hand) AS hand_card
      WHERE
        (hand_card->>'type' = 'number'
          AND hand_card->>'suit' = v_lead_suit)
        OR (hand_card->>'type' = 'joker' AND v_lead_suit <> 'black')
    )
    INTO v_has_lead_suit;

    IF v_has_lead_suit AND v_card->>'suit' <> v_lead_suit THEN
      RAISE EXCEPTION 'Tu dois suivre la couleur %.', v_lead_suit;
    END IF;
  END IF;

  -- Le Joker doit suivre la couleur demandée si elle existe.
  IF v_card->>'type' = 'joker'
     AND v_lead_suit IS NOT NULL
     AND v_lead_suit <> 'black'
     AND p_chosen_suit <> v_lead_suit THEN
    RAISE EXCEPTION 'Ton Joker doit suivre la couleur %.', v_lead_suit;
  END IF;

  v_order := v_play_count + 1;

  INSERT INTO public.trick_plays (
    id, trick_id, player_id, card, play_order,
    tigress_mode, chosen_value, chosen_suit
  )
  VALUES (
    gen_random_uuid(), v_trick_id, v_user_id, v_card,
    v_order, p_tigress_mode, p_chosen_value, p_chosen_suit
  );

  -- Une Dernière Salve utilisée avant le dernier pli réserve un saut du dernier pli.
  IF v_card->>'type' = 'last_volley' AND v_trick_number < v_round_number THEN
    UPDATE public.game_rounds gr
    SET last_volley_skip_player_ids = CASE
      WHEN v_user_id = ANY(COALESCE(gr.last_volley_skip_player_ids, '{}'::uuid[]))
        THEN COALESCE(gr.last_volley_skip_player_ids, '{}'::uuid[])
      ELSE array_append(COALESCE(gr.last_volley_skip_player_ids, '{}'::uuid[]), v_user_id)
    END
    WHERE gr.id = p_round_id;
  END IF;

  -- Retire uniquement la carte jouée de la main du joueur.
  UPDATE public.player_hands AS ph
  SET cards = (
    SELECT COALESCE(jsonb_agg(hand_card), '[]'::jsonb)
    FROM jsonb_array_elements(ph.cards) AS hand_card
    WHERE hand_card->>'id' <> p_card_id
  )
  WHERE ph.round_id = p_round_id
    AND ph.player_id = v_user_id;

  IF v_forced_card_id = p_card_id THEN
    UPDATE public.player_hands
    SET pending_forced_card_id = NULL
    WHERE round_id = p_round_id AND player_id = v_user_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'trick_id', v_trick_id,
    'play_order', v_order,
    'plays_count', v_order,
    'players_count', v_player_count,
    'all_players_played', v_order >= v_normal_count + (
      SELECT count(DISTINCT tp.player_id)
      FROM public.trick_plays tp
      WHERE tp.trick_id = v_trick_id AND tp.card->>'type' = 'last_volley'
        AND v_trick_number < v_round_number
    ),
    'normal_players_count', v_normal_count,
    'last_volley_extra_count', (
      SELECT count(DISTINCT tp.player_id)
      FROM public.trick_plays tp
      WHERE tp.trick_id = v_trick_id AND tp.card->>'type' = 'last_volley'
    )
  );
END;
$function$
