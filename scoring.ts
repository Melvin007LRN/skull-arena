
import type { GameCard } from "./cards";
import type { PlayedCard } from "./rules";

export interface PlayerRoundStats {
  playerId: string;
  bid: number;
  tricksWon: number;
  capturedCards: GameCard[];
  capturedTricks: PlayedCard[][];

  /**
   * Pirates retirés par Supplice de la planche,
   * rangés dans le même ordre que capturedTricks.
   *
   * À renseigner lors de l'enregistrement des plis
   * pour éviter de compter leurs bonus de capture.
   */
  removedPiratesByTrick?: PlayedCard[][];
}

export interface RoundScoreResult {
  playerId: string;
  bid: number;
  tricksWon: number;
  bidCorrect: boolean;
  bidPoints: number;
  bonusPoints: number;
  totalPoints: number;
}

export interface ScoreOptions {
  roundNumber: number;
  includeCardBonuses?: boolean;
}

/**
 * Calcule les points de base de l'annonce.
 *
 * Annonce positive :
 * - exacte : +20 points par pli annoncé
 * - incorrecte : -10 points par pli d'écart
 *
 * Annonce zéro :
 * - réussie : +10 x numéro de manche
 * - ratée : -10 x numéro de manche
 */
export function calculateBidPoints(
  bid: number,
  tricksWon: number,
  roundNumber: number,
): number {
  if (
    !Number.isInteger(roundNumber) ||
    roundNumber < 1 ||
    roundNumber > 10
  ) {
    throw new Error("Numéro de manche invalide.");
  }

  if (
    !Number.isInteger(bid) ||
    bid < 0 ||
    bid > roundNumber
  ) {
    throw new Error("Annonce invalide.");
  }

  if (
    !Number.isInteger(tricksWon) ||
    tricksWon < 0 ||
    tricksWon > roundNumber
  ) {
    throw new Error("Nombre de plis remportés invalide.");
  }

  if (bid === 0) {
    return tricksWon === 0
      ? roundNumber * 10
      : -(roundNumber * 10);
  }

  if (bid === tricksWon) {
    return bid * 20;
  }

  return -Math.abs(bid - tricksWon) * 10;
}

/**
 * Calcule les bonus des cartes 14.
 *
 * 14 vert, violet ou jaune : +10
 * 14 noir : +20
 *
 * Les bonus sont appliqués uniquement si l'annonce
 * du joueur est exacte.
 */
export function calculateFourteenBonuses(
  capturedCards: GameCard[],
): number {
  let bonus = 0;

  for (const card of capturedCards) {
    if (
      card.type !== "number" ||
      card.value !== 14
    ) {
      continue;
    }

    if (card.suit === "black") {
      bonus += 20;
    } else if (
      card.suit === "green" ||
      card.suit === "purple" ||
      card.suit === "yellow"
    ) {
      bonus += 10;
    }
  }

  return bonus;
}

function getEffectiveType(
  play: PlayedCard,
): string {
  if (play.card.type === "tigress") {
    return play.tigressMode === "pirate"
      ? "pirate"
      : "escape";
  }

  return play.card.type;
}

function isRemovedPirate(
  play: PlayedCard,
  removedPirates: PlayedCard[],
): boolean {
  return removedPirates.some(
    (removed) =>
      removed.playerId === play.playerId &&
      removed.order === play.order &&
      removed.card.id === play.card.id,
  );
}

/**
 * Calcule les bonus de capture des cartes spéciales.
 *
 * Pirate capture une Sirène : +20
 * Skull King capture un Pirate : +30
 * Sirène capture Skull King : +40
 * Skull King ou Sirène capture Second : +30
 *
 * Les Pirates retirés par Supplice de la planche
 * sont exclus du calcul.
 */
