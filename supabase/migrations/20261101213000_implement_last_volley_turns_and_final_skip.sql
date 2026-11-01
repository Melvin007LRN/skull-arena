-- Dernière Salve: un joueur pose une carte supplémentaire après le tour normal,
-- puis ne participe pas au dernier pli de la manche.
DO $migration$
DECLARE
  v_def text;
  v_old text;
  v_new text;
BEGIN
  ALTER TABLE public.game_rounds
    ADD COLUMN IF NOT EXISTS last_volley_skip_player_ids uuid[] NOT NULL DEFAULT '{}'::uuid[];

  SELECT pg_get_functiondef('public.play_card(uuid,text,text,integer,text)'::regprocedure) INTO v_def;

  v_old := $a$  v_previous_winner_id uuid;
BEGIN$a$;
  v_new := $a$  v_previous_winner_id uuid;
  v_round_number integer;
  v_skipped_ids uuid[] := '{}'::uuid[];
  v_normal_count integer;
  v_last_volley_queue uuid[];
  v_extra_index integer;
BEGIN$a$;
  IF position(v_old in v_def)=0 THEN RAISE EXCEPTION 'Déclaration play_card introuvable'; END IF;
  v_def := replace(v_def,v_old,v_new);

  v_old := $a$  SELECT gr.room_id, gr.leader_player_id
  INTO v_room_id, v_leader_id$a$;
  v_new := $a$  SELECT gr.room_id, gr.leader_player_id, gr.round_number,
         COALESCE(gr.last_volley_skip_player_ids, '{}'::uuid[])
  INTO v_room_id, v_leader_id, v_round_number, v_skipped_ids$a$;
  IF position(v_old in v_def)=0 THEN RAISE EXCEPTION 'Lecture manche play_card introuvable'; END IF;
  v_def := replace(v_def,v_old,v_new);

  v_old := $a$  SELECT COUNT(*)::integer
  INTO v_player_count
  FROM public.room_players AS rp
  WHERE rp.room_id = v_room_id;

  IF v_play_count >= v_player_count THEN
    RAISE EXCEPTION 'Toutes les cartes de ce pli ont déjà été posées.';
  END IF;

  -- Détermine le joueur qui doit jouer maintenant.
  SELECT ordered.player_id
  INTO v_expected_player
  FROM (
    SELECT
      rp.player_id,
      ROW_NUMBER() OVER (ORDER BY rp.joined_at, rp.player_id) AS position
    FROM public.room_players AS rp
    WHERE rp.room_id = v_room_id
  ) AS ordered
  JOIN (
    SELECT position
    FROM (
      SELECT
        rp.player_id,
        ROW_NUMBER() OVER (ORDER BY rp.joined_at, rp.player_id) AS position
      FROM public.room_players AS rp
      WHERE rp.room_id = v_room_id
    ) AS positions
    WHERE positions.player_id = v_leader_id
  ) AS leader_position ON true
  WHERE ordered.position =
    ((leader_position.position - 1 + v_play_count)
      % v_player_count) + 1;

  IF v_expected_player IS DISTINCT FROM v_user_id THEN
    RAISE EXCEPTION 'Ce n''est pas ton tour de jouer.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.trick_plays AS tp
    WHERE tp.trick_id = v_trick_id
      AND tp.player_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Tu as déjà joué dans ce pli.';
  END IF;$a$;
  v_new := $a$  SELECT COUNT(*)::integer
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
    GROUP BY tp.player_id
  ) q;

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
  END IF;$a$;
  IF position(v_old in v_def)=0 THEN RAISE EXCEPTION 'Bloc ordre play_card introuvable'; END IF;
  v_def := replace(v_def,v_old,v_new);

  v_old := $a$  -- Retire uniquement la carte jouée de la main du joueur.
  UPDATE public.player_hands AS ph$a$;
  v_new := $a$  IF v_card->>'type' = 'last_volley' AND v_trick_number < v_round_number THEN
    UPDATE public.game_rounds gr
    SET last_volley_skip_player_ids = CASE
      WHEN v_user_id = ANY(COALESCE(gr.last_volley_skip_player_ids, '{}'::uuid[]))
        THEN COALESCE(gr.last_volley_skip_player_ids, '{}'::uuid[])
      ELSE array_append(COALESCE(gr.last_volley_skip_player_ids, '{}'::uuid[]), v_user_id)
    END
    WHERE gr.id = p_round_id;
  END IF;

  -- Retire uniquement la carte jouée de la main du joueur.
  UPDATE public.player_hands AS ph$a$;
  IF position(v_old in v_def)=0 THEN RAISE EXCEPTION 'Bloc retrait carte play_card introuvable'; END IF;
  v_def := replace(v_def,v_old,v_new);

  v_old := $a$    'all_players_played', v_order = v_player_count
  );$a$;
  v_new := $a$    'all_players_played', v_order >= v_normal_count + (
      SELECT count(DISTINCT tp.player_id)
      FROM public.trick_plays tp
      WHERE tp.trick_id = v_trick_id AND tp.card->>'type' = 'last_volley'
    ),
    'normal_players_count', v_normal_count,
    'last_volley_extra_count', (
      SELECT count(DISTINCT tp.player_id)
      FROM public.trick_plays tp
      WHERE tp.trick_id = v_trick_id AND tp.card->>'type' = 'last_volley'
    )
  );$a$;
  IF position(v_old in v_def)=0 THEN RAISE EXCEPTION 'Retour play_card introuvable'; END IF;
  v_def := replace(v_def,v_old,v_new);
  EXECUTE v_def;

  SELECT pg_get_functiondef('public.resolve_game_trick(uuid)'::regprocedure) INTO v_def;
  v_old := $a$  v_mary_throne_winner uuid;
