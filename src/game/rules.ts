
import type {
  GameCard,
  Suit,
  PiratePower,
} from "./cards";

export type TigressMode = "pirate" | "escape";

export interface PlayedCard {
  playerId: string;
  card: GameCard;
  order: number;
  tigressMode?: TigressMode;
  chosenValue?: number;
  chosenSuit?: Suit;
  /** Carte imposée par Mary Throne au pli suivant. */
  isMaryForcedPlay?: boolean;
}

export interface PiratePowerTrigger {
  playerId: string;
  power: PiratePower;
  sourceCardId: string;
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
  piratePowerTriggers: PiratePowerTrigger[];
  maryThroneWinnerPlayerId: string | null;
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

const SPECIAL_TYPES = new Set([
  "mermaid",
  "pirate",
  "skull_king",
  "second",
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

  return played.card.value ?? 0;
}

function getCardSuit(
  played: PlayedCard,
): Suit | undefined {
  if (getCardType(played) === "joker") {
    return played.chosenSuit;
  }

  return played.card.suit;
}

function isLeviathan(played: PlayedCard): boolean {
  return LEVIATHAN_TYPES.has(getCardType(played));
}

function isWinningCandidate(played: PlayedCard): boolean {
  return !NON_WINNING_TYPES.has(getCardType(played));
}

export function getLeadSuit(
  plays: PlayedCard[],
): Suit | null {
  const ordered = [...plays].sort(
    (a, b) => a.order - b.order,
  );

  for (const play of ordered) {
    const type = getCardType(play);

    if (type === "number" || type === "joker") {
      const suit = getCardSuit(play);

      if (suit) return suit;
    }
  }

  return null;
}

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

/**
 * Hiérarchie circulaire :
 * - Skull King bat Pirate.
 * - Pirate bat Sirène.
 * - Sirène bat Skull King.
 *
 * Deux cartes de même catégorie sont départagées
 * par leur ordre de pose.
 */
function compareSpecialCards(
  a: PlayedCard,
  b: PlayedCard,
): number {
  const typeA = getCardType(a);
  const typeB = getCardType(b);

  if (typeA === typeB) {
    return b.order - a.order;
  }

  if (
    typeA === "skull_king" &&
    typeB === "pirate"
  ) {
    return 1;
  }

  if (
    typeA === "pirate" &&
    typeB === "mermaid"
  ) {
    return 1;
  }

  if (
    typeA === "mermaid" &&
    typeB === "skull_king"
  ) {
    return 1;
  }

  return -1;
}

function compareCards(
  a: PlayedCard,
  b: PlayedCard,
  leadSuit: Suit | null,
): number {
  const typeA = getCardType(a);
  const typeB = getCardType(b);

  const aSpecial = SPECIAL_TYPES.has(typeA);
  const bSpecial = SPECIAL_TYPES.has(typeB);

  // Second bat toutes les cartes sauf Skull King
  // et Sirène.
  if (typeA === "second") {
    if (
      typeB === "skull_king" ||
      typeB === "mermaid"
    ) {
      return -1;
    }

    return 1;
  }

  if (typeB === "second") {
    if (
      typeA === "skull_king" ||
      typeA === "mermaid"
    ) {
      return 1;
    }

    return -1;
  }

  if (aSpecial && bSpecial) {
    return compareSpecialCards(a, b);
  }

  // Les cartes spéciales gagnent contre les cartes
  // numériques et les autres cartes gagnantes.
  if (aSpecial) return 1;
  if (bSpecial) return -1;

  return compareNumberCards(a, b, leadSuit);
}

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

  const playsByPlayer = new Map<string, PlayedCard[]>();
  for (const play of plays) {
    const playerPlays = playsByPlayer.get(play.playerId) ?? [];
    playerPlays.push(play);
    playsByPlayer.set(play.playerId, playerPlays);
  }

  const repeatedPlayers = [...playsByPlayer.values()].filter(
    (playerPlays) => playerPlays.length > 1,
  );
  const maryForcedPlays = plays.filter((play) => play.isMaryForcedPlay);
  const lastVolleyCards = plays.filter(
    (play) => play.card.type === "last_volley",
  );

  if (maryForcedPlays.length > 1) {
    throw new Error("Une seule carte imposée par Mary Throne est autorisée par pli.");
  }

  const maryForcedPlay = maryForcedPlays[0];
  if (maryForcedPlay) {
    const targetPlays = playsByPlayer.get(maryForcedPlay.playerId) ?? [];
    if (
      targetPlays.length < 2 ||
      targetPlays[targetPlays.length - 1].order !== maryForcedPlay.order
    ) {
      throw new Error(
        "La carte imposée par Mary Throne doit être une pose supplémentaire après la carte normale.",
      );
    }
  }

  if (repeatedPlayers.length > 0) {
    const invalidRepeat = repeatedPlayers.some((playerPlays) => {
      const ordered = [...playerPlays].sort((a, b) => a.order - b.order);
      const hasMaryExtra = ordered.filter((play) => play.isMaryForcedPlay).length === 1;
      const hasLastVolley = ordered[0]?.card.type === "last_volley";
      const validLastVolley = hasLastVolley &&
        lastVolleyCards.length === 1 &&
        ordered.length >= 2 &&
        ordered[1].playerId === ordered[0].playerId;
      const expectedCount = 1 + (hasLastVolley ? 1 : 0) + (hasMaryExtra ? 1 : 0);

      return ordered.length !== expectedCount ||
        (!hasMaryExtra && !hasLastVolley) ||
        (hasLastVolley && !validLastVolley) ||
        (hasMaryExtra && ordered[ordered.length - 1].isMaryForcedPlay !== true);
    });

    if (invalidRepeat) {
      throw new Error(
        "Une pose supplémentaire doit être autorisée par Dernière Salve ou Mary Throne.",
      );
    }
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

    if (
      getCardType(play) === "joker" &&
      play.chosenSuit === "black"
    ) {
      throw new Error(
        "Le Joker ne peut pas prendre la couleur noire.",
      );
    }
  }

  // SUPPLICE DE LA PLANCHE
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

  // CASIER DE DAVY JONES
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

  // BALEINE BLANCHE : la plus forte valeur numérique
  // gagne, sans avantage de couleur ni d'atout.
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

  // RAIE TACHETÉE : la plus faible valeur numérique
  // gagne, indépendamment de la couleur.
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

  // RÉSOLUTION NORMALE
  else if (effect !== "kraken") {
    winningCard = findHighestCard(
      eligibleCards,
      leadSuit,
    );
  }

  let nextLeaderPlayerId =
    winningCard?.playerId ?? null;

  // KRAKEN : personne ne remporte le pli.
  // Le prochain leader est le gagnant hypothétique
  // si le Kraken n'avait pas été joué.
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

  // BALEINE BLANCHE : si aucune carte numérique
  // ou Joker n'est présente, son joueur mène ensuite.
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

  // DÉCLENCHEMENT DES POUVOIRS DES PIRATES
  const piratePowerTriggers: PiratePowerTrigger[] = [];

  if (winningCard) {
    const winnerType = getCardType(winningCard);

    // Un Pirate classique déclenche son propre pouvoir
    // lorsqu'il remporte le pli.
    if (
      winnerType === "pirate" &&
      winningCard.card.piratePower
    ) {
      piratePowerTriggers.push({
        playerId: winningCard.playerId,
        power: winningCard.card.piratePower,
        sourceCardId: winningCard.card.id,
      });
    }

    // SECOND récupère les pouvoirs des Pirates capturés.
    if (winnerType === "second") {
      const capturedPirates = remainingPlays.filter(
        (play) =>
          getCardType(play) === "pirate" &&
          play.playerId !== winningCard!.playerId &&
          play.card.piratePower !== undefined,
      );

      for (const pirate of capturedPirates) {
        piratePowerTriggers.push({
          playerId: winningCard.playerId,
          power: pirate.card.piratePower!,
          sourceCardId: pirate.card.id,
        });
      }
    }
  }

  const maryThroneWinnerPlayerId =
    winningCard?.card.id === "mary-throne"
      ? winningCard.playerId
      : null;

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
    piratePowerTriggers,
    maryThroneWinnerPlayerId,
    message: messages[effect],
  };
}

export function getExpansionNumberBonus(
  card: GameCard,
  bidWasCorrect: boolean,
): number {
  // Les bonus de capture 7/8 sont accordés uniquement si l'annonce est exacte.
  if (!bidWasCorrect) return 0;
  if (card.id.endsWith("-7")) return -5;
  if (card.id.endsWith("-8")) return 5;

  return 0;
}

export function getCaptureBonus(
  winningCard: PlayedCard | null,
  plays: PlayedCard[],
  removedPirates: PlayedCard[] = [],
): number {
  if (!winningCard) return 0;

  const winnerType = getCardType(winningCard);

  let bonus = 0;

  for (const play of plays) {
    if (
      play.playerId === winningCard.playerId ||
      removedPirates.includes(play)
    ) {
      continue;
    }

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
      (winnerType === "skull_king" ||
        winnerType === "mermaid") &&
      capturedType === "second"
    ) {
      bonus += 30;
    }
  }

  return bonus;
}

/**
 * Construit l'ordre des poses supplémentaires d'un pli.
 * Les poses normales sont toujours jouées en premier. Dernière Salve
 * conserve son ordre de déclenchement immédiat ; les cartes imposées
 * par Mary Throne suivent ensuite, dans l'ordre fourni par le serveur.
 * Les doublons de joueur sont volontaires : un même joueur peut devoir
 * jouer une carte Dernière Salve et une carte Mary Throne.
 */
export function buildExtraPlayQueue(
  lastVolleyPlayerIds: readonly string[],
  maryForcedPlayerIds: readonly string[],
): string[] {
  return [...lastVolleyPlayerIds, ...maryForcedPlayerIds];
}
