-- Correct suit-following when a special card opens a trick.
-- If the first card is a Pirate (including Tigress played as Pirate),
-- Skull King, or Second, no suit is led for the entire trick.
DO $migration$
DECLARE
  v_definition text;
  v_old text := $old$
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
$old$;
  v_new text := $new$
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
$new$;
BEGIN
  SELECT pg_get_functiondef(
    'public.play_card(uuid,text,text,integer,text)'::regprocedure
  )
  INTO v_definition;

  IF position(v_old IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Bloc de suivi de couleur inattendu : migration annulée.';
  END IF;

  v_definition := replace(v_definition, v_old, v_new);
  EXECUTE v_definition;
END
$migration$;

-- Keep the RPC restricted to authenticated players.
REVOKE ALL ON FUNCTION public.play_card(uuid, text, text, integer, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.play_card(uuid, text, text, integer, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.play_card(uuid, text, text, integer, text) TO authenticated;