BEGIN$a$;
  v_new := $a$  v_mary_throne_winner uuid;
  v_round_number integer;
  v_skipped_ids uuid[] := '{}'::uuid[];
  v_normal_count integer;
  v_extra_count integer;
  v_expected_count integer;
BEGIN$a$;
  IF position(v_old in v_def)=0 THEN RAISE EXCEPTION 'Déclaration resolve introuvable'; END IF;
  v_def := replace(v_def,v_old,v_new);

  v_old := $a$  SELECT gt.round_id, gr.room_id, gt.walk_the_plank_target_player_id
    INTO v_round_id, v_room_id, v_target_id
  FROM public.game_tricks gt
  JOIN public.game_rounds gr ON gr.id=gt.round_id
  WHERE gt.id=p_trick_id AND gt.status='playing'
  FOR UPDATE OF gt;$a$;
  v_new := $a$  SELECT gt.round_id, gr.room_id, gt.walk_the_plank_target_player_id,
         gr.round_number, COALESCE(gr.last_volley_skip_player_ids, '{}'::uuid[])
    INTO v_round_id, v_room_id, v_target_id, v_round_number, v_skipped_ids
  FROM public.game_tricks gt
  JOIN public.game_rounds gr ON gr.id=gt.round_id
  WHERE gt.id=p_trick_id AND gt.status='playing'
  FOR UPDATE OF gt;$a$;
  IF position(v_old in v_def)=0 THEN RAISE EXCEPTION 'Lecture round resolve introuvable'; END IF;
  v_def := replace(v_def,v_old,v_new);

  v_old := $a$  IF v_player_count=0 OR v_play_count<>v_player_count THEN
    RETURN jsonb_build_object('success',false,'message','En attente des cartes de tous les joueurs.');
  END IF;$a$;
  v_new := $a$  v_normal_count := v_player_count;
  IF EXISTS (
    SELECT 1 FROM public.game_tricks gt
    WHERE gt.id = p_trick_id AND gt.trick_number = v_round_number
  ) THEN
    SELECT count(*)::integer INTO v_normal_count
    FROM public.room_players rp
    WHERE rp.room_id = v_room_id
      AND NOT (rp.player_id = ANY(v_skipped_ids));
  END IF;

  SELECT count(DISTINCT tp.player_id)::integer INTO v_extra_count
  FROM public.trick_plays tp
  WHERE tp.trick_id = p_trick_id AND tp.card->>'type' = 'last_volley';

  v_expected_count := v_normal_count + v_extra_count;
  IF v_player_count=0 OR v_play_count<>v_expected_count THEN
    RETURN jsonb_build_object('success',false,'message','En attente des cartes de tous les joueurs.',
      'plays_count',v_play_count,'expected_count',v_expected_count);
  END IF;$a$;
  IF position(v_old in v_def)=0 THEN RAISE EXCEPTION 'Contrôle nombre resolve introuvable'; END IF;
  v_def := replace(v_def,v_old,v_new);
  EXECUTE v_def;
END
$migration$;