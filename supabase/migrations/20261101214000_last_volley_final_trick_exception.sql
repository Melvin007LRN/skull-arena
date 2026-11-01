-- Sur le dernier pli, Dernière Salve ne demande pas de seconde pose:
-- l'exception officielle évite de demander une carte supplémentaire alors que la main est vide.
DO $fix$
DECLARE v_def text; v_old text; v_new text;
BEGIN
  SELECT pg_get_functiondef('public.play_card(uuid,text,text,integer,text)'::regprocedure) INTO v_def;
  v_old := $a$    WHERE tp.trick_id = v_trick_id
      AND tp.card->>'type' = 'last_volley'
    GROUP BY tp.player_id$a$;
  v_new := $a$    WHERE tp.trick_id = v_trick_id
      AND tp.card->>'type' = 'last_volley'
      AND v_trick_number < v_round_number
    GROUP BY tp.player_id$a$;
  IF position(v_old in v_def)=0 THEN RAISE EXCEPTION 'Queue Last Volley introuvable'; END IF;
  v_def := replace(v_def,v_old,v_new);

  v_old := $a$      WHERE tp.trick_id = v_trick_id AND tp.card->>'type' = 'last_volley'
    ),$a$;
  v_new := $a$      WHERE tp.trick_id = v_trick_id AND tp.card->>'type' = 'last_volley'
        AND v_trick_number < v_round_number
    ),$a$;
  IF position(v_old in v_def)=0 THEN RAISE EXCEPTION 'Compte Last Volley play_card introuvable'; END IF;
  v_def := replace(v_def,v_old,v_new);
  EXECUTE v_def;

  SELECT pg_get_functiondef('public.resolve_game_trick(uuid)'::regprocedure) INTO v_def;
  v_old := $a$  SELECT count(DISTINCT tp.player_id)::integer INTO v_extra_count
  FROM public.trick_plays tp
  WHERE tp.trick_id = p_trick_id AND tp.card->>'type' = 'last_volley';$a$;
  v_new := $a$  SELECT count(DISTINCT tp.player_id)::integer INTO v_extra_count
  FROM public.trick_plays tp
  JOIN public.game_tricks gt ON gt.id = tp.trick_id
  WHERE tp.trick_id = p_trick_id
    AND tp.card->>'type' = 'last_volley'
    AND gt.trick_number < v_round_number;$a$;
  IF position(v_old in v_def)=0 THEN RAISE EXCEPTION 'Compte extra resolve introuvable'; END IF;
  v_def := replace(v_def,v_old,v_new);
  EXECUTE v_def;
END
$fix$;