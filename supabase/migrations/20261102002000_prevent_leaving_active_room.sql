-- Prevent players from leaving a room after the game has started.
-- Lock the room row so this check cannot race with start_room().
CREATE OR REPLACE FUNCTION public.prevent_leaving_active_room()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_room_status text;
BEGIN
  SELECT r.status
  INTO v_room_status
  FROM public.game_rooms AS r
  WHERE r.id = OLD.room_id
  FOR UPDATE;

  IF v_room_status IS DISTINCT FROM 'waiting' THEN
    RAISE EXCEPTION 'Impossible de quitter un salon après le lancement de la partie.';
  END IF;

  RETURN OLD;
END;
$function$;

REVOKE ALL ON FUNCTION public.prevent_leaving_active_room() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.prevent_leaving_active_room() FROM anon;
REVOKE ALL ON FUNCTION public.prevent_leaving_active_room() FROM authenticated;

DROP TRIGGER IF EXISTS trg_prevent_leaving_active_room ON public.room_players;
CREATE TRIGGER trg_prevent_leaving_active_room
BEFORE DELETE ON public.room_players
FOR EACH ROW
EXECUTE FUNCTION public.prevent_leaving_active_room();
