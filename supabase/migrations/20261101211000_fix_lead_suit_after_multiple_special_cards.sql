DO $migration$
DECLARE
  v_definition text;
  v_old text := $old$
  IF v_play_count = 0 THEN
    v_lead_suit := NULL;
  ELSIF v_effective_type IN ('escape', 'loot') THEN
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
    OFFSET 1
    LIMIT 1;
  END IF;

  -- Une carte spéciale en première position ne fixe pas de couleur.
  IF v_play_count > 0 AND v_lead_suit IS NOT NULL
     AND v_effective_type IN ('number', 'joker') THEN
    -- La couleur est déjà déterminée.
    NULL;
  ELSIF v_play_count > 0 AND v_lead_suit IS NULL THEN
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
      AND (
        tp.card->>'type' IN ('number', 'joker')
        OR (tp.card->>'type' = 'tigress' AND tp.tigress_mode = 'escape')
      )
    ORDER BY tp.play_order
    LIMIT 1;
  END IF;
$old$;
  v_new text := $new$
  -- La couleur demandée est la première couleur numérique/Joker réellement jouée.
  -- Les Fuites, cartes de butin et autres cartes spéciales ne la fixent jamais.
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
$new$;
BEGIN
  SELECT pg_get_functiondef('public.play_card(uuid,text,text,integer,text)'::regprocedure)
  INTO v_definition;
  IF position(v_old in v_definition) = 0 THEN
    RAISE EXCEPTION 'Bloc attendu introuvable : aucune modification appliquée.';
  END IF;
  v_definition := replace(v_definition, v_old, v_new);
  EXECUTE v_definition;
END
$migration$;
