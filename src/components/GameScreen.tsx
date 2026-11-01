import { useCallback, useEffect, useState } from "react";
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
};

type GameRound = {
  id: string;
  room_id: string;
  round_number: number;
  status: string;
  leader_player_id: string | null;
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

  const [players, setPlayers] = useState<GamePlayer[]>([]);
  const [scoreboard, setScoreboard] = useState<ScoreboardEntry[]>([]);
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
  const [juanitaTrickId, setJuanitaTrickId] = useState<string | null>(null);
  const [juanitaCanPeek, setJuanitaCanPeek] = useState(false);
  const [juanitaPeekCards, setJuanitaPeekCards] = useState<GameCard[] | null>(null);
  const [juanitaPeekLoading, setJuanitaPeekLoading] = useState(false);
  
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
      .select("room_name, status, host_id")
      .eq("id", roomId)
      .single();

    if (roomError) {
      setError("Impossible de charger le salon.");
      setLoading(false);
      return;
    }

    setRoomName(room.room_name || "SKULL ARENA");
    setRoomStatus(room.status || "waiting");

    if (room.status !== "playing" && room.status !== "finished") {
      setError("Cette partie n'est pas en cours.");
      setLoading(false);
      return;
    }

    const { data: roundData, error: roundError } = await supabase
      .from("game_rounds")
      .select("id, room_id, round_number, status, leader_player_id")
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
      .select("id, username")
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
        profile.username,
      ])
    );

    setPlayers(
      (roomPlayers || []).map((player) => ({
        player_id: player.player_id,
        username:
          profileMap.get(player.player_id) || "Pirate inconnu",
        isHost: player.player_id === room.host_id,
      }))
    );

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
    | { pirate_power_triggers?: Array<{ player_id?: string; power?: string }> }
    | null;
  const powerTriggers = resolvedMetadata?.pirate_power_triggers ?? [];
  const rosieTrigger = powerTriggers.some(
    (trigger) => trigger.player_id === currentUserId && trigger.power === "rosie"
  );
  setRosieCanChoose(Boolean(rosieTrigger && lastResolvedTrick?.id));
  setRosieTrickId(rosieTrigger ? lastResolvedTrick?.id ?? null : null);
  const juanitaTrigger = powerTriggers.some(
    (trigger) => trigger.player_id === currentUserId && trigger.power === "juanita"
  );
  const canPeekWithJuanita = Boolean(
    juanitaTrigger && lastResolvedTrick?.id &&
    lastResolvedTrick.trick_number < currentRound.round_number
  );
  setJuanitaCanPeek(canPeekWithJuanita);
  setJuanitaTrickId(canPeekWithJuanita ? lastResolvedTrick?.id ?? null : null);
  if (!canPeekWithJuanita) setJuanitaPeekCards(null);

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
    loadGame();

    const refreshInterval = window.setInterval(() => {
      loadGame();
    }, 3000);

    const channel = supabase
      .channel(`game-screen-${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "game_rooms",
          filter: `id=eq.${roomId}`,
        },
        () => loadGame()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "player_scores",
          filter: `room_id=eq.${roomId}`,
        },
        () => loadGame()
      )
     
.on(
  "postgres_changes",
  {
    event: "*",
    schema: "public",
    table: "player_round_scores",
    filter: `room_id=eq.${roomId}`,
  },
  () => loadGame()
)
.on(
  "postgres_changes",
  {
    event: "*",
    schema: "public",
    table: "player_bids",
  },
  () => loadGame()
)
      
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "game_rounds",
          filter: `room_id=eq.${roomId}`,
        },
        () => loadGame()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "player_hands",
        },
        () => loadGame()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "room_players",
          filter: `room_id=eq.${roomId}`,
        },
        () => loadGame()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "game_tricks",
        },
        () => loadGame()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "trick_plays",
        },
        () => loadGame()
      )
      .subscribe();



    
    return () => {
      window.clearInterval(refreshInterval);
      supabase.removeChannel(channel);
    };
  }, [roomId, loadGame]);

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

  const playSelectedCard = async () => {
    if (!round || !selectedCard || playingCard || !isMyTurn) return;

    if (selectedCard.selectableValue?.length && chosenValue === null) {
      setPlayMessage("Choisis la valeur de cette carte.");
      return;
    }

    if (
      selectedCard.type === "joker" &&
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
          selectedCard.type === "joker" ? chosenSuit : null,
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

  const currentPlayerHasPlayed = playedCards.some(
    (play) => play.player_id === userId
  );

  const playerCount = players.length;

  const allCardsPlayed =
    playerCount > 0 && playedCards.length >= playerCount;

  // ORDRE DE JEU
  // L'ordre de passage suit l'ordre d'arrivée dans le salon,
  // en partant du leader enregistré pour le pli en cours.
  const turnLeaderId =
    currentTrick?.leader_player_id || round?.leader_player_id;

  const turnLeaderIndex = players.findIndex(
    (player) => player.player_id === turnLeaderId
  );

  const expectedPlayer =
    playerCount > 0 && turnLeaderIndex >= 0
      ? players[(turnLeaderIndex + playedCards.length) % playerCount]
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

      {/* CLASSEMENT EN DIRECT */}
      <section
        className="game-scoreboard"
        style={{
          margin: "18px 0",
          padding: "18px",
          borderRadius: "16px",
          background: "rgba(12, 20, 35, 0.92)",
          border: "1px solid rgba(246, 201, 76, 0.25)",
        }}
      >
        <div className="game-section-heading">
          <h2>
            <Crown size={19} /> CLASSEMENT DE L'ÉQUIPAGE
          </h2>
          <span>EN DIRECT</span>
        </div>

        {scoreboard.length === 0 ? (
          <p>Aucun score enregistré pour le moment.</p>
        ) : (
          <div style={{ display: "grid", gap: "9px" }}>
            {scoreboard.map((player) => {
              const isCurrentPlayer = player.player_id === userId;

              return (
                <div
                  key={player.player_id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "36px minmax(0, 1fr) auto",
                    alignItems: "center",
                    gap: "10px",
                    padding: "12px",
                    borderRadius: "10px",
                    background: isCurrentPlayer
                      ? "rgba(246, 201, 76, 0.12)"
                      : "rgba(255,255,255,0.035)",
                    border: isCurrentPlayer
                      ? "1px solid rgba(246, 201, 76, 0.45)"
                      : "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  <strong style={{ color: "#f6c94c" }}>
                    #{player.rank_position}
                  </strong>

                  <div style={{ minWidth: 0 }}>
                    <strong>
                      {player.username}
                      {isCurrentPlayer ? " (TOI)" : ""}
                    </strong>

                    <div style={{ fontSize: "12px", opacity: 0.7 }}>
                      {player.tricks_won} plis gagnés ·{" "}
                      {player.rounds_played} manches
                    </div>
                  </div>

                  <strong
                    style={{
                      color: "#f6c94c",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {player.total_score} pts
                  </strong>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="game-arena">
        <div className="arena-heading">
          <Anchor size={17} />
          <span>LE PLATEAU DES PIRATES</span>
        </div>

        <div className="arena-table">
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
              {playedCards.length}/{players.length} cartes
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

      {/* ÉQUIPAGE */}
      <section className="game-crew">
        <div className="game-section-heading">
          <h2>
            <Users size={19} /> TON ÉQUIPAGE
          </h2>
          <span>{players.length} joueurs</span>
        </div>

        <div className="game-player-list">
          {players.map((player) => {
            const hasPlayed = playedCards.some(
              (play) => play.player_id === player.player_id
            );

            return (
              <div
                className={
                  player.player_id === userId
                    ? "game-player current"
                    : "game-player"
                }
                key={player.player_id}
              >
                <div className="game-player-avatar">
                  {player.isHost ? (
                    <Crown size={20} />
                  ) : (
                    <Skull size={20} />
                  )}
                </div>

                <div className="game-player-info">
                  <strong>
                    {player.username}
                    {player.player_id === userId ? " (TOI)" : ""}
                  </strong>
                  <span>
                    {player.isHost ? "CAPITAINE" : "PIRATE"}
                  </span>
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
          Tes cartes sont privées. Seul ton compte peut consulter cette main.
          {round.status === "playing" &&
            " Sélectionne une carte pour la jouer."}
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
                  className={`game-card ${
                    isSelected ? "game-card-selected" : ""
                  }`}
                  key={card.id}
                  onClick={() => {
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

            {selectedCard.type === "joker" && (
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
            )}

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
