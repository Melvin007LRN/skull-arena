-- Last Volley requires its owner to play twice in the same trick.
-- The RPC enforces turn order and prevents duplicate normal plays; the table
-- constraint must therefore allow a second row for that player.
ALTER TABLE public.trick_plays
  DROP CONSTRAINT IF EXISTS trick_plays_trick_id_player_id_key;

-- A 9-player trick can contain the normal 9 plays plus extra Last Volley plays.
-- Keep a defensive ceiling above the maximum supported room size.
ALTER TABLE public.trick_plays
  DROP CONSTRAINT IF EXISTS trick_plays_play_order_check;

ALTER TABLE public.trick_plays
  ADD CONSTRAINT trick_plays_play_order_check
  CHECK (play_order >= 1 AND play_order <= 18);
