
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
} from "lucide-react";
import { supabase } from "../lib/supabase";

type GameCard = {
  id: string;
  name: string;
  type: string;
  suit?: string;
  value?: number;
  selectableValue?: number[];
  isExpansionCard?: boolean;
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
      .select("room_name, status")
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

    setHand(Array.isArray(handData.cards) ? handData.cards : []);

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

    const { data: roomData } = await supabase
      .from("game_rooms")
      .select("host_id")
      .eq("id", roomId)
      .single();

    setPlayers(
      (roomPlayers || []).map((player) => ({
        player_id: player.player_id,
        username:
          profileMap.get(player.player_id) || "Pirate inconnu",
        isHost: player.player_id === roomData?.host_id,
      }))
    );

    // Récupération de la progression des enchères.
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

      // Les valeurs ne sont récupérées qu'après
      // validation de tous les joueurs.
      if (
        currentRound.status === "playing" ||
        currentRound.status === "completed"
      ) {
        const { data: revealedData, error: revealedError } =
          await supabase.rpc("get_revealed_bids", {
            p_round_id: currentRound.id,
          });

        if (revealedError) {
  console.error("ERREUR RÉVÉLATION DES ENCHÈRES :", revealedError);
  setBidMessage(
    `Erreur de révélation : ${revealedError.message}`
  );
} else if (revealedData) {
  setRevealedBids(revealedData as RevealedBid[]);
  setBidMessage("");
}
      } else {
        setRevealedBids([]);
      }
    }

    setLoading(false);
  }, [roomId]);

  useEffect(() => {
    loadGame();

    // Actualisation régulière de la progression.
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
    revealedBids.length > 0 &&
    allPlayersSubmitted;

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
                    <span className="bid-waiting">
                      EN ATTENTE
                    </span>
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
              <p>
                Les annonces sont en cours de récupération...
              </p>
            )}
          </div>
        )}
      </section>

      <section className="game-crew">
        <div className="game-section-heading">
          <h2>
            <Users size={19} /> TON ÉQUIPAGE
          </h2>
          <span>{players.length} joueurs</span>
        </div>

        <div className="game-player-list">
          {players.map((player) => (
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
                <span className="leader-tag">PREMIER JOUEUR</span>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="game-hand-section">
        <div className="game-section-heading">
          <h2>
            <Shield size={19} /> TA MAIN
          </h2>
          <span>{hand.length} carte(s)</span>
        </div>

        <p className="game-hand-hint">
          Tes cartes sont privées. Seul ton compte peut consulter cette main.
        </p>

        {hand.length === 0 ? (
          <div className="game-empty-hand">
            Aucune carte dans ta main pour le moment.
          </div>
        ) : (
          <div className="game-hand">
            {hand.map((card) => (
              <article className="game-card" key={card.id}>
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
                      (card.type === "escape"
                        ? "F"
                        : card.type === "pirate"
                          ? "P"
                          : card.type === "mermaid"
                            ? "S"
                            : "★")}
                  </strong>
                </div>

                <div className="game-card-art">
                  {card.type === "escape" ? (
                    <Shield size={38} />
                  ) : card.type === "pirate" ? (
                    <Skull size={42} />
                  ) : (
                    <Anchor size={38} />
                  )}
                </div>

                <div className="game-card-name">
                  {card.name}
                </div>
              </article>
            ))}
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
