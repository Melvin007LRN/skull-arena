-- Indexes for foreign-key columns identified by the Supabase performance advisor.
-- Existing leading-column indexes are intentionally not duplicated.
CREATE INDEX IF NOT EXISTS idx_game_rooms_host_id ON public.game_rooms (host_id);
CREATE INDEX IF NOT EXISTS idx_game_rounds_leader_player_id ON public.game_rounds (leader_player_id);
CREATE INDEX IF NOT EXISTS idx_game_tricks_leader_player_id ON public.game_tricks (leader_player_id);
CREATE INDEX IF NOT EXISTS idx_game_tricks_walk_the_plank_player_id ON public.game_tricks (walk_the_plank_player_id);
CREATE INDEX IF NOT EXISTS idx_game_tricks_walk_the_plank_target_player_id ON public.game_tricks (walk_the_plank_target_player_id);
CREATE INDEX IF NOT EXISTS idx_game_tricks_winner_player_id ON public.game_tricks (winner_player_id);
CREATE INDEX IF NOT EXISTS idx_player_bids_player_id ON public.player_bids (player_id);
CREATE INDEX IF NOT EXISTS idx_player_hands_player_id ON public.player_hands (player_id);
CREATE INDEX IF NOT EXISTS idx_player_round_scores_player_id ON public.player_round_scores (player_id);
CREATE INDEX IF NOT EXISTS idx_player_round_scores_room_id ON public.player_round_scores (room_id);
CREATE INDEX IF NOT EXISTS idx_room_chat_messages_player_id ON public.room_chat_messages (player_id);
CREATE INDEX IF NOT EXISTS idx_room_players_player_id ON public.room_players (player_id);
CREATE INDEX IF NOT EXISTS idx_trick_plays_player_id ON public.trick_plays (player_id);