export function calculateSpecialCaptureBonuses(
  playerId: string,
  capturedTricks: PlayedCard[][],
  removedPiratesByTrick: PlayedCard[][] = [],
): number {
  let bonus = 0;

  for (let index = 0; index < capturedTricks.length; index++) {
    const trick = capturedTricks[index];

    const removedPirates =
      removedPiratesByTrick[index] ?? [];

    const winnerPlay = trick.find(
      (play) => play.playerId === playerId,
    );

    if (!winnerPlay) continue;

    const winnerType = getEffectiveType(winnerPlay);

    // La Tigresse utilisée comme Fuite ne capture
    // pas de cartes et ne rapporte aucun bonus.
    if (winnerType === "escape") continue;

    for (const play of trick) {
      if (
        play.playerId === playerId ||
        isRemovedPirate(play, removedPirates)
      ) {
        continue;
      }

      const capturedType = getEffectiveType(play);

      if (
        winnerType === "pirate" &&
        capturedType === "mermaid"
      ) {
        bonus += 20;
      }

      if (
        winnerType === "skull_king" &&
        capturedType === "pirate"
      ) {
        bonus += 30;
      }

      if (
        winnerType === "mermaid" &&
        capturedType === "skull_king"
      ) {
        bonus += 40;
      }

      if (
        (winnerType === "skull_king" ||
          winnerType === "mermaid") &&
        capturedType === "second"
      ) {
        bonus += 30;
      }
    }
  }

  return bonus;
}

/**
 * Bonus des cartes 7 et 8 de l'extension 2025.
 *
 * 7 : -5 points
 * 8 : +5 points
 *
 * Ces bonus de capture sont indépendants de la précision de l'annonce.
 */
export function calculateExpansionBonuses(
  capturedCards: GameCard[],
): number {
  let bonus = 0;

  for (const card of capturedCards) {
    if (
      !card.isExpansionCard ||
      card.type !== "number"
    ) {
      continue;
    }

    if (card.id.endsWith("-7")) {
      bonus -= 5;
    }

    if (card.id.endsWith("-8")) {
      bonus += 5;
    }
  }

  return bonus;
}

/**
 * Calcule le score complet d'un joueur pour une manche.
 */
export function calculatePlayerRoundScore(
  stats: PlayerRoundStats,
  options: ScoreOptions,
): RoundScoreResult {
  const {
    roundNumber,
    includeCardBonuses = true,
  } = options;

  if (
    !Number.isInteger(roundNumber) ||
    roundNumber < 1 ||
    roundNumber > 10
  ) {
    throw new Error(
      "Le numéro de manche doit être compris entre 1 et 10.",
    );
  }

  if (
    !Number.isInteger(stats.bid) ||
    stats.bid < 0 ||
    stats.bid > roundNumber
  ) {
    throw new Error("Annonce invalide.");
  }

  if (
    !Number.isInteger(stats.tricksWon) ||
    stats.tricksWon < 0 ||
    stats.tricksWon > roundNumber
  ) {
    throw new Error("Nombre de plis remportés invalide.");
  }

  if (
    stats.removedPiratesByTrick &&
    stats.removedPiratesByTrick.length >
      stats.capturedTricks.length
  ) {
    throw new Error(
      "Les Pirates retirés ne correspondent pas aux plis enregistrés.",
    );
  }

  const bidCorrect =
    stats.bid === stats.tricksWon;

  const bidPoints = calculateBidPoints(
    stats.bid,
    stats.tricksWon,
    roundNumber,
  );

  let bonusPoints = 0;

  if (includeCardBonuses) {
    bonusPoints += calculateFourteenBonuses(
      stats.capturedCards,
    );

    bonusPoints += calculateSpecialCaptureBonuses(
      stats.playerId,
      stats.capturedTricks,
      stats.removedPiratesByTrick,
    );

    bonusPoints += calculateExpansionBonuses(
      stats.capturedCards,
    );
  }

  return {
    playerId: stats.playerId,
    bid: stats.bid,
    tricksWon: stats.tricksWon,
    bidCorrect,
    bidPoints,
    bonusPoints,
    totalPoints: bidPoints + bonusPoints,
  };
}

/**
 * Calcule les scores de tous les joueurs.
 */
export function calculateRoundScores(
  players: PlayerRoundStats[],
  options: ScoreOptions,
): RoundScoreResult[] {
  const playerIds = players.map(
    (player) => player.playerId,
  );

  if (new Set(playerIds).size !== playerIds.length) {
    throw new Error(
      "Un joueur apparaît plusieurs fois dans le calcul des scores.",
    );
  }

  return players.map((player) =>
    calculatePlayerRoundScore(player, options),
  );
}

/**
 * Ajoute le score de la manche au total précédent.
 */
export function updateTotalScore(
  previousTotal: number,
  roundScore: number,
): number {
  return previousTotal + roundScore;
}
