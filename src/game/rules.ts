import type { GameCard, Suit } from "./cards";

export type TigressMode = "pirate" | "escape";

export interface PlayedCard {
  playerId: string;
  card: GameCard;
  order: number;

  // Obligatoire si la carte jouée est la Tigresse.
  tigressMode?: TigressMode;

  // Valeur choisie pour une carte 0/14.
  chosenValue?: 0 | 14;
}

export interface TrickResult {
  winnerPlayerId: string | null;
  nextLeaderPlayerId: string | null;
  winningCard: PlayedCard | null;
  effect:
    | "normal"
    | "kraken"
    | "white_whale"
    | "spotted_stingray"
    | "davys_locker";
  destroyedLeviathans: number;
  bonusPoints: number;
  removedPirates: PlayedCard[];
  eligibleCards: PlayedCard[];
  message: string;
}

const LEVIATHAN_TYPES = new Set([
  "kraken",
  "white_whale",
  "spotted_stingray",
]);

const NON_WINNING_TYPES = new Set([
  "escape",
  "loot",
  "last_volley",
  "walk_the_plank",
  "davys_locker",
  "kraken",
  "white_whale",
  "spotted_stingray",
]);

function getCardType(played: PlayedCard): string {
  if (
    played.card.type === "tigress" &&
    played.tigressMode === "escape"
  ) {
    return "escape";
  }

  if (
    played.card.type === "tigress" &&
    played.tigressMode === "pirate"
  ) {
    return "pirate";
  }

  return played.card.type;
}

function getCardValue(played: PlayedCard): number {
  if (played.chosenValue !== undefined) {
    return played.chosenValue;
  }

  if (played.card.selectableValue?.length) {
    return played.card.value ?? 0;
  }

  return played.card.value ?? 0;
}

function getCardSuit(
  played: PlayedCard,
): Suit | undefined {
  return played.card.suit;
}

function isLeviathan(played: PlayedCard): boolean {
  return LEVIATHAN_TYPES.has(getCardType(played));
}

function isWinningCandidate(played: PlayedCard): boolean {
  return !NON_WINNING_TYPES.has(getCardType(played));
}

/**
 * Détermine la couleur demandée par le pli.
 *
 * Une carte spéciale qui ne définit pas de couleur
 * ne fixe pas la couleur du pli.
 */
export function getLeadSuit(
  plays: PlayedCard[],
): Suit | null {
  const ordered = [...plays].sort(
    (a, b) => a.order - b.order,
  );

  for (const play of ordered) {
    const type = getCardType(play);

    if (
      type === "number" ||
      type === "joker"
    ) {
      const suit = getCardSuit(play);

      if (suit) return suit;
    }
  }

  return null;
}

/**
 * Classement des cartes ordinaires.
 *
 * Noir domine les autres couleurs.
 * Sinon, la couleur demandée par le pli domine
 * les autres couleurs.
 */
function compareNumberCards(
  a: PlayedCard,
  b: PlayedCard,
  leadSuit: Suit | null,
): number {
  const suitA = getCardSuit(a);
  const suitB = getCardSuit(b);

  const valueA = getCardValue(a);
  const valueB = getCardValue(b);

  if (suitA === "black" && suitB !== "black") {
    return 1;
  }

  if (suitB === "black" && suitA !== "black") {
    return -1;
  }

  if (leadSuit) {
    if (suitA === leadSuit && suitB !== leadSuit) {
      return 1;
    }

    if (suitB === leadSuit && suitA !== leadSuit) {
      return -1;
    }
  }

  if (valueA > valueB) return 1;
  if (valueA < valueB) return -1;

  // En cas d'égalité, la première carte jouée gagne.
  return b.order - a.order;
}

function compareSpecialCards(
  a: PlayedCard,
  b: PlayedCard,
): number {
  const typeA = getCardType(a);
  const typeB = getCardType(b);

  const rank: Record<string, number> = {
    mermaid: 1,
    pirate: 2,
    skull_king: 3,
    second: 4,
  };

  const rankA = rank[typeA] ?? 0;
  const rankB = rank[typeB] ?? 0;

  if (rankA !== rankB) {
    return rankA - rankB;
  }

  return b.order - a.order;
}

/**
 * Compare deux cartes candidates.
 *
 * Retourne une valeur positive si A gagne,
 * négative si B gagne, zéro en cas d'égalité.
 */
