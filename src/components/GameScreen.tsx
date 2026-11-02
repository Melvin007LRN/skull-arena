import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  Anchor,
  ArrowLeft,
  Crown,
  RefreshCw,
  Shield,
  Skull,
  Swords,
  Users,
  Check,
  Lock,
  Eye,
  Minus,
  Plus,
  X,
  Play,
} from "lucide-react";
import { supabase } from "../lib/supabase";

type GameCard = {
  id: string;
  name: string;
  type: string;
  suit?: string;
  value?: number;
  selectableValue?: number[];
  extension?: string;
  isExpansionCard?: boolean;
  piratePower?: string;
};

type GamePlayer = {
  player_id: string;
  username: string;
  isHost: boolean;
  avatar_url?: string | null;
};

type GameRound = {
  id: string;
  room_id: string;
  round_number: number;
  status: string;
  leader_player_id: string | null;
  last_volley_skip_player_ids?: string[];
};

type BidProgress = {
  player_id: string;
  username: string;
  has_bid: boolean;
};

type RevealedBid = {
  player_id: string;
  username: string;
  bid: number;
};

type PlayedCard = {
  id: string;
  player_id: string;
  card: GameCard;
  play_order: number;
  tigress_mode: string | null;
  chosen_value: number | null;
  chosen_suit: string | null;
};

type CurrentTrick = {
  id: string;
  trick_number: number;
  status: string;
  leader_player_id: string;
  resolution: {
    status?: string;
    walk_the_plank_player_id?: string;
    walk_the_plank_target_player_id?: string;
  } | null;
  walk_the_plank_player_id: string | null;
  walk_the_plank_target_player_id: string | null;
};

type ScoreboardEntry = {
  player_id: string;
  username: string;
  total_score: number;
  rounds_played: number;
  tricks_won: number;
  games_won: number;
  rank_position: number;
};

type RoundSummaryEntry = {
  player_id: string;
  username: string;
  bid: number;
  tricks_won: number;
  base_points: number;
  bonus_points: number;
  total_points: number;
};

type GameScreenProps = {
  roomId: string;
  onExit: () => void;
};

const suitColors: Record<string, string> = {
  green: "#21c77a",
  purple: "#a879ff",
  yellow: "#f6c94c",
  black: "#aab0bc",
};

const suitNames: Record<string, string> = {
  green: "VERT",
  purple: "VIOLET",
  yellow: "JAUNE",
  black: "NOIR",
};

const cardTypeNames: Record<string, string> = {
  number: "CARTE NUMÉRIQUE",
  escape: "FUITE",
  pirate: "PIRATE",
  tigress: "TIGRESSE",
  mermaid: "SIRÈNE",
  skull_king: "SKULL KING",
  loot: "TRÉSOR",
  kraken: "KRAKEN",
  white_whale: "BALEINE BLANCHE",
  joker: "JOKER",
  last_volley: "DERNIÈRE VOLÉE",
  second: "SECOND",
  spotted_stingray: "RAIE TACHETÉE",
  davys_locker: "CASIER DE DAVY JONES",
  walk_the_plank: "SUPPLICE DE LA PLANCHE",
};

function cardSymbol(type: string) {
  switch (type) {
    case "escape":
      return "⚓";
    case "pirate":
    case "tigress":
      return "☠";
    case "mermaid":
      return "🧜";
    case "skull_king":
      return "👑";
    case "kraken":
      return "🐙";
    case "white_whale":
      return "🐋";
    case "loot":
      return "💰";
    case "second":
      return "⚔";
    default:
      return "★";
  }
}

export default function GameScreen({
  roomId,
  onExit,
}: GameScreenProps) {
  const [userId, setUserId] = useState("");
  const [roomName, setRoomName] = useState("SKULL ARENA");
  const [roomStatus, setRoomStatus] = useState("waiting");
  const [countdownEndsAt, setCountdownEndsAt] = useState<string | null>(null);
  const [countdownValue, setCountdownValue] = useState<number | null>(null);
  const [showGo, setShowGo] = useState(false);
  const [quickPhrases, setQuickPhrases] = useState<Array<{ id: string; phrase: string }>>([]);
  const [chatMessages, setChatMessages] = useState<Array<{ id: string; player_id: string; username: string; phrase: string; created_at: string }>>([]);
  const [sendingChat, setSendingChat] = useState(false);
  const [chatError, setChatError] = useState("");
  const [chatNow, setChatNow] = useState(Date.now());
  const [showScoreboardWindow, setShowScoreboardWindow] = useState(false);
  const [showChatWindow, setShowChatWindow] = useState(false);
  const [showPlayedCardsWindow, setShowPlayedCardsWindow] = useState(false);

  const [players, setPlayers] = useState<GamePlayer[]>([]);
  const [scoreboard, setScoreboard] = useState<ScoreboardEntry[]>([]);
  const [roundSummary, setRoundSummary] = useState<RoundSummaryEntry[]>([]);
  const [roundSummaryId, setRoundSummaryId] = useState("");
  const [dismissedRoundSummaryId, setDismissedRoundSummaryId] = useState("");
  const [roundTricksWon, setRoundTricksWon] = useState<Record<string, number>>({});
  const [round, setRound] = useState<GameRound | null>(null);
  const [hand, setHand] = useState<GameCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [bidProgress, setBidProgress] = useState<BidProgress[]>([]);
  const [revealedBids, setRevealedBids] = useState<RevealedBid[]>([]);
  const [selectedBid, setSelectedBid] = useState(0);
  const [hasSubmittedBid, setHasSubmittedBid] = useState(false);
  const [submittingBid, setSubmittingBid] = useState(false);
  const [bidMessage, setBidMessage] = useState("");

  const [currentTrick, setCurrentTrick] =
    useState<CurrentTrick | null>(null);
  const [playedCards, setPlayedCards] = useState<PlayedCard[]>([]);
  const [selectedCard, setSelectedCard] =
    useState<GameCard | null>(null);
  const dragStartRef = useRef<{ cardId: string; x: number; y: number } | null>(null);
  const suppressCardClickRef = useRef(false);
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null);
  const [tigressMode, setTigressMode] =
    useState<"pirate" | "escape">("pirate");
  const [chosenValue, setChosenValue] = useState<number | null>(null);
  const [chosenSuit, setChosenSuit] = useState<string>("green");
  const [playingCard, setPlayingCard] = useState(false);
  const [playMessage, setPlayMessage] = useState("");
  const [showPlayConfirmation, setShowPlayConfirmation] =
    useState(false);
  const [plankTarget, setPlankTarget] = useState("");
  const [choosingPlankTarget, setChoosingPlankTarget] = useState(false);

