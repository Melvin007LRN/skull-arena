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
  const [players, setPlayers] = useState<GamePlayer[]>([]);
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

    if (room.status !== "playing") {
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
      setError("Ta main personnelle est introuvable.");
      setLoading(false);
      return;
    }

    const currentHand = Array.isArray(handData.cards)
      ? (handData.cards as GameCard[])
      : [];

    setHand(currentHand);

    const { data: roomPlayers, error: playersError } = await supabase
      .from("room_players")
      .select("player_id")
      .eq("room_id", roomId)
      .order("joined_at", { ascending: true });

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

    // Progression des enchères.
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

    // Chargement du pli en cours.
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
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "player_hands",
        },
        () => loadGame()
      )
      .subscribe();

    return () => {
      window.clearInterval(refreshInterval);
      supabase.removeChannel(channel);
    };
  }, [loadGame, roomId]);

  const currentPlayer = players.find(
    (player) => player.player_id === userId
  );

  const currentPlayerHasPlayed = playedCards.some(
    (play) => play.player_id === userId
  );

  const isMyTurn =
    round?.status === "playing" &&
    !currentPlayerHasPlayed &&
    playedCards.length < players.length;

  const isWaitingForPlankChoice =
    currentTrick?.resolution?.status ===
    "awaiting_walk_the_plank_target";

  const plankPlayer = players.find(
    (player) =>
      player.player_id === currentTrick?.walk_the_plank_player_id
  );

  const availablePlankTargets = playedCards
    .filter(
      (play) =>
        play.card.type === "pirate" ||
        (play.card.type === "tigress" &&
          play.tigress_mode === "pirate")
    )
    .map((play) => ({
      player_id: play.player_id,
      username:
        players.find((player) => player.player_id === play.player_id)
          ?.username || "Pirate",
    }))
    .filter(
      (target, index, array) =>
        array.findIndex(
          (item) => item.player_id === target.player_id
        ) === index
    );

  const submitBid = async () => {
    if (!round || submittingBid || hasSubmittedBid) return;

    setSubmittingBid(true);
    setBidMessage("");

    const { data, error: submitError } = await supabase.rpc(
      "submit_player_bid",
      {
        p_round_id: round.id,
        p_bid: selectedBid,
      }
    );

    if (submitError) {
      setBidMessage(submitError.message);
      setSubmittingBid(false);
      return;
    }

    setBidMessage(
      data?.all_bids_submitted
        ? "Toutes les enchères sont validées. La manche commence !"
        : "Enchère enregistrée. Attends les autres pirates."
    );

    await loadGame();
    setSubmittingBid(false);
  };

  const playSelectedCard = async () => {
    if (!round || !selectedCard || playingCard || !isMyTurn) return;

    setPlayingCard(true);
    setPlayMessage("");

    const { data, error: playError } = await supabase.rpc("play_card", {
      p_round_id: round.id,
      p_card_id: selectedCard.id,
      p_tigress_mode:
        selectedCard.type === "tigress" ? tigressMode : null,
      p_chosen_value: chosenValue,
      p_chosen_suit:
        selectedCard.type === "joker" ? chosenSuit : null,
    });

    if (playError) {
      setPlayMessage(playError.message);
      setPlayingCard(false);
      return;
    }

    setPlayMessage("Carte posée !");
    setSelectedCard(null);
    setChosenValue(null);
    setShowPlayConfirmation(false);

    await loadGame();
    setPlayingCard(false);
  };

  const confirmWalkThePlankTarget = async () => {
    if (!currentTrick || !plankTarget || choosingPlankTarget) return;

    setChoosingPlankTarget(true);
    setPlayMessage("");

    const { error: targetError } = await supabase.rpc(
      "choose_walk_the_plank_target",
      {
        p_trick_id: currentTrick.id,
        p_target_player_id: plankTarget,
      }
    );

    if (targetError) {
      setPlayMessage(targetError.message);
      setChoosingPlankTarget(false);
      return;
    }

    setPlayMessage("Cible du Supplice de la planche sélectionnée.");
    setPlankTarget("");
    await loadGame();
    setChoosingPlankTarget(false);
  };

  if (loading) {
    return (
      <main className="game-screen">
        <div className="game-loading">
          <Anchor size={34} />
          <p>Préparation de l'arène...</p>
        </div>
      </main>
    );
  }

  if (error || !round) {
    return (
      <main className="game-screen">
        <div className="game-error">
          <Skull size={36} />
          <h2>Impossible de rejoindre l'arène</h2>
          <p>{error || "Partie introuvable."}</p>
          <button type="button" onClick={onExit}>
            <ArrowLeft size={17} /> RETOUR AU SALON
          </button>
          <button type="button" onClick={loadGame}>
            <RefreshCw size={17} /> RÉESSAYER
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="game-screen">
      <header className="game-header">
        <button
          type="button"
          className="game-back-button"
          onClick={onExit}
        >
          <ArrowLeft size={19} />
          QUITTER
        </button>

        <div className="game-header-title">
          <span>SKULL ARENA</span>
          <h1>{roomName}</h1>
          <small>MANCHE {round.round_number}</small>
        </div>

        <button
          type="button"
          className="game-refresh-button"
          onClick={loadGame}
          aria-label="Actualiser la partie"
        >
          <RefreshCw size={18} />
        </button>
      </header>

      {playMessage && (
        <div className="game-message">
          {playMessage}
        </div>
      )}

      {/* ENCHÈRES */}
      {round.status === "bidding" && (
        <section className="game-bidding-section">
          <div className="game-section-heading">
            <h2>
              <Eye size={19} /> ANNONCE TON ENCHÈRE
            </h2>
            <span>
              {bidProgress.filter((item) => item.has_bid).length}/
              {players.length}
            </span>
          </div>

          <p>
            Choisis le nombre de plis que tu penses remporter pendant
            cette manche.
          </p>

          <div className="bid-selector">
            <button
              type="button"
              onClick={() =>
                setSelectedBid((value) => Math.max(0, value - 1))
              }
              disabled={selectedBid <= 0 || hasSubmittedBid}
              aria-label="Diminuer l'enchère"
            >
              <Minus size={20} />
            </button>

            <strong>{selectedBid}</strong>

            <button
              type="button"
              onClick={() =>
                setSelectedBid((value) =>
                  Math.min(round.round_number, value + 1)
                )
              }
              disabled={
                selectedBid >= round.round_number || hasSubmittedBid
              }
              aria-label="Augmenter l'enchère"
            >
              <Plus size={20} />
            </button>
          </div>

          <button
            type="button"
            className="lobby-primary"
            onClick={submitBid}
            disabled={submittingBid || hasSubmittedBid}
          >
            {submittingBid
              ? "VALIDATION..."
              : hasSubmittedBid
                ? "ENCHÈRE VALIDÉE"
                : "CONFIRMER MON ENCHÈRE"}
          </button>

          {bidMessage && <p className="game-message">{bidMessage}</p>}

          <div className="bid-progress-list">
            {bidProgress.map((player) => (
              <div key={player.player_id}>
                <span>{player.username}</span>
                {player.has_bid ? (
                  <span className="bid-ready">
                    <Check size={15} /> PRÊT
                  </span>
                ) : (
                  <span className="bid-waiting">
                    <Lock size={14} /> EN ATTENTE
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ENCHÈRES RÉVÉLÉES */}
      {revealedBids.length > 0 && (
        <section className="game-bids-revealed">
          <div className="game-section-heading">
            <h2>
              <Eye size={19} /> ENCHÈRES RÉVÉLÉES
            </h2>
          </div>

          <div className="revealed-bids-list">
            {revealedBids.map((bid) => (
              <div key={bid.player_id}>
                <span>{bid.username}</span>
                <strong>{bid.bid}</strong>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* TABLEAU DES JOUEURS */}
      <section className="game-players-section">
        <div className="game-section-heading">
          <h2>
            <Users size={19} /> ÉQUIPAGE
          </h2>
          <span>{players.length} pirates</span>
        </div>

        <div className="game-players-list">
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

      {/* PLI EN COURS */}
      {round.status === "playing" && (
        <section className="game-trick-section">
          <div className="game-section-heading">
            <h2>
              <Swords size={19} /> PLI EN COURS
            </h2>
            <span>
              {playedCards.length}/{players.length} cartes
            </span>
          </div>

          {!currentTrick ? (
            <div className="game-empty-hand">
              Le prochain pli va commencer...
            </div>
          ) : (
            <>
              <div className="played-cards">
                {playedCards.map((play) => {
                  const player = players.find(
                    (item) => item.player_id === play.player_id
                  );

                  return (
                    <div className="played-card" key={play.id}>
                      <div className="played-card-player">
                        {player?.username || "Pirate"}
                      </div>
                      <div
                        className="played-card-visual"
                        style={{
                          borderColor:
                            suitColors[play.card.suit || ""] ||
                            "#c9a45c",
                        }}
                      >
                        <span>
                          {play.card.value ??
                            cardSymbol(play.card.type)}
                        </span>
                        <strong>{play.card.name}</strong>
                        <small>
                          {play.tigress_mode
                            ? play.tigress_mode.toUpperCase()
                            : cardTypeNames[play.card.type] ||
                              play.card.type.toUpperCase()}
                        </small>
                      </div>
                    </div>
                  );
                })}
              </div>

              {isWaitingForPlankChoice && currentTrick && (
                <div className="walk-the-plank-choice">
                  <h3>☠ SUPPLICE DE LA PLANCHE</h3>
                  <p>
                    {plankPlayer?.username || "Le joueur"} a joué le
                    Supplice de la planche. Il doit choisir le pirate
                    qui sera éliminé de ce pli.
                  </p>

                  {currentTrick.walk_the_plank_player_id === userId ? (
                    <>
                      <strong>CHOISIS TA CIBLE</strong>

                      <div className="plank-target-list">
                        {availablePlankTargets.map((target) => (
                          <button
                            type="button"
                            key={target.player_id}
                            className={
                              plankTarget === target.player_id
                                ? "selected"
                                : ""
                            }
                            onClick={() =>
                              setPlankTarget(target.player_id)
                            }
                            disabled={choosingPlankTarget}
                          >
                            <Skull size={17} />
                            {target.username}
                            {plankTarget === target.player_id && (
                              <Check size={16} />
                            )}
                          </button>
                        ))}
                      </div>

                      <button
                        type="button"
                        className="lobby-primary"
                        onClick={confirmWalkThePlankTarget}
                        disabled={!plankTarget || choosingPlankTarget}
                      >
                        {choosingPlankTarget
                          ? "VALIDATION..."
                          : "CONFIRMER LA CIBLE"}
                      </button>
                    </>
                  ) : (
                    <p>
                      En attente du choix de{" "}
                      <strong>
                        {plankPlayer?.username || "l'adversaire"}
                      </strong>
                      ...
                    </p>
                  )}
                </div>
              )}

              {currentTrick.resolution?.status === "target_selected" && (
                <div className="game-message">
                  La cible du Supplice de la planche a été choisie.
                  Le pli attend sa résolution.
                </div>
              )}
            </>
          )}
        </section>
      )}

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
                      currentPlayerHasPlayed ||
                      playingCard ||
                      isWaitingForPlankChoice
                    ) {
                      return;
                    }

                    setSelectedCard(
                      isSelected ? null : card
                    );
                    setChosenValue(card.selectableValue?.[0] ?? null);
                    setChosenSuit("green");
                    setPlayMessage("");
                    setShowPlayConfirmation(false);
                  }}
                  disabled={
                    round.status !== "playing" ||
                    currentPlayerHasPlayed ||
                    playingCard ||
                    isWaitingForPlankChoice ||
                    hand.length === 0
                  }
                  style={{
                    borderColor:
                      suitColors[card.suit || ""] || "#c9a45c",
                    cursor:
                      round.status === "playing" &&
                      !currentPlayerHasPlayed
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
                      {card.value ??
                        cardSymbol(card.type)}
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
                  disabled={playingCard}
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