function compareCards(
  a: PlayedCard,
  b: PlayedCard,
  leadSuit: Suit | null,
): number {
  const typeA = getCardType(a);
  const typeB = getCardType(b);

  const specialTypes = new Set([
    "mermaid",
    "pirate",
    "skull_king",
    "second",
  ]);

  const aSpecial = specialTypes.has(typeA);
  const bSpecial = specialTypes.has(typeB);

  // Le Second bat toutes les cartes ordinaires
  // et les Pirates, mais pas le Skull King
  // ni les Sirènes.
  if (typeA === "second") {
    if (
      typeB !== "skull_king" &&
      typeB !== "mermaid"
    ) {
      return 1;
    }

    return -1;
  }

  if (typeB === "second") {
    if (
      typeA !== "skull_king" &&
      typeA !== "mermaid"
    ) {
      return -1;
    }

    return 1;
  }

  if (aSpecial && bSpecial) {
    return compareSpecialCards(a, b);
  }

  if (aSpecial) return 1;
  if (bSpecial) return -1;

  return compareNumberCards(a, b, leadSuit);
}

/**
 * Recherche la carte gagnante parmi les cartes
 * qui peuvent réellement remporter le pli.
 */
function findHighestCard(
  plays: PlayedCard[],
  leadSuit: Suit | null,
): PlayedCard | null {
  const candidates = plays.filter(isWinningCandidate);

  if (candidates.length === 0) return null;

  let winner = candidates[0];

  for (const candidate of candidates.slice(1)) {
    if (
      compareCards(candidate, winner, leadSuit) > 0
    ) {
      winner = candidate;
    }
  }

  return winner;
}

/**
 * Recherche le dernier Léviathan joué.
 *
 * Le dernier Léviathan détermine l'effet du pli,
 * sauf si le Casier de Davy Jones est présent.
 */
function getLastLeviathan(
  plays: PlayedCard[],
): PlayedCard | null {
  const leviathans = plays
    .filter(isLeviathan)
    .sort((a, b) => a.order - b.order);

  return leviathans.length
    ? leviathans[leviathans.length - 1]
    : null;
}

/**
 * Résolution complète d'un pli.
 *
 * Important :
 * - Les cartes doivent être fournies dans leur ordre réel.
 * - Les valeurs 0/14 doivent être renseignées dans chosenValue.
 * - La Tigresse doit avoir un tigressMode.
 * - Le joueur retiré par Supplice de la planche doit être
 *   sélectionné par le système de jeu avant cette résolution.
 */