const [nextTrickAt, setNextTrickAt] = useState<string | null>(null);
const [lastResolvedTrickNumber, setLastResolvedTrickNumber] = useState(0);
const [pauseCountdown, setPauseCountdown] = useState(0);
  const [rosieTrickId, setRosieTrickId] = useState<string | null>(null);
  const [rosieCanChoose, setRosieCanChoose] = useState(false);
  const [rosieTarget, setRosieTarget] = useState("");
  const [rosieSaving, setRosieSaving] = useState(false);
  const [maryTrickId, setMaryTrickId] = useState<string | null>(null);
  const [maryCanChoose, setMaryCanChoose] = useState(false);
  const [maryTarget, setMaryTarget] = useState("");
  const [marySaving, setMarySaving] = useState(false);
  const [juanitaTrickId, setJuanitaTrickId] = useState<string | null>(null);
  const [juanitaCanPeek, setJuanitaCanPeek] = useState(false);
  const [juanitaPeekCards, setJuanitaPeekCards] = useState<GameCard[] | null>(null);
  const [juanitaPeekLoading, setJuanitaPeekLoading] = useState(false);
  const [bendtTrickId, setBendtTrickId] = useState<string | null>(null);
  const [bendtCanDraw, setBendtCanDraw] = useState(false);
  const [bendtDiscardIds, setBendtDiscardIds] = useState<string[]>([]);
  const [bendtLoading, setBendtLoading] = useState(false);
  const [harryTrickId, setHarryTrickId] = useState<string | null>(null);
  const [harryCanAdjust, setHarryCanAdjust] = useState(false);
  const [harryLoading, setHarryLoading] = useState(false);
  const [rascalTrickId, setRascalTrickId] = useState<string | null>(null);
  const [rascalCanBet, setRascalCanBet] = useState(false);
  const [rascalLoading, setRascalLoading] = useState(false);
  
  const loadGame = useCallback(async () => {
    setError("");

    const { data: authData, error: authError } =
      await supabase.auth.getUser();

    if (authError || !authData.user) {
      setError("Connexion introuvable. Reconnecte-toi.");
      setLoading(false);
      return;
    }

    const currentUserId = authData.user.id;
    setUserId(currentUserId);

    const { data: room, error: roomError } = await supabase
      .from("game_rooms")
      .select("room_name, status, host_id, countdown_ends_at")
      .eq("id", roomId)
      .single();

    if (roomError) {
      setError("Impossible de charger le salon.");
      setLoading(false);
      return;
    }

    setRoomName(room.room_name || "SKULL ARENA");
    setRoomStatus(room.status || "waiting");
    setCountdownEndsAt(room.countdown_ends_at || null);

    if (room.status !== "playing" && room.status !== "finished") {
      setError("Cette partie n'est pas en cours.");
      setLoading(false);
      return;
    }

    const { data: roundData, error: roundError } = await supabase
      .from("game_rounds")
      .select("id, room_id, round_number, status, leader_player_id, last_volley_skip_player_ids")
      .eq("room_id", roomId)
      .order("round_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (roundError || !roundData) {
      setError("Aucune manche active n'a été trouvée.");
      setLoading(false);
      return;
    }

    const currentRound = roundData as GameRound;
    setRound(currentRound);

    const { data: handData, error: handError } = await supabase
      .from("player_hands")
      .select("cards")
      .eq("round_id", currentRound.id)
      .eq("player_id", currentUserId)
      .maybeSingle();

    if (handError || !handData) {
      if (room.status === "finished") {
        setHand([]);
      } else {
        setError("Ta main personnelle est introuvable.");
        setLoading(false);
        return;
      }
    } else {
      const currentHand = Array.isArray(handData.cards)
        ? (handData.cards as GameCard[])
        : [];

      setHand(currentHand);
    }

    const { data: roomPlayers, error: playersError } = await supabase
      .from("room_players")
      .select("player_id")
      .eq("room_id", roomId)
      .order("joined_at", { ascending: true })
.order("player_id", { ascending: true });

    if (playersError) {
      setError("Impossible de charger l'équipage.");
      setLoading(false);
      return;
    }

    const playerIds = (roomPlayers || []).map(
      (player) => player.player_id
    );

    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, username, avatar_url")
      .in("id", playerIds);

    if (profilesError) {
      console.error("ERREUR CHARGEMENT PROFILS :", profilesError);
      setError(
        `Impossible de charger les profils : ${profilesError.message}`
      );
      setLoading(false);
      return;
    }

    const profileMap = new Map(
      (profiles || []).map((profile) => [
        profile.id,
        { username: profile.username, avatar_url: profile.avatar_url },
      ])
    );

    setPlayers(
      (roomPlayers || []).map((player) => ({
        player_id: player.player_id,
        username:
          profileMap.get(player.player_id)?.username || "Pirate inconnu",
        avatar_url: profileMap.get(player.player_id)?.avatar_url || null,
        isHost: player.player_id === room.host_id,
      }))
    );

    // PLIS DÉJÀ REMPORTÉS PENDANT CETTE MANCHE
    const { data: resolvedTricks, error: resolvedTricksError } = await supabase
      .from("game_tricks")
      .select("winner_player_id")
      .eq("round_id", currentRound.id)
      .eq("status", "completed")
      .not("winner_player_id", "is", null);

    if (resolvedTricksError) {
      console.error("ERREUR COMPTE DES PLIS :", resolvedTricksError);
    } else {
      const wins: Record<string, number> = {};
      (resolvedTricks || []).forEach((trick) => {
        const winnerId = trick.winner_player_id as string | null;
        if (winnerId) wins[winnerId] = (wins[winnerId] || 0) + 1;
      });
      setRoundTricksWon(wins);
    }

    // CLASSEMENT DU SALON
    const { data: scoreboardData, error: scoreboardError } =
      await supabase.rpc("get_room_scoreboard", {
        p_room_id: roomId,
      });

    if (!scoreboardError && scoreboardData) {
      setScoreboard(scoreboardData as ScoreboardEntry[]);
    } else if (scoreboardError) {
      console.error("ERREUR CLASSEMENT :", scoreboardError);
    }

    // RÉCAPITULATIF DE LA MANCHE PRÉCÉDENTE
    if (currentRound.round_number > 1) {
      const { data: previousRound } = await supabase
        .from("game_rounds")
        .select("id")
        .eq("room_id", roomId)
        .eq("round_number", currentRound.round_number - 1)
        .maybeSingle();

      if (previousRound?.id) {
        setRoundSummaryId(previousRound.id);
        const { data: previousScores, error: previousScoresError } = await supabase
          .from("player_round_scores")
          .select("player_id, bid, tricks_won, base_points, bonus_points, total_points")
          .eq("round_id", previousRound.id)
          .order("total_points", { ascending: false });

        if (previousScoresError) {
          console.error("ERREUR RÉCAPITULATIF DE MANCHE :", previousScoresError);
        } else {
          const summaryRows = previousScores || [];
          const summaryPlayerIds = summaryRows.map((entry) => entry.player_id);
          const { data: summaryProfiles } = summaryPlayerIds.length
            ? await supabase.from("profiles").select("id, username").in("id", summaryPlayerIds)
            : { data: [] };
          const summaryNames = new Map(
            (summaryProfiles || []).map((profile) => [profile.id, profile.username || "Pirate inconnu"])
          );
          setRoundSummary(summaryRows.map((entry) => ({
            ...entry,
            username: summaryNames.get(entry.player_id) || "Pirate inconnu",
          })) as RoundSummaryEntry[]);
        }
      } else {
        setRoundSummary([]);
        setRoundSummaryId("");
      }
    } else {
      setRoundSummary([]);
      setRoundSummaryId("");
    }

    // PROGRESSION DES ENCHÈRES
    if (
      currentRound.status === "bidding" ||
      currentRound.status === "playing" ||
      currentRound.status === "completed"
    ) {
      const { data: progressData, error: progressError } =
        await supabase.rpc("get_bid_progress", {
          p_round_id: currentRound.id,
        });

      if (!progressError && progressData) {
        const progress = progressData as BidProgress[];
        setBidProgress(progress);

        const ownBid = progress.find(
          (item) => item.player_id === currentUserId
        );

        setHasSubmittedBid(ownBid?.has_bid ?? false);
      }

      if (
        currentRound.status === "playing" ||
        currentRound.status === "completed"
      ) {
        const { data: revealedData, error: revealedError } =
          await supabase.rpc("get_revealed_bids", {
            p_round_id: currentRound.id,
          });

        if (!revealedError && revealedData) {
          setRevealedBids(revealedData as RevealedBid[]);
        } else if (revealedError) {
          console.error("ERREUR RÉVÉLATION :", revealedError);
        }
      } else {
        setRevealedBids([]);
      }
    }

    // CHARGEMENT DU PLI EN COURS
    const { data: trickData, error: trickError } = await supabase
      .from("game_tricks")
      .select(`
        id,
        trick_number,
        status,
        leader_player_id,
        resolution,
        walk_the_plank_player_id,
        walk_the_plank_target_player_id
      `)
      .eq("round_id", currentRound.id)
      .eq("status", "playing")
      .order("trick_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (trickError) {
  console.error("ERREUR CHARGEMENT DU PLI :", trickError);
} else if (trickData) {
  setCurrentTrick(trickData as CurrentTrick);
  setLastResolvedTrickNumber(Math.max(0, trickData.trick_number - 1));
  setNextTrickAt(null);

  const { data: playsData, error: playsError } = await supabase
    .from("trick_plays")
    .select(
      "id, player_id, card, play_order, tigress_mode, chosen_value, chosen_suit"
    )
    .eq("trick_id", trickData.id)
    .order("play_order", { ascending: true });

  if (playsError) {
    console.error("ERREUR CARTES JOUÉES :", playsError);
  } else {
    setPlayedCards((playsData || []) as PlayedCard[]);
  }
} else {
  setCurrentTrick(null);
  setPlayedCards([]);
  setPlankTarget("");

  const { data: lastResolvedTrick } = await supabase
    .from("game_tricks")
    .select("id, trick_number, resolved_at, resolution")
    .eq("round_id", currentRound.id)
    .eq("status", "resolved")
    .order("trick_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  setLastResolvedTrickNumber(lastResolvedTrick?.trick_number ?? 0);
  const resolvedMetadata = lastResolvedTrick?.resolution as
    | {
        pirate_power_triggers?: Array<{ player_id?: string; power?: string }>;
        bendt_discard_completed?: boolean;
      }
    | null;
  const powerTriggers = resolvedMetadata?.pirate_power_triggers ?? [];
  const maryWinnerId = (resolvedMetadata as { mary_throne_winner_player_id?: string } | null)?.mary_throne_winner_player_id;
  const canUseMary = Boolean(
    maryWinnerId === currentUserId &&
    lastResolvedTrick?.id &&
    lastResolvedTrick.trick_number < currentRound.round_number
  );
  setMaryCanChoose(canUseMary);
  setMaryTrickId(canUseMary ? lastResolvedTrick?.id ?? null : null);
  if (!canUseMary) setMaryTarget("");
  const rosieTrigger = powerTriggers.some(
    (trigger) => trigger.player_id === currentUserId && trigger.power === "rosie"
  );
  const canChooseWithRosie = Boolean(
    rosieTrigger && lastResolvedTrick?.id &&
    lastResolvedTrick.trick_number < currentRound.round_number
  );
  setRosieCanChoose(canChooseWithRosie);
  setRosieTrickId(canChooseWithRosie ? lastResolvedTrick?.id ?? null : null);
  const juanitaTrigger = powerTriggers.some(
    (trigger) => trigger.player_id === currentUserId && trigger.power === "juanita"
  );
  const juanitaPeekedPlayers = Array.isArray(
    (resolvedMetadata as { juanita_peeked_player_ids?: string[] } | null)?.juanita_peeked_player_ids
  )
    ? (resolvedMetadata as { juanita_peeked_player_ids: string[] }).juanita_peeked_player_ids
    : [];
  const canPeekWithJuanita = Boolean(
    juanitaTrigger &&
    !juanitaPeekedPlayers.includes(currentUserId) &&
    lastResolvedTrick?.id &&
    lastResolvedTrick.trick_number < currentRound.round_number
  );
  setJuanitaCanPeek(canPeekWithJuanita);
  setJuanitaTrickId(canPeekWithJuanita ? lastResolvedTrick?.id ?? null : null);
  if (!canPeekWithJuanita) setJuanitaPeekCards(null);
  const bendtTrigger = powerTriggers.some(
    (trigger) => trigger.player_id === currentUserId && trigger.power === "bendt"
  );
  const canUseBendt = Boolean(
    bendtTrigger && !resolvedMetadata?.bendt_discard_completed &&
    lastResolvedTrick?.id &&
    lastResolvedTrick.trick_number < currentRound.round_number
  );
  setBendtCanDraw(canUseBendt);
  setBendtTrickId(canUseBendt ? lastResolvedTrick?.id ?? null : null);
  if (!canUseBendt) setBendtDiscardIds([]);
  const harryTrigger = powerTriggers.some(
    (trigger) => trigger.player_id === currentUserId && trigger.power === "harry"
  );
  const canUseHarry = Boolean(
    harryTrigger && lastResolvedTrick?.id &&
    lastResolvedTrick.trick_number < currentRound.round_number
  );
  setHarryCanAdjust(canUseHarry);
  setHarryTrickId(canUseHarry ? lastResolvedTrick?.id ?? null : null);
  const rascalTrigger = powerTriggers.some(
    (trigger) => trigger.player_id === currentUserId && trigger.power === "rascal"
  );
  const canUseRascal = Boolean(
    rascalTrigger && lastResolvedTrick?.id &&
    lastResolvedTrick.trick_number < currentRound.round_number
  );
  setRascalCanBet(canUseRascal);
  setRascalTrickId(canUseRascal ? lastResolvedTrick?.id ?? null : null);

  if (
    lastResolvedTrick?.resolved_at &&
    currentRound.status === "playing"
  ) {
    setNextTrickAt(lastResolvedTrick.resolved_at);
  } else {
    setNextTrickAt(null);
  }
}

    setLoading(false);
  }, [roomId]);

  useEffect(() => {
    if (!userId) return;
    let mounted = true;
    const loadQuickChat = async () => {
      const [{ data: phrases }, { data: messages }] = await Promise.all([
        supabase.rpc("get_quick_chat_phrases"),
        supabase.from("room_chat_messages")
          .select("id,player_id,username,phrase,created_at")
          .eq("room_id", roomId)
          .order("created_at", { ascending: false })
          .limit(25),
      ]);
      if (!mounted) return;
      setQuickPhrases(
        (Array.isArray(phrases) ? phrases : [])
          .filter((item: { is_active?: boolean }) => item.is_active !== false)
          .map((item: { id: string; phrase: string }) => ({ id: item.id, phrase: item.phrase }))
      );
      setChatMessages(Array.isArray(messages) ? [...messages].reverse() : []);
    };
    void loadQuickChat();
    const channel = supabase
      .channel(`room-chat-${roomId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "room_chat_messages",
        filter: `room_id=eq.${roomId}`,
      }, (payload) => {
        const message = payload.new as { id: string; player_id: string; username: string; phrase: string; created_at: string };
        setChatMessages((previous) => previous.some((item) => item.id === message.id)
          ? previous
          : [...previous.slice(-24), message]);
        setChatNow(Date.now());
        window.setTimeout(() => setChatNow(Date.now()), 2050);
      })
      .subscribe();
    return () => {
      mounted = false;
      void supabase.removeChannel(channel);
    };
  }, [roomId, userId]);

  const sendQuickChat = async (phrase: string) => {
    if (!userId || sendingChat) return;
    setSendingChat(true); setChatError("");
    const username = players.find((player) => player.player_id === userId)?.username || "Pirate";
    const { error: sendError } = await supabase.from("room_chat_messages").insert({ room_id: roomId, player_id: userId, username, phrase });
    setSendingChat(false); if (sendError) setChatError(sendError.message);
  };

  useEffect(() => {
    let mounted = true;
    let refreshInProgress = false;
    let refreshPending = false;
    let refreshTimer: number | null = null;

    const refreshSafely = async () => {
      if (!mounted) return;
      if (refreshInProgress) {
        refreshPending = true;
        return;
      }

      refreshInProgress = true;
      do {
        refreshPending = false;
        await loadGame();
      } while (mounted && refreshPending);
      refreshInProgress = false;
    };

    const scheduleRefresh = () => {
      if (refreshTimer !== null) {
        window.clearTimeout(refreshTimer);
      }
      refreshTimer = window.setTimeout(() => {
        refreshTimer = null;
        void refreshSafely();
      }, 120);
    };

    void refreshSafely();

    // Filet de sécurité en cas de perte temporaire du canal Realtime.
    const refreshInterval = window.setInterval(() => {
      void refreshSafely();
    }, 5000);

    let channel = supabase.channel(`game-screen-${roomId}`);

    channel = channel
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "game_rooms",
          filter: `id=eq.${roomId}`,
        },
        scheduleRefresh
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "player_scores",
          filter: `room_id=eq.${roomId}`,
        },
        scheduleRefresh
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "player_round_scores",
          filter: `room_id=eq.${roomId}`,
        },
        scheduleRefresh
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "game_rounds",
          filter: `room_id=eq.${roomId}`,
        },
        scheduleRefresh
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "room_players",
          filter: `room_id=eq.${roomId}`,
        },
        scheduleRefresh
      );

    // Ces tables sont liées à la manche courante : on évite les
    // notifications globales provenant des autres salons.
    if (round?.id) {
      channel = channel
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "player_bids",
            filter: `round_id=eq.${round.id}`,
          },
          scheduleRefresh
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "player_hands",
            filter: `round_id=eq.${round.id}`,
          },
          scheduleRefresh
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "game_tricks",
            filter: `round_id=eq.${round.id}`,
          },
          scheduleRefresh
        );
    }

    if (currentTrick?.id) {
      channel = channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "trick_plays",
          filter: `trick_id=eq.${currentTrick.id}`,
        },
        scheduleRefresh
      );
    }

    channel.subscribe();

    return () => {
      mounted = false;
      window.clearInterval(refreshInterval);
      if (refreshTimer !== null) window.clearTimeout(refreshTimer);
      void supabase.removeChannel(channel);
    };
  }, [roomId, loadGame, round?.id, currentTrick?.id]);

  useEffect(() => {
    if (!countdownEndsAt) {
      setCountdownValue(null);
      setShowGo(false);
      return;
    }

    const target = new Date(countdownEndsAt).getTime();
    if (!Number.isFinite(target)) return;

    let goTimer: number | null = null;
    let goShown = false;

    const updateLaunchCountdown = () => {
      const remainingMs = target - Date.now();
      if (remainingMs > 0) {
        setCountdownValue(Math.ceil(remainingMs / 1000));
        setShowGo(false);
        return;
      }

      setCountdownValue(null);
      if (!goShown) {
        goShown = true;
        setShowGo(true);
        goTimer = window.setTimeout(() => setShowGo(false), 850);
      }
    };

    updateLaunchCountdown();
    const interval = window.setInterval(updateLaunchCountdown, 100);

    return () => {
      window.clearInterval(interval);
      if (goTimer !== null) window.clearTimeout(goTimer);
    };
  }, [countdownEndsAt]);

  useEffect(() => {
  const updateCountdown = () => {
    if (!nextTrickAt) {
      setPauseCountdown(0);
      return;
    }

    const targetTime = new Date(nextTrickAt).getTime();
    const remaining = Math.max(
      0,
      Math.ceil((targetTime + 10000 - Date.now()) / 1000)
    );

    setPauseCountdown(remaining);
  };

  updateCountdown();

  const countdownInterval = window.setInterval(
    updateCountdown,
    250
  );

  return () => {
    window.clearInterval(countdownInterval);
  };
}, [nextTrickAt]);

  const confirmMaryTarget = async () => {
    if (!maryTrickId || !maryTarget || marySaving) return;
    setMarySaving(true);
    setPlayMessage("");
    const { error: choiceError } = await supabase.rpc(
      "choose_mary_throne_target",
      {
        p_trick_id: maryTrickId,
        p_target_player_id: maryTarget,
      }
    );
    setMarySaving(false);
    if (choiceError) {
      setPlayMessage(choiceError.message);
      return;
    }
    setMaryCanChoose(false);
    setMaryTarget("");
    setPlayMessage("Mary Throne a choisi une carte au hasard. Elle devra être jouée en pose supplémentaire au prochain pli de cette manche.");
    await loadGame();
  };

  const confirmRosieLeader = async () => {
    if (!rosieTrickId || !rosieTarget || rosieSaving) return;
    setRosieSaving(true);
    setPlayMessage("");
    const { error: choiceError } = await supabase.rpc(
      "choose_rosie_next_leader",
      {
        p_trick_id: rosieTrickId,
        p_target_player_id: rosieTarget,
      }
    );
    setRosieSaving(false);
    if (choiceError) {
      setPlayMessage(choiceError.message);
      return;
    }
    setRosieCanChoose(false);
    setRosieTarget("");
    setPlayMessage("Rosie a choisi le meneur du prochain pli.");
    await loadGame();
  };

  const revealJuanitaDrawPile = async () => {
    if (!juanitaTrickId || juanitaPeekLoading) return;
    setJuanitaPeekLoading(true);
    setPlayMessage("");
    const { data, error: peekError } = await supabase.rpc(
      "reveal_juanita_draw_pile",
      { p_trick_id: juanitaTrickId }
    );
    setJuanitaPeekLoading(false);
    if (peekError) {
      setPlayMessage(peekError.message);
      return;
    }
    const result = data as { draw_pile?: GameCard[] } | null;
    setJuanitaPeekCards(Array.isArray(result?.draw_pile) ? result.draw_pile : []);
  };

  const drawBendtCards = async () => {
    if (!bendtTrickId || bendtLoading) return;
    setBendtLoading(true);
    setPlayMessage("");
    const { data, error: drawError } = await supabase.rpc(
      "draw_bendt_cards",
      { p_trick_id: bendtTrickId }
    );
    setBendtLoading(false);
    if (drawError) {
      setPlayMessage(drawError.message);
      return;
    }
    const result = data as { drawn_cards?: GameCard[] } | null;
    const drawn = Array.isArray(result?.drawn_cards) ? result.drawn_cards : [];
    setHand((previous) => [...previous, ...drawn]);
    setBendtCanDraw(false);
    setBendtDiscardIds([]);
    setPlayMessage("Bendt a pioché deux cartes. Choisis-en deux à défausser.");
  };

  const toggleBendtDiscard = (cardId: string) => {
    setBendtDiscardIds((previous) =>
      previous.includes(cardId)
        ? previous.filter((id) => id !== cardId)
        : previous.length < 2
          ? [...previous, cardId]
          : previous
    );
  };

  const confirmBendtDiscard = async () => {
    if (!bendtTrickId || bendtDiscardIds.length !== 2 || bendtLoading) return;
    setBendtLoading(true);
    setPlayMessage("");
    const { error: discardError } = await supabase.rpc(
      "discard_bendt_cards",
      { p_trick_id: bendtTrickId, p_card_ids: bendtDiscardIds }
    );
    setBendtLoading(false);
    if (discardError) {
      setPlayMessage(discardError.message);
      return;
    }
    setHand((previous) => previous.filter((card) => !bendtDiscardIds.includes(card.id)));
    setBendtDiscardIds([]);
    setBendtTrickId(null);
    setPlayMessage("Pouvoir de Bendt terminé : deux cartes défaussées.");
    await loadGame();
  };

  const applyHarryAdjustment = async (adjustment: -1 | 0 | 1) => {
    if (!harryTrickId || harryLoading) return;
    setHarryLoading(true);
    setPlayMessage("");
    const { data, error: harryError } = await supabase.rpc(
      "apply_harry_bid_adjustment",
      { p_trick_id: harryTrickId, p_adjustment: adjustment }
    );
    setHarryLoading(false);
    if (harryError) {
      setPlayMessage(harryError.message);
      return;
    }
    const result = data as { old_bid?: number; new_bid?: number } | null;
    setHarryCanAdjust(false);
    setHarryTrickId(null);
    setPlayMessage(`Harry modifie ta mise : ${result?.old_bid ?? "?"} → ${result?.new_bid ?? "?"}.`);
    await loadGame();
  };

  const chooseRascalBet = async (stake: 0 | 10 | 20) => {
    if (!rascalTrickId || rascalLoading) return;
    setRascalLoading(true);
    setPlayMessage("");
    const { error: rascalError } = await supabase.rpc(
      "choose_rascal_extra_bet",
      { p_trick_id: rascalTrickId, p_stake: stake }
    );
    setRascalLoading(false);
    if (rascalError) {
      setPlayMessage(rascalError.message);
      return;
    }
    setRascalCanBet(false);
    setRascalTrickId(null);
    setPlayMessage(
      stake === 0
        ? "Rascal choisit de ne pas miser de points supplémentaires."
        : `Rascal engage ${stake} points supplémentaires : ils seront ajoutés si ta mise est exacte, retirés sinon.`
    );
    await loadGame();
  };

  const submitBid = async () => {
    if (!round || hasSubmittedBid || submittingBid) return;

    setSubmittingBid(true);
    setBidMessage("");

    const { error: bidError } = await supabase.rpc(
      "submit_player_bid",
      {
        p_round_id: round.id,
        p_bid: selectedBid,
      }
    );

    setSubmittingBid(false);

    if (bidError) {
      setBidMessage(bidError.message);
      return;
    }

    setHasSubmittedBid(true);
    setBidMessage("Ton annonce est enregistrée secrètement.");

    await loadGame();
  };

  const handleHandCardPointerDown = (event: ReactPointerEvent<HTMLButtonElement>, card: GameCard) => {
    if (!isMyTurn || round?.status !== "playing" || currentPlayerHasPlayed || playingCard || isWaitingForPlankChoice) return;
    dragStartRef.current = { cardId: card.id, x: event.clientX, y: event.clientY };
    setDraggingCardId(card.id);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleHandCardPointerUp = (event: React.PointerEvent<HTMLButtonElement>, card: GameCard) => {
    const start = dragStartRef.current;
    dragStartRef.current = null;
    setDraggingCardId(null);
    if (!start || start.cardId !== card.id) return;
    const deltaY = start.y - event.clientY;
    const deltaX = Math.abs(event.clientX - start.x);
    if (deltaY < 78 || deltaY < deltaX * 0.75) return;
    suppressCardClickRef.current = true;
    setSelectedCard(card);
    setChosenValue(card.selectableValue?.[0] ?? null);
    setChosenSuit("green");
    setPlayMessage("");
    setShowPlayConfirmation(false);
    const needsChoice = Boolean(card.selectableValue?.length || card.type === "joker" || card.type === "tigress" || card.type === "walk_the_plank");
    if (!needsChoice) void playCardFromHand(card);
  };

  const playCardFromHand = async (card: GameCard) => {
    if (!round || playingCard || !isMyTurn) return;
    setSelectedCard(card);
    setChosenValue(card.selectableValue?.[0] ?? null);
    setChosenSuit("green");
    setPlayMessage("");
    if (card.selectableValue?.length || card.type === "joker" || card.type === "tigress" || card.type === "walk_the_plank") {
      setPlayMessage("Choisis les options de cette carte avant de la jouer.");
      return;
    }
    setPlayingCard(true);
    const { error: playError } = await supabase.rpc("play_card", {
      p_round_id: round.id,
      p_card_id: card.id,
      p_tigress_mode: null,
      p_chosen_value: null,
      p_chosen_suit: null,
    });
    setPlayingCard(false);
    if (playError) { setPlayMessage(playError.message); return; }
    setPlayMessage("Carte jouée !");
    setSelectedCard(null);
    await loadGame();
  };

  const playSelectedCard = async () => {
    if (!round || !selectedCard || playingCard || !isMyTurn) return;

    if (selectedCard.selectableValue?.length && chosenValue === null) {
      setPlayMessage("Choisis la valeur de cette carte.");
      return;
    }

    if (
      selectedCard.type === "joker" &&
      !jokerBlackLead &&
      !["green", "purple", "yellow"].includes(chosenSuit)
    ) {
      setPlayMessage("Choisis une couleur valide pour le Joker.");
      return;
    }

    setPlayingCard(true);
    setPlayMessage("");

    const { data, error: playError } = await supabase.rpc(
      "play_card",
      {
        p_round_id: round.id,
        p_card_id: selectedCard.id,
        p_tigress_mode:
          selectedCard.type === "tigress" ? tigressMode : null,
        p_chosen_value: selectedCard.selectableValue?.length
          ? chosenValue
          : null,
        p_chosen_suit:
          selectedCard.type === "joker" && !jokerBlackLead ? chosenSuit : null,
      }
    );

    setPlayingCard(false);

    if (playError) {
      setPlayMessage(playError.message);
      return;
    }

    setPlayMessage("Carte jouée avec succès !");
    setSelectedCard(null);
    setShowPlayConfirmation(false);

    console.log("RÉSULTAT POSE CARTE :", data);

    await loadGame();
  };

  const confirmWalkThePlankTarget = async () => {
    if (!currentTrick || !plankTarget || choosingPlankTarget) return;

    setChoosingPlankTarget(true);
    setPlayMessage("");

    const { error: choiceError } = await supabase.rpc(
      "choose_walk_the_plank_target",
      {
        p_trick_id: currentTrick.id,
        p_target_player_id: plankTarget,
      }
    );

    setChoosingPlankTarget(false);

    if (choiceError) {
      setPlayMessage(choiceError.message);
      return;
    }

    setPlankTarget("");
    setPlayMessage("Le Pirate a été désigné.");
    await loadGame();
  };

  const plankPirates = playedCards.filter(
    (play) =>
      play.card?.type === "pirate" ||
      (play.card?.type === "tigress" &&
        play.tigress_mode === "pirate")
  );

  const isWaitingForPlankChoice =
    currentTrick?.resolution?.status ===
    "awaiting_walk_the_plank_target";

  const leader = players.find(
    (player) => player.player_id === round?.leader_player_id
  );

  const currentPlayer = players.find(
    (player) => player.player_id === userId
  );

  const submittedCount = bidProgress.filter(
    (player) => player.has_bid
  ).length;

  const allPlayersSubmitted =
    bidProgress.length > 0 &&
    submittedCount === bidProgress.length;

  const bidsAreRevealed =
    revealedBids.length > 0 && allPlayersSubmitted;

  const currentTrickLeader = players.find(
    (player) =>
      player.player_id ===
      (currentTrick?.leader_player_id || round?.leader_player_id)
  );

  const playerCount = players.length;
  const skippedOnFinalTrick =
    Boolean(round && currentTrick && currentTrick.trick_number === round.round_number);
  const skippedPlayerIds = skippedOnFinalTrick
    ? (round?.last_volley_skip_player_ids || [])
    : [];
  const activePlayers = players.filter(
    (player) => !skippedPlayerIds.includes(player.player_id)
  );
  const activePlayerCount = activePlayers.length;
  const volleyPlayers =
    round && currentTrick && currentTrick.trick_number < round.round_number
      ? playedCards
          .filter((play) => play.card?.type === "last_volley")
          .sort((a, b) => a.play_order - b.play_order)
          .map((play) => play.player_id)
      : [];
  const normalPlaysComplete =
    activePlayerCount > 0 && playedCards.length >= activePlayerCount;
  const expectedVolleyPlayer = normalPlaysComplete
    ? volleyPlayers[playedCards.length - activePlayerCount] || null
    : null;
  const isExtraVolleyTurn = expectedVolleyPlayer === userId;
  const currentPlayerHasPlayed = playedCards.some(
    (play) => play.player_id === userId
  ) && !isExtraVolleyTurn;

  const expectedPlayCount =
    activePlayerCount + volleyPlayers.length;
  const allCardsPlayed =
    activePlayerCount > 0 &&
    playedCards.length >= expectedPlayCount;

  // ORDRE DE JEU : les joueurs exclus du dernier pli sont ignorés.
  const turnLeaderId =
    currentTrick?.leader_player_id || round?.leader_player_id;
  const turnLeaderIndex = players.findIndex(
    (player) => player.player_id === turnLeaderId
  );
  const orderedActivePlayers =
    turnLeaderIndex >= 0
      ? [
          ...players.slice(turnLeaderIndex),
          ...players.slice(0, turnLeaderIndex),
        ].filter((player) => !skippedPlayerIds.includes(player.player_id))
      : activePlayers;
  const expectedPlayer =
    !normalPlaysComplete && activePlayerCount > 0
      ? orderedActivePlayers[playedCards.length] || null
      : expectedVolleyPlayer
        ? players.find((player) => player.player_id === expectedVolleyPlayer) || null
        : null;

  const isMyTurn =
    round?.status === "playing" &&
    !currentPlayerHasPlayed &&
    !allCardsPlayed &&
    !isWaitingForPlankChoice &&
    expectedPlayer?.player_id === userId;

  if (loading) {
    return (
      <main className="game-loading">
        <Skull size={42} />
        <h2>PRÉPARATION DE L'ARÈNE</h2>
        <p>Chargement de ton équipage et de tes cartes...</p>
      </main>
    );
  }

  if (error || !round) {
    return (
      <main className="game-loading">
        <Skull size={42} />
        <h2>IMPOSSIBLE D'ACCÉDER À L'ARÈNE</h2>
        <p>{error || "Une erreur est survenue."}</p>
        <button onClick={loadGame}>
          <RefreshCw size={17} /> RÉESSAYER
        </button>
        <button onClick={onExit}>
          <ArrowLeft size={17} /> RETOUR AU SALON
        </button>
      </main>
    );
  }

  // ÉCRAN FINAL DE LA PARTIE
  if (roomStatus === "finished") {
    const winner = scoreboard.length > 0 ? scoreboard[0] : null;

    return (
      <main className="skull-game">
        <header className="game-topbar">
          <button className="game-back" onClick={onExit}>
            <ArrowLeft size={18} />
            SALON
          </button>

          <div className="game-brand">
            <Skull size={27} />
            <div>
              <strong>SKULL ARENA</strong>
              <span>{roomName.toUpperCase()}</span>
            </div>
          </div>

          <button
            className="game-refresh"
            onClick={loadGame}
            aria-label="Actualiser les résultats"
          >
            <RefreshCw size={19} />
          </button>
        </header>

        <section
          style={{
            maxWidth: "760px",
            margin: "30px auto",
            padding: "20px",
            textAlign: "center",
          }}
        >
          <Crown
            size={64}
            color="#f6c94c"
            style={{ margin: "0 auto 16px" }}
          />

          <h1 style={{ color: "#f6c94c", marginBottom: "8px" }}>
            PARTIE TERMINÉE !
          </h1>

          <p style={{ opacity: 0.75 }}>
            Les dix manches sont terminées. Voici les résultats de l'équipage.
          </p>

          {winner ? (
            <div
              style={{
                margin: "28px 0",
                padding: "24px",
                borderRadius: "18px",
                background: "rgba(246, 201, 76, 0.12)",
                border: "1px solid rgba(246, 201, 76, 0.5)",
              }}
            >
              <span style={{ color: "#f6c94c", fontSize: "13px" }}>
                🏆 GRAND VAINQUEUR
              </span>

              <h2 style={{ fontSize: "30px", margin: "12px 0" }}>
                {winner.username}
              </h2>

              <strong style={{ color: "#f6c94c", fontSize: "26px" }}>
                {winner.total_score} POINTS
              </strong>
            </div>
          ) : (
            <p>Les résultats ne sont pas encore disponibles.</p>
          )}

          <div
            style={{
              marginTop: "28px",
              padding: "18px",
              borderRadius: "16px",
              background: "rgba(12, 20, 35, 0.92)",
              border: "1px solid rgba(246, 201, 76, 0.25)",
              textAlign: "left",
            }}
          >
            <h2 style={{ marginBottom: "18px" }}>
              <Crown size={19} /> CLASSEMENT FINAL
            </h2>

            {scoreboard.length === 0 ? (
              <p>Aucun résultat enregistré.</p>
            ) : (
              <div style={{ display: "grid", gap: "10px" }}>
                {scoreboard.map((player) => (
                  <div
                    key={player.player_id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "40px minmax(0, 1fr) auto",
                      alignItems: "center",
                      gap: "10px",
                      padding: "13px",
                      borderRadius: "10px",
                      background:
                        player.player_id === winner?.player_id
                          ? "rgba(246, 201, 76, 0.13)"
                          : "rgba(255,255,255,0.035)",
                      border: "1px solid rgba(255,255,255,0.07)",
                    }}
                  >
                    <strong style={{ color: "#f6c94c" }}>
                      #{player.rank_position}
                    </strong>

                    <div>
                      <strong>{player.username}</strong>
                      <div style={{ fontSize: "12px", opacity: 0.7 }}>
                        {player.games_won} victoire(s) ·{" "}
                        {player.tricks_won} plis gagnés
                      </div>
                    </div>

                    <strong style={{ color: "#f6c94c" }}>
                      {player.total_score} pts
                    </strong>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            className="lobby-primary"
            onClick={onExit}
            style={{
              marginTop: "25px",
              width: "100%",
              justifyContent: "center",
            }}
          >
            <ArrowLeft size={18} />
            RETOUR AU SALON
          </button>
        </section>
      </main>
    );
  }

  const jokerBlackLead =
    playedCards.find((play) => play.card.type === "number" || play.card.type === "joker")
      ?.card.suit === "black";

  return (
    <main className="skull-game">
      {(countdownValue !== null || showGo) && (
        <div
          role="status"
          aria-live="assertive"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 10000,
            display: "grid",
            placeItems: "center",
            background: "rgba(5, 8, 14, 0.82)",
            backdropFilter: "blur(8px)",
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              color: "#ffe6a0",
              fontFamily: "Georgia, serif",
              fontSize: "clamp(76px, 18vw, 150px)",
              fontWeight: 900,
              textShadow: "0 0 18px rgba(255,174,49,.9), 0 0 54px rgba(255,120,25,.65)",
              animation: "skullLaunchPulse .65s ease-in-out infinite alternate",
            }}
          >
            {showGo ? "GO !" : countdownValue}
          </div>
        </div>
      )}
      <style>{`@keyframes skullLaunchPulse { from { transform: scale(.88); opacity:.75; } to { transform: scale(1.06); opacity:1; } }`}</style>
      <header className="game-topbar">
        <button className="game-back" onClick={onExit}>
          <ArrowLeft size={18} />
          SALON
        </button>

        <div className="game-brand">
          <Skull size={27} />
          <div>
            <strong>SKULL ARENA</strong>
            <span>{roomName.toUpperCase()}</span>
          </div>
        </div>

        <button type="button" className="game-chat-trigger" onClick={() => setShowChatWindow(true)} aria-label="Ouvrir les discussions">💬</button>
        <button
          className="game-refresh"
          onClick={loadGame}
          aria-label="Actualiser la partie"
        >
          <RefreshCw size={19} />
        </button>
      </header>

      <section className="game-round-info">
        <div>
          <span>MANCHE</span>
          <strong>{round.round_number} / 10</strong>
        </div>

        <div>
          <span>ÉTAT</span>
          <strong>{round.status.toUpperCase()}</strong>
        </div>

        <div>
          <span>ÉQUIPAGE</span>
          <strong>{players.length} PIRATES</strong>
        </div>
      </section>

      {roundSummary.length > 0 && roundSummaryId && dismissedRoundSummaryId !== roundSummaryId && (
        <section className="round-summary-panel" aria-label="Résultats de la manche précédente">
          <div className="round-summary-heading">
            <div>
              <span>RÉSULTATS DE LA MANCHE {round.round_number - 1}</span>
              <strong>Le score est tombé !</strong>
            </div>
            <button
              type="button"
              onClick={() => setDismissedRoundSummaryId(roundSummaryId)}
              aria-label="Fermer le récapitulatif"
            >
              <X size={17} />
            </button>
          </div>
          <div className="round-summary-list">
            {roundSummary.map((entry, index) => (
              <div className="round-summary-row" key={entry.player_id}>
                <span className="round-summary-rank">{index + 1}</span>
                <div className="round-summary-player">
                  <strong>{entry.username}</strong>
                  <span>Mise {entry.bid} · {entry.tricks_won} pli(s) · bonus {entry.bonus_points >= 0 ? "+" : ""}{entry.bonus_points}</span>
                </div>
                <strong className={entry.total_points >= 0 ? "round-summary-positive" : "round-summary-negative"}>
                  {entry.total_points > 0 ? "+" : ""}{entry.total_points} pts
                </strong>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* CLASSEMENT EN DIRECT */}
      <aside className="game-scoreboard skull-scoreboard game-scoreboard-rail" onClick={(event) => event.stopPropagation()} aria-label="Classement de l'équipage">
        <div className="game-section-heading">
          <h2><Crown size={19} /> CLASSEMENT DE L'ÉQUIPAGE</h2>
          <span className="scoreboard-live"><i /> EN DIRECT</span>
        </div>
        {scoreboard.length === 0 ? (
          <p className="scoreboard-empty">Les scores apparaîtront dès la fin du premier pli.</p>
        ) : (
          <div className="scoreboard-list">
            {[...scoreboard].sort((a, b) => a.rank_position - b.rank_position).map((player) => {
              const isCurrentPlayer = player.player_id === userId;
              const podium = player.rank_position <= 3;
              const medal = player.rank_position === 1 ? "♛" : player.rank_position === 2 ? "🥈" : player.rank_position === 3 ? "🥉" : `#${player.rank_position}`;
              return (
                <div key={player.player_id} className={`scoreboard-row ${podium ? `scoreboard-row--top scoreboard-row--rank-${player.rank_position}` : ""} ${isCurrentPlayer ? "scoreboard-row--me" : ""}`}>
                  <span className="scoreboard-rank" aria-label={`Position ${player.rank_position}`}>{medal}</span>
                  <div className="scoreboard-player">
                    <strong>{player.username}{isCurrentPlayer ? <small>TOI</small> : null}</strong>
                    <span>{player.tricks_won} plis remportés <i>·</i> {player.rounds_played} manches</span>
                  </div>
                  <strong className="scoreboard-points">{player.total_score}<small>PTS</small></strong>
                </div>
              );
            })}
          </div>
        )}
      </aside>

      <section className="game-arena">
        <div className="arena-heading">
          <Anchor size={17} />
          <span>LE PLATEAU DES PIRATES</span>
        </div>

        <div className="arena-table">
          <button type="button" className={`arena-played-cards arena-played-stack ${playedCards.length ? "has-played-cards" : ""}`} onClick={() => playedCards.length && setShowPlayedCardsWindow(true)} aria-label="Afficher les cartes jouées dans l'ordre">
            {playedCards.length === 0 ? <div className="arena-empty-play"><Swords size={25} /><span>{round.status === "bidding" ? "EN ATTENTE DES ENCHÈRES" : "À TOI DE JOUER"}</span></div> : <>
              <span className="played-stack-count">{playedCards.length} / {expectedPlayCount || players.length} CARTES</span>
              {playedCards.slice(-3).map((play, index) => <div className="arena-stack-card" key={play.id} style={{ transform: `translate(${index * 5}px, ${-index * 3}px) rotate(${(index - 1) * 5}deg)`, zIndex:index+1 }}>
                <strong>{(play.card as GameCard).value ?? cardSymbol((play.card as GameCard).type)}</strong>
                <small>{players.find(p => p.player_id === play.player_id)?.username ?? "Pirate"}</small>
              </div>)}
              <span className="played-stack-hint">TOUCHER POUR VOIR LE PLI</span>
            </>}
          </button>
          <div className="arena-decoration">
            <Skull size={62} />
            <strong>SKULL ARENA</strong>
            <span>QUE LE MEILLEUR PIRATE GAGNE</span>
          </div>

          <div className="arena-status">
            <Swords size={19} />
            <span>
              {round.status === "bidding"
                ? "LES MISES SONT EN ATTENTE"
                : "LES ENCHÈRES SONT TERMINÉES"}
            </span>
          </div>
        </div>
      </section>

      {/* ENCHÈRES */}
      <section className="game-bidding-panel">
        <div className="game-section-heading">
          <h2>
            <Lock size={19} /> LES ENCHÈRES
          </h2>
          <span>
            {submittedCount}/{players.length} validées
          </span>
        </div>

        {round.status === "bidding" && (
          <>
            <div className="bid-instructions">
              <strong>Combien de plis vas-tu remporter ?</strong>
              <p>
                Choisis ton annonce. Les autres pirates ne verront
                pas ton choix avant la validation de tous les joueurs.
              </p>
            </div>

            {!hasSubmittedBid ? (
              <>
                <div className="bid-selector">
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedBid((value) => Math.max(0, value - 1))
                    }
                    disabled={selectedBid <= 0 || submittingBid}
                    aria-label="Diminuer l'annonce"
                  >
                    <Minus size={22} />
                  </button>

                  <div className="bid-number">
                    <strong>{selectedBid}</strong>
                    <span>
                      {selectedBid === 0
                        ? "AUCUN PLI"
                        : selectedBid === 1
                          ? "PLI ANNONCÉ"
                          : "PLIS ANNONCÉS"}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setSelectedBid((value) =>
                        Math.min(round.round_number, value + 1)
                      )
                    }
                    disabled={
                      selectedBid >= round.round_number ||
                      submittingBid
                    }
                    aria-label="Augmenter l'annonce"
                  >
                    <Plus size={22} />
                  </button>
                </div>

                <div className="bid-quick-options">
                  {Array.from(
                    { length: round.round_number + 1 },
                    (_, index) => index
                  ).map((value) => (
                    <button
                      type="button"
                      key={value}
                      className={
                        selectedBid === value ? "selected" : ""
                      }
                      onClick={() => setSelectedBid(value)}
                      disabled={submittingBid}
                    >
                      {value}
                    </button>
                  ))}
                </div>

                <button
                  className="lobby-primary bid-submit"
                  onClick={submitBid}
                  disabled={submittingBid}
                >
                  <Check size={19} />
                  {submittingBid
                    ? "VALIDATION..."
                    : "VALIDER MON ANNONCE"}
                </button>

                <p className="bid-private-note">
                  <Lock size={14} />
                  Ton annonce restera secrète jusqu'à la validation
                  du dernier joueur.
                </p>
              </>
            ) : (
              <div className="bid-submitted">
                <Check size={26} />
                <strong>ANNONCE VALIDÉE</strong>
                <span>
                  Ton choix est enregistré. Attends les autres pirates.
                </span>
                <Lock size={17} />
              </div>
            )}

            {bidMessage && (
              <p className="bid-message">{bidMessage}</p>
            )}

            <div className="bid-progress-list">
              {bidProgress.map((player) => (
                <div
                  className="bid-progress-player"
                  key={player.player_id}
                >
                  <span>{player.username}</span>
                  {player.has_bid ? (
                    <span className="bid-validated">
                      <Check size={15} /> VALIDÉ
                    </span>
                  ) : (
                    <span className="bid-waiting">EN ATTENTE</span>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {(round.status === "playing" ||
          round.status === "completed") && (
          <div className="bid-reveal">
            <div className="bid-reveal-heading">
              <Eye size={21} />
              <strong>RÉVÉLATION DES ANNONCES</strong>
            </div>

            {bidsAreRevealed ? (
              <div className="bid-reveal-list">
                {revealedBids.map((bid) => (
                  <div
                    className={
                      bid.player_id === userId
                        ? "bid-reveal-player current"
                        : "bid-reveal-player"
                    }
                    key={bid.player_id}
                  >
                    <span>{bid.username}</span>
                    <strong>{bid.bid} pli(s)</strong>
                  </div>
                ))}
              </div>
            ) : (
              <p>Les annonces sont en cours de récupération...</p>
            )}
          </div>
        )}
      </section>

      {/* PLATEAU DU PLI */}
      {round.status === "playing" && (
        <section className="game-trick-panel">
          <div className="game-section-heading">
            <h2>
              <Swords size={19} /> LE PLI EN COURS
            </h2>
            <span>
              {playedCards.length}/{expectedPlayCount || players.length} cartes
            </span>
          </div>

          <div className="trick-status-card">
            <div>
              <span>PREMIER JOUEUR</span>
              <strong>
                {currentTrickLeader?.username ||
                  leader?.username ||
                  "En attente"}
              </strong>
            </div>

            <div>
              <span>PLI</span>
              <strong>{currentTrick?.trick_number || 1}</strong>
            </div>
          </div>

{!currentTrick && nextTrickAt && pauseCountdown > 0 && (
  <div
    style={{
      margin: "14px 0",
      padding: "20px",
      borderRadius: "14px",
      textAlign: "center",
      background: "rgba(246, 201, 76, 0.10)",
      border: "1px solid rgba(246, 201, 76, 0.35)",
    }}
  >
    <strong
      style={{
        display: "block",
        color: "#f6c94c",
        fontSize: "15px",
        letterSpacing: "1px",
      }}
    >
      PROCHAIN PLI : N° {lastResolvedTrickNumber + 1}
    </strong>

    <div
      style={{
        fontSize: "38px",
        fontWeight: 800,
        color: "#ffffff",
        margin: "8px 0",
      }}
    >
      {pauseCountdown}s
    </div>

    <span style={{ color: "#b8c2d4" }}>
      Le prochain pli commence dans quelques secondes...
    </span>
  </div>
)}

      
         <div className="trick-played-list">
            {playedCards.length === 0 ? (
              <div className="trick-empty">
                <Anchor size={30} />
                <strong>LE PLI N'A PAS ENCORE COMMENCÉ</strong>
                <span>Le premier pirate peut jouer sa carte.</span>
              </div>
            ) : (
              playedCards.map((play) => {
                const player = players.find(
                  (item) => item.player_id === play.player_id
                );

                return (
                  <div
                    className="trick-played-card"
                    key={play.id}
                  >
                    <div className="trick-played-player">
                      <span>{play.play_order}</span>
                      <strong>
                        {player?.username || "Pirate"}
                      </strong>
                      {play.player_id === userId && (
                        <small>TOI</small>
                      )}
                    </div>

                    <div
                      className="trick-card-mini"
                      style={{
                        borderColor:
                          suitColors[play.card?.suit || ""] ||
                          "#c9a45c",
                      }}
                    >
                      <span>
                        {play.card?.value ??
                          cardSymbol(play.card?.type || "")}
                      </span>
                      <strong>
                        {play.card?.name || "Carte"}
                      </strong>
                      {play.tigress_mode && (
                        <small>
                          {play.tigress_mode === "pirate"
                            ? "MODE PIRATE"
                            : "MODE FUITE"}
                        </small>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {isWaitingForPlankChoice && currentTrick && (
            <div className="walk-the-plank-choice">
              <div className="game-section-heading">
                <h2>
                  <Skull size={19} /> SUPPLICE DE LA PLANCHE
                </h2>
              </div>

              {currentTrick.walk_the_plank_player_id === userId ? (
                <>
                  <p>
                    Tu as posé le Supplice de la planche. Choisis le Pirate
                    qui sera éliminé de ce pli.
                  </p>

                  <div className="bid-selector">
                    {plankPirates.map((play) => {
                      const targetPlayer = players.find(
                        (player) => player.player_id === play.player_id
                      );

                      return (
                        <button
                          type="button"
                          key={play.id}
                          className={
                            plankTarget === play.player_id ? "selected" : ""
                          }
                          onClick={() => setPlankTarget(play.player_id)}
                          disabled={choosingPlankTarget}
                        >
                          ☠️ {targetPlayer?.username || "Pirate"}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    className="lobby-primary play-card-button"
                    onClick={confirmWalkThePlankTarget}
                    disabled={!plankTarget || choosingPlankTarget}
                  >
                    <Check size={18} />
                    {choosingPlankTarget
                      ? "VALIDATION..."
                      : "CONFIRMER LE PIRATE À ÉLIMINER"}
                  </button>
                </>
              ) : (
                <p>
                  {players.find(
                    (player) =>
                      player.player_id ===
                      currentTrick.walk_the_plank_player_id
                  )?.username || "Le joueur"}{" "}
                  choisit le Pirate à éliminer...
                </p>
              )}
            </div>
          )}

          <div className="trick-action-status">
            {isWaitingForPlankChoice ? (
              <strong>
                <Lock size={17} /> EN ATTENTE DU CHOIX DU SUPPLICE
              </strong>
            ) : allCardsPlayed ? (
              <strong>
                <Check size={17} /> TOUTES LES CARTES SONT POSÉES
              </strong>
            ) : currentPlayerHasPlayed ? (
              <strong>
                <Lock size={17} /> CARTE POSÉE — EN ATTENTE DES AUTRES PIRATES
              </strong>
            ) : isMyTurn ? (
              <strong>
                <Play size={17} /> À TON TOUR DE JOUER
              </strong>
            ) : (
              <strong>
                <Lock size={17} /> EN ATTENTE DU PROCHAIN PIRATE
              </strong>
            )}
          </div>

          {playMessage && (
            <p className="play-message">{playMessage}</p>
          )}
        </section>
      )}

      {rosieCanChoose && (
        <section className="walk-the-plank-choice" aria-live="polite">
          <div className="game-section-heading">
            <h2>🌹 ROSIE LA DOUCE — CHOISIS LE MENEUR</h2>
          </div>
          <p>Tu as remporté un pli avec Rosie. Désigne le joueur qui commencera le prochain pli.</p>
          <div className="plank-target-list">
            {players.map((player) => (
              <button
                type="button"
                key={player.player_id}
                className={rosieTarget === player.player_id ? "plank-target selected" : "plank-target"}
                onClick={() => setRosieTarget(player.player_id)}
                disabled={rosieSaving}
              >
                {player.username}{player.player_id === userId ? " (TOI)" : ""}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="lobby-primary play-card-button"
            onClick={confirmRosieLeader}
            disabled={!rosieTarget || rosieSaving}
          >
            {rosieSaving ? "VALIDATION..." : "CONFIRMER LE MENEUR"}
          </button>
        </section>
      )}

      {rascalCanBet && (
        <section className="walk-the-plank-choice" aria-live="polite">
          <div className="game-section-heading">
            <h2>🎲 RASCAL LE FLAMBEUR — PARI BONUS</h2>
          </div>
          <p>Choisis ton pari : s'il correspond à ta mise exacte, tu gagnes les points. Sinon, tu les perds.</p>
          <div className="plank-target-list">
            {([0, 10, 20] as const).map((stake) => (
              <button
                type="button"
                key={stake}
                className="plank-target"
                onClick={() => chooseRascalBet(stake)}
                disabled={rascalLoading}
              >
                {stake === 0 ? "NE PAS MISER" : `MISER ${stake} POINTS`}
              </button>
            ))}
          </div>
          {rascalLoading && <p>VALIDATION DU PARI...</p>}
        </section>
      )}

      {harryCanAdjust && (
        <section className="walk-the-plank-choice" aria-live="polite">
          <div className="game-section-heading">
            <h2>💪 HARRY LE GÉANT — MODIFIE TA MISE</h2>
          </div>
          <p>Choisis d'augmenter ta mise d'un point, de la réduire d'un point ou de la conserver.</p>
          <div className="plank-target-list">
            {([-1, 0, 1] as const).map((adjustment) => (
              <button
                type="button"
                key={adjustment}
                className="plank-target"
                onClick={() => applyHarryAdjustment(adjustment)}
                disabled={harryLoading}
              >
                {adjustment === -1 ? "−1 POINT" : adjustment === 1 ? "+1 POINT" : "NE RIEN CHANGER"}
              </button>
            ))}
          </div>
          {harryLoading && <p>VALIDATION DU POUVOIR...</p>}
        </section>
      )}

      {bendtCanDraw && (
        <section className="walk-the-plank-choice" aria-live="polite">
          <div className="game-section-heading">
            <h2>🦹 BENDT LE BANDIT — PIoche & DÉFAUSSE</h2>
          </div>
          <p>Pioche deux cartes, puis défausse exactement deux cartes de ta main.</p>
          <button
            type="button"
            className="lobby-primary play-card-button"
            onClick={drawBendtCards}
            disabled={bendtLoading}
          >
            {bendtLoading ? "PIoche..." : "PIOCHER DEUX CARTES"}
          </button>
        </section>
      )}

      {bendtTrickId && !bendtCanDraw && hand.length > 0 && (
        <section className="walk-the-plank-choice" aria-live="polite">
          <div className="game-section-heading">
            <h2>🦹 BENDT — CHOISIS DEUX CARTES À DÉFAUSSER</h2>
          </div>
          <p>{bendtDiscardIds.length}/2 cartes sélectionnées</p>
          <div className="plank-target-list">
            {hand.map((card) => (
              <button
                type="button"
                key={card.id}
                className={bendtDiscardIds.includes(card.id) ? "plank-target selected" : "plank-target"}
                onClick={() => toggleBendtDiscard(card.id)}
                disabled={bendtLoading}
              >
                {cardSymbol(card.type)} {card.name} {card.value ?? ""}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="lobby-primary play-card-button"
            onClick={confirmBendtDiscard}
            disabled={bendtDiscardIds.length !== 2 || bendtLoading}
          >
            {bendtLoading ? "DÉFAUSSE..." : "CONFIRMER LA DÉFAUSSE"}
          </button>
        </section>
      )}

      {juanitaCanPeek && (
        <section className="walk-the-plank-choice" aria-live="polite">
          <div className="game-section-heading">
            <h2>🔮 JUANITA JADE — VISION DE LA PIOCHE</h2>
          </div>
          <p>Tu as remporté un pli avec Juanita. Consulte secrètement les cartes restantes de cette manche.</p>
          {!juanitaPeekCards ? (
            <button
              type="button"
              className="lobby-primary play-card-button"
              onClick={revealJuanitaDrawPile}
              disabled={juanitaPeekLoading}
            >
              {juanitaPeekLoading ? "OUVERTURE..." : "REGARDER LA PIOCHE"}
            </button>
          ) : (
            <div className="trick-played-list">
              <strong>TA VISION PRIVÉE — {juanitaPeekCards.length} CARTE(S)</strong>
              {juanitaPeekCards.map((card, index) => (
                <div className="trick-played-card" key={card.id || index}>
                  <div className="trick-card-mini">
                    <span>{card.value ?? cardTypeNames[card.type] ?? card.type}</span>
                    <strong>{card.name}</strong>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <details className="quick-chat-dock" aria-label="Messages rapides">
        <summary className="quick-chat-trigger">
          <span className="quick-chat-trigger-icon">💬</span>
          <span>CHAT DE L'ÉQUIPAGE</span>
          <span className="quick-chat-trigger-count">{quickPhrases.length}</span>
        </summary>
        <div className="quick-chat-menu">
          <div className="game-section-heading">
            <h2>RÉACTIONS RAPIDES</h2>
            <span>Choisis une phrase</span>
          </div>
          <div className="quick-chat-options">{quickPhrases.map((item) => <button type="button" key={item.id} className="quick-chat-pill" onClick={() => void sendQuickChat(item.phrase)} disabled={sendingChat}>{item.phrase}</button>)}</div>
          {chatError && <p role="alert" className="play-message">{chatError}</p>}
        </div>
      </details>

      {showPlayedCardsWindow && <div className="game-modal-backdrop" onClick={() => setShowPlayedCardsWindow(false)}><section className="game-modal-window played-cards-modal" onClick={(event) => event.stopPropagation()}><header><strong>ORDRE DES CARTES JOUÉES</strong><button type="button" onClick={() => setShowPlayedCardsWindow(false)} aria-label="Fermer"><X /></button></header><ol>{playedCards.map((play) => { const card=play.card as GameCard; return <li key={play.id}><span>{play.play_order}.</span><strong>{players.find(p=>p.player_id===play.player_id)?.username ?? "Pirate"}</strong><span>{card.name} · {card.value ?? cardTypeNames[card.type] ?? card.type}</span></li>; })}</ol></section></div>}
      {showChatWindow && <div className="game-modal-backdrop" onClick={() => setShowChatWindow(false)}><section className="game-modal-window chat-modal" onClick={(event) => event.stopPropagation()}><header><strong>CHAT DE L'ÉQUIPAGE</strong><button type="button" onClick={() => setShowChatWindow(false)} aria-label="Fermer"><X /></button></header><div className="chat-modal-messages">{chatMessages.slice(-12).map(message => <p key={message.id}><b>{message.username}</b><span>{message.phrase}</span></p>)}</div><div className="quick-chat-options">{quickPhrases.map(item => <button type="button" key={item.id} className="quick-chat-pill" onClick={() => void sendQuickChat(item.phrase)} disabled={sendingChat}>{item.phrase}</button>)}</div>{chatError && <p role="alert">{chatError}</p>}</section></div>}
      {maryCanChoose && (
        <section className="selected-card-panel" aria-live="polite">
          <div className="selected-card-heading">
            <div>
              <span>POUVOIR DE PIRATE</span>
              <strong>MARY THRONE</strong>
              <small>Choisis un adversaire. Une carte aléatoire de sa main sera gardée secrète et devra être jouée en plus au prochain pli de cette manche.</small>
            </div>
          </div>
          <div className="tigress-choice">
            <strong>CHOISIR UN ADVERSAIRE</strong>
            <div>
              {players.filter((player) => player.player_id !== userId).map((player) => (
                <button
                  type="button"
                  key={player.player_id}
                  className={maryTarget === player.player_id ? "selected" : ""}
                  onClick={() => setMaryTarget(player.player_id)}
                >
                  {player.username}
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            className="lobby-primary play-card-button"
            disabled={!maryTarget || marySaving}
            onClick={() => void confirmMaryTarget()}
          >
            {marySaving ? "TIRAGE EN COURS..." : "CONFIRMER LE CHOIX"}
          </button>
        </section>
      )}

      {/* ÉQUIPAGE */}
      <section className="game-crew">
        <div className="game-section-heading">
          <h2>
            <Users size={19} /> TON ÉQUIPAGE
          </h2>
          <span>{players.length} joueurs</span>
        </div>

        <div className="game-player-list">
          {players.map((player, playerIndex) => {
            const mySeatIndex = Math.max(0, players.findIndex((item) => item.player_id === userId));
            const relativeSeat = (playerIndex - mySeatIndex + players.length) % Math.max(players.length, 1);
            const latestBubble = chatMessages[chatMessages.length - 1];
            const showBubble = latestBubble?.player_id === player.player_id && chatNow - new Date(latestBubble.created_at).getTime() < 2000;
            const hasPlayed = playedCards.some(
              (play) => play.player_id === player.player_id
            );

            return (
              <div
                className={`game-player game-player-seat-${relativeSeat} ${player.player_id === userId ? "current" : ""}`}
                key={player.player_id}
                style={{ left: `${50 + 43 * Math.cos((2 * Math.PI * relativeSeat / Math.max(players.length, 1)) - Math.PI / 2)}%`, top: `${50 + 42 * Math.sin((2 * Math.PI * relativeSeat / Math.max(players.length, 1)) - Math.PI / 2)}%`, transform: "translate(-50%, -50%)" }}
              >
                {showBubble && latestBubble && <div className="player-chat-bubble" key={latestBubble.id}>{latestBubble.phrase}</div>}
                <div className="game-player-portrait-frame">
                  <div className="game-player-avatar">
                    {player.avatar_url ? <img src={player.avatar_url} alt={`Portrait de ${player.username}`} /> : player.isHost ? (
                      <Crown size={20} />
                    ) : (
                      <Skull size={20} />
                    )}
                  </div>
                  {player.isHost && <span className="game-player-crown" aria-label="Capitaine">♛</span>}
                </div>

                <div className="game-player-info">
                  <strong>
                    {player.username}
                    {player.player_id === userId ? " (TOI)" : ""}
                  </strong>
                  <span>
                    {player.isHost ? "CAPITAINE" : "PIRATE"}
                  </span>
                  <div className="game-player-round-stats">
                    <span>MISE <b>{revealedBids.find((bid) => bid.player_id === player.player_id)?.bid ?? "—"}</b></span>
                    <span>PLIS <b>{roundTricksWon[player.player_id] ?? 0}</b></span>
                  </div>
                </div>

                {player.player_id === round.leader_player_id && (
                  <span className="leader-tag">
                    PREMIER JOUEUR
                  </span>
                )}

                {round.status === "playing" && (
                  <span className="player-play-status">
                    {hasPlayed ? (
                      <Check size={16} />
                    ) : (
                      <Lock size={15} />
                    )}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* MAIN DU JOUEUR */}
      <section className="game-hand-section">
        <div className="game-section-heading">
          <h2>
            <Shield size={19} /> TA MAIN
          </h2>
          <span>{hand.length} carte(s)</span>
        </div>

        <p className="game-hand-hint">
          Tes cartes sont privées. Fais glisser une carte vers le haut, en direction de l’arène, pour la jouer. Sur les cartes à choix, le glissement ouvre d’abord leurs options.
        </p>

        {hand.length === 0 ? (
          <div className="game-empty-hand">
            Aucune carte dans ta main pour le moment.
          </div>
        ) : (
          <div className="game-hand">
            {hand.map((card) => {
              const isSelected = selectedCard?.id === card.id;

              return (
                <button
                  type="button"
                  className={`game-card game-card--${card.type} ${card.isExpansionCard ? "game-card--expansion" : ""} ${isSelected ? "game-card-selected" : ""} ${draggingCardId === card.id ? "game-card-dragging" : ""}`}
                  key={card.id}
                  onPointerDown={(event) => handleHandCardPointerDown(event, card)}
                  onPointerUp={(event) => handleHandCardPointerUp(event, card)}
                  onPointerCancel={() => { dragStartRef.current = null; setDraggingCardId(null); }}
                  onClick={() => {
                    if (suppressCardClickRef.current) {
                      suppressCardClickRef.current = false;
                      return;
                    }
                    if (
                      round.status !== "playing" ||
                      !isMyTurn ||
                      currentPlayerHasPlayed ||
                      playingCard ||
                      isWaitingForPlankChoice
                    ) {
                      return;
                    }

                    setSelectedCard(isSelected ? null : card);
                    setChosenValue(card.selectableValue?.[0] ?? null);
                    setChosenSuit("green");
                    setPlayMessage("");
                    setShowPlayConfirmation(false);
                  }}
                  disabled={
                    round.status !== "playing" ||
                    !isMyTurn ||
                    currentPlayerHasPlayed ||
                    playingCard ||
                    isWaitingForPlankChoice ||
                    hand.length === 0
                  }
                  style={{
                    borderColor:
                      suitColors[card.suit || ""] || "#c9a45c",
                    cursor:
                      round.status === "playing" && isMyTurn
                        ? "pointer"
                        : "default",
                  }}
                >
                  <div
                    className="game-card-top"
                    style={{
                      borderColor:
                        suitColors[card.suit || ""] || "#c9a45c",
                    }}
                  >
                    <span>
                      {card.suit
                        ? suitNames[card.suit] || card.suit
                        : "SPÉCIALE"}
                    </span>
                    <strong>
                      {card.value ?? cardSymbol(card.type)}
                    </strong>
                  </div>

                  <div className="game-card-art">
                    <span className="game-card-symbol">
                      {cardSymbol(card.type)}
                    </span>
                  </div>

                  <div className="game-card-name">
                    {card.name}
                  </div>

                  {isSelected && (
                    <div className="game-card-selection">
                      <Check size={17} />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {selectedCard && round.status === "playing" && (
          <div className="selected-card-panel">
            <div className="selected-card-heading">
              <div>
                <span>CARTE SÉLECTIONNÉE</span>
                <strong>{selectedCard.name}</strong>
                <small>
                  {cardTypeNames[selectedCard.type] ||
                    selectedCard.type.toUpperCase()}
                </small>
              </div>

              <button
                type="button"
                onClick={() => {
                  setSelectedCard(null);
                  setChosenValue(null);
                  setChosenSuit("green");
                  setShowPlayConfirmation(false);
                }}
                aria-label="Annuler la sélection"
              >
                <X size={19} />
              </button>
            </div>

            {selectedCard.selectableValue?.length ? (
              <div className="tigress-choice">
                <strong>CHOISIS LA VALEUR DE TA CARTE</strong>
                <div>
                  {selectedCard.selectableValue.map((value) => (
                    <button
                      type="button"
                      key={value}
                      className={chosenValue === value ? "selected" : ""}
                      onClick={() => setChosenValue(value)}
                    >
                      {value}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {selectedCard.type === "joker" && (jokerBlackLead ? (
              <p className="play-message">Le noir est déjà demandé : le Joker joue sans déclarer de couleur.</p>
            ) : (
              <div className="tigress-choice">
                <strong>CHOISIS LA COULEUR DU JOKER</strong>
                <div>
                  {(["green", "purple", "yellow"] as const).map((suit) => (
                    <button
                      type="button"
                      key={suit}
                      className={chosenSuit === suit ? "selected" : ""}
                      onClick={() => setChosenSuit(suit)}
                      style={{ borderColor: suitColors[suit] }}
                    >
                      {suitNames[suit]}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            {selectedCard.type === "tigress" && (
              <div className="tigress-choice">
                <strong>CHOISIS LE POUVOIR DE LA TIGRESSE</strong>

                <div>
                  <button
                    type="button"
                    className={
                      tigressMode === "pirate" ? "selected" : ""
                    }
                    onClick={() => setTigressMode("pirate")}
                  >
                    <Skull size={18} />
                    PIRATE
                  </button>

                  <button
                    type="button"
                    className={
                      tigressMode === "escape" ? "selected" : ""
                    }
                    onClick={() => setTigressMode("escape")}
                  >
                    <Shield size={18} />
                    FUITE
                  </button>
                </div>
              </div>
            )}

            {!showPlayConfirmation ? (
              <button
                type="button"
                className="lobby-primary play-card-button"
                disabled={!isMyTurn || playingCard}
                onClick={() => setShowPlayConfirmation(true)}
              >
                <Play size={18} />
                POSER CETTE CARTE
              </button>
            ) : (
              <div className="play-confirmation">
                <p>
                  Confirmer la pose de <strong>{selectedCard.name}</strong> ?
                </p>

                <button
                  type="button"
                  className="lobby-primary"
                  onClick={playSelectedCard}
                  disabled={playingCard || !isMyTurn}
                >
                  <Check size={18} />
                  {playingCard ? "ENVOI..." : "CONFIRMER"}
                </button>

                <button
                  type="button"
                  onClick={() => setShowPlayConfirmation(false)}
                  disabled={playingCard}
                >
                  ANNULER
                </button>
              </div>
            )}
          </div>
        )}

        {round.status === "playing" && currentPlayerHasPlayed && (
          <div className="game-empty-hand">
            <Lock size={19} />
            Tu as déjà joué. Attends les autres pirates.
          </div>
        )}

        {round.status === "bidding" && (
          <div className="game-empty-hand">
            Les cartes seront jouables après la validation des enchères.
          </div>
        )}
      </section>

      <footer className="game-footer">
        <span>
          <Shield size={15} /> MAIN PERSONNELLE SÉCURISÉE
        </span>
        <span>
          {currentPlayer?.username || "JOUEUR"}
        </span>
      </footer>
    </main>
  );
}
