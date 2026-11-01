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
      .select("id, trick_number, status, leader_player_id")
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
    if (!round || !selectedCard || playingCard) return;
    if (selectedCard.selectableValue?.length && chosenValue === null) {
      setPlayMessage("Choisis la valeur de cette carte.");
      return;
    }
    if (selectedCard.type === "joker" && !["green", "purple", "yellow"].includes(chosenSuit)) {
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
        p_chosen_suit: selectedCard.type === "joker"
          ? chosenSuit
          : null,
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

  const isMyTurn =
    round?.status === "playing" &&
    !currentPlayerHasPlayed &&
    !allCardsPlayed;

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
              <strong>
                {currentTrick?.trick_number || 1}
              </strong>
            </div>
          </div>

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

          <div className="trick-action-status">
            {allCardsPlayed ? (
              <strong>
                <Check size={17} /> TOUTES LES CARTES SONT POSÉES
              </strong>
            ) : currentPlayerHasPlayed ? (
              <strong>
                <Lock size={17} /> CARTE POSÉE — EN ATTENTE DES AUTRES PIRATES
              </strong>
            ) : (
              <strong>
                <Play size={17} /> À TON TOUR DE JOUER
              </strong>
            )}
          </div>

          {playMessage && (
            <p className="play-message">{playMessage}</p>
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
                      currentPlayerHasPlayed ||
                      playingCard
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