export function resolveTrick(
  input: PlayedCard[],
  options: {
    walkThePlankTargetPlayerId?: string;
  } = {},
): TrickResult {
  if (input.length === 0) {
    throw new Error("Impossible de résoudre un pli vide.");
  }

  const plays = [...input].sort(
    (a, b) => a.order - b.order,
  );

  const playerIds = plays.map((play) => play.playerId);

  if (new Set(playerIds).size !== playerIds.length) {
    throw new Error(
      "Un joueur ne peut jouer qu'une carte par pli.",
    );
  }

  for (const play of plays) {
    if (
      play.card.type === "tigress" &&
      !play.tigressMode
    ) {
      throw new Error(
        "La Tigresse doit être déclarée Pirate ou Fuite.",
      );
    }

    if (
      play.card.selectableValue?.length &&
      play.chosenValue === undefined
    ) {
      throw new Error(
        `La valeur de la carte ${play.card.name} doit être choisie.`,
      );
    }

    if (
      play.chosenValue !== undefined &&
      !play.card.selectableValue?.includes(
        play.chosenValue,
      )
    ) {
      throw new Error(
        `Valeur invalide pour ${play.card.name}.`,
      );
    }
  }

  const plankCards = plays.filter(
    (play) => getCardType(play) === "walk_the_plank",
  );

  const removedPirates: PlayedCard[] = [];

  if (plankCards.length > 0) {
    const pirates = plays.filter(
      (play) => getCardType(play) === "pirate",
    );

    if (pirates.length > 0) {
      const targetId = options.walkThePlankTargetPlayerId;

      if (!targetId) {
        throw new Error(
          "Il faut choisir le Pirate qui marche sur la planche.",
        );
      }

      const target = pirates.find(
        (play) => play.playerId === targetId,
      );

      if (!target) {
        throw new Error(
          "Le joueur choisi ne possède pas de Pirate dans ce pli.",
        );
      }

      removedPirates.push(target);
    }
  }

  const activePlays = plays.filter(
    (play) => !removedPirates.includes(play),
  );

  const davyLockerPlayed = activePlays.some(
    (play) => getCardType(play) === "davys_locker",
  );

  const destroyedLeviathans = davyLockerPlayed
    ? activePlays.filter(isLeviathan).length
    : 0;

  const remainingPlays = davyLockerPlayed
    ? activePlays.filter((play) => !isLeviathan(play))
    : activePlays;

  const leadSuit = getLeadSuit(remainingPlays);

  const lastLeviathan = davyLockerPlayed
    ? null
    : getLastLeviathan(remainingPlays);

  let effect: TrickResult["effect"] = "normal";

  if (davyLockerPlayed) {
    effect = "davys_locker";
  } else if (lastLeviathan) {
    const type = getCardType(lastLeviathan);

    if (type === "kraken") {
      effect = "kraken";
    } else if (type === "white_whale") {
      effect = "white_whale";
    } else if (type === "spotted_stingray") {
      effect = "spotted_stingray";
    }
  }

  let eligibleCards = remainingPlays.filter(
  isWinningCandidate,
);

if (effect === "white_whale") {
  eligibleCards = remainingPlays.filter(
    (play) =>
      getCardType(play) === "number" ||
      getCardType(play) === "joker",
  );
}

let winningCard: PlayedCard | null = null;

const numericCandidates = eligibleCards.filter(
  (play) =>
    getCardType(play) === "number" ||
    getCardType(play) === "joker",
);

// Baleine blanche : la valeur seule compte.
if (effect === "white_whale") {
  for (const candidate of numericCandidates) {
    if (!winningCard) {
      winningCard = candidate;
      continue;
    }

    const valueA = getCardValue(candidate);
    const valueB = getCardValue(winningCard);

    if (
      valueA > valueB ||
      (
        valueA === valueB &&
        candidate.order < winningCard.order
      )
    ) {
      winningCard = candidate;
    }
  }
}

// Raie tachetée : la plus petite valeur gagne.
else if (effect === "spotted_stingray") {
  for (const candidate of numericCandidates) {
    if (!winningCard) {
      winningCard = candidate;
      continue;
    }

    const valueA = getCardValue(candidate);
    const valueB = getCardValue(winningCard);

    if (
      valueA < valueB ||
      (
        valueA === valueB &&
        candidate.order < winningCard.order
      )
    ) {
      winningCard = candidate;
    }
  }
}

// Résolution habituelle.
else if (effect !== "kraken") {
  winningCard = findHighestCard(
    eligibleCards,
    leadSuit,
  );
}

let nextLeaderPlayerId =
  winningCard?.playerId ?? null;

// Kraken : personne ne remporte le pli.
if (effect === "kraken") {
  const playsWithoutKraken = remainingPlays.filter(
    (play) => getCardType(play) !== "kraken",
  );

  const hypotheticalWinner = findHighestCard(
    playsWithoutKraken,
    leadSuit,
  );

  nextLeaderPlayerId =
    hypotheticalWinner?.playerId ?? null;

  winningCard = null;
}

// Baleine blanche : aucune carte numérique.
// Le joueur ayant posé la Baleine commence le pli suivant.
if (
  effect === "white_whale" &&
  winningCard === null
) {
  const whiteWhale = remainingPlays.find(
    (play) => getCardType(play) === "white_whale",
  );

  nextLeaderPlayerId =
    whiteWhale?.playerId ?? null;
}

  const bonusPoints = destroyedLeviathans * 20;

  const messages: Record<TrickResult["effect"], string> = {
    normal: winningCard
      ? "Le pli est remporté normalement."
      : "Aucune carte ne remporte le pli.",

    kraken:
      "Le Kraken détruit le pli : personne ne le remporte.",

    white_whale:
      "La Baleine blanche neutralise les cartes spéciales : la plus forte carte numérique gagne.",

    spotted_stingray:
      "La Raie tachetée inverse le pli : la carte numérique la plus faible gagne.",

    davys_locker:
      `Le Casier de Davy Jones détruit ${destroyedLeviathans} Léviathan(s).`,
  };

  return {
    winnerPlayerId: winningCard?.playerId ?? null,
    nextLeaderPlayerId,
    winningCard,
    effect,
    destroyedLeviathans,
    bonusPoints,
    removedPirates,
    eligibleCards,
    message: messages[effect],
  };
}

/**
 * Calcule les bonus des cartes 7 et 8
 * de l'extension 2025.
 *
 * Le bonus n'est accordé que si le joueur
 * a réalisé exactement son pari.
 */
export function getExpansionNumberBonus(
  card: GameCard,
  bidWasCorrect: boolean,
): number {
  if (!bidWasCorrect) return 0;

  if (card.id.endsWith("-7")) return -5;
  if (card.id.endsWith("-8")) return 5;

  return 0;
}

/**
 * Bonus de capture des cartes spéciales.
 *
 * Ces points sont calculés séparément du score
 * normal du pli.
 */
export function getCaptureBonus(
  winningCard: PlayedCard | null,
  plays: PlayedCard[],
): number {
  if (!winningCard) return 0;

  const winnerType = getCardType(winningCard);

  let bonus = 0;

  for (const play of plays) {
    if (play.playerId === winningCard.playerId) continue;

    const capturedType = getCardType(play);

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
      winnerType === "skull_king" &&
      capturedType === "second"
    ) {
      bonus += 30;
    }

    if (
      winnerType === "mermaid" &&
      capturedType === "second"
    ) {
      bonus += 30;
    }
  }

  return bonus;
}
