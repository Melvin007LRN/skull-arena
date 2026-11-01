
import type {
  GameCard,
  Suit,
  ExtensionKey,
} from "./cards";

import type {
  PlayedCard,
  TigressMode,
} from "./rules";

export interface CardPlayRequest {
  playerId: string;
  hand: GameCard[];
  playedCards: PlayedCard[];
  card: GameCard;
  tigressMode?: TigressMode;
  chosenValue?: number;
  chosenSuit?: Suit;
  extensions?: Partial<Record<ExtensionKey, boolean>>;
}

export interface CardValidationResult {
  valid: boolean;
  message: string;
  leadSuit: Suit | null;
}

const VALID_JOKER_SUITS: Suit[] = [
  "green",
  "purple",
  "yellow",
];

function getEffectiveType(
  card: GameCard,
  tigressMode?: TigressMode,
): string {
  if (card.type === "tigress") {
    if (tigressMode === "pirate") return "pirate";
    if (tigressMode === "escape") return "escape";
  }

  return card.type;
}

/**
 * Détermine la couleur demandée par le pli.
 * Les cartes Fuite et Butin ne déterminent pas
 * la couleur demandée.
 */
export function determineLeadSuit(
  playedCards: PlayedCard[],
): Suit | null {
  const ordered = [...playedCards].sort(
    (a, b) => a.order - b.order,
  );

  for (const play of ordered) {
    const type = getEffectiveType(
      play.card,
      play.tigressMode,
    );

    // Les cartes spéciales (Pirate, Sirène, Skull King,
    // Kraken, etc.) ne définissent pas la couleur demandée.
    // On cherche la première carte numérique ou le Joker.
    if (type === "number") {
      return play.card.suit ?? null;
    }

    if (type === "joker") {
      return play.chosenSuit ?? null;
    }
  }

  return null;
}

function playerHasLeadSuit(
  hand: GameCard[],
  leadSuit: Suit,
): boolean {
  return hand.some((card) => {
    if (
      card.type === "number" &&
      card.suit === leadSuit
    ) {
      return true;
    }

    return (
      card.type === "joker" &&
      leadSuit !== "black"
    );
  });
}

function isChosenValueValid(
  card: GameCard,
  chosenValue?: number,
): boolean {
  if (!card.selectableValue?.length) {
    return chosenValue === undefined;
  }

  if (chosenValue === undefined) {
    return false;
  }

  return card.selectableValue.includes(chosenValue);
}

function isExtensionEnabled(
  card: GameCard,
  extensions?: Partial<Record<ExtensionKey, boolean>>,
): boolean {
  if (!card.extension) return true;

  return extensions?.[card.extension] === true;
}

function validateJokerSuit(
  request: CardPlayRequest,
  leadSuit: Suit | null,
): CardValidationResult | null {
  const { chosenSuit } = request;

  if (
    chosenSuit !== undefined &&
    !VALID_JOKER_SUITS.includes(chosenSuit)
  ) {
    return {
      valid: false,
      message: "Le Joker ne peut pas prendre la couleur noire.",
      leadSuit,
    };
  }

  if (leadSuit === null && chosenSuit === undefined) {
    return {
      valid: false,
      message: "Choisis une couleur pour ton Joker.",
      leadSuit,
    };
  }

  if (
    leadSuit !== null &&
    leadSuit !== "black" &&
    chosenSuit !== leadSuit
  ) {
    return {
      valid: false,
      message: `Le Joker doit suivre la couleur ${leadSuit}.`,
      leadSuit,
    };
  }

  return null;
}

export function validateCardPlay(
  request: CardPlayRequest,
): CardValidationResult {
  const {
    playerId,
    hand,
    playedCards,
    card,
    tigressMode,
    chosenValue,
    chosenSuit,
    extensions = {},
  } = request;

  const leadSuit = determineLeadSuit(playedCards);

  if (!playerId) {
    return {
      valid: false,
      message: "Joueur invalide.",
      leadSuit,
    };
  }

  if (!hand.some((handCard) => handCard.id === card.id)) {
    return {
      valid: false,
      message: "Cette carte n'est pas dans ta main.",
      leadSuit,
    };
  }

  if (playedCards.some((play) => play.playerId === playerId)) {
    return {
      valid: false,
      message: "Tu as déjà joué une carte dans ce pli.",
      leadSuit,
    };
  }

  if (!isExtensionEnabled(card, extensions)) {
    return {
      valid: false,
      message: "Cette carte appartient à une extension désactivée.",
      leadSuit,
    };
  }

  if (card.type === "tigress" && !tigressMode) {
    return {
      valid: false,
      message: "Choisis si la Tigresse devient Pirate ou Fuite.",
      leadSuit,
    };
  }

  if (card.type !== "tigress" && tigressMode !== undefined) {
    return {
      valid: false,
      message: "Le mode Tigresse ne peut être utilisé que sur la Tigresse.",
      leadSuit,
    };
  }

  if (!isChosenValueValid(card, chosenValue)) {
    return {
      valid: false,
      message: card.selectableValue?.length
        ? `Choisis une valeur pour ${card.name}.`
        : "Cette carte ne possède pas de valeur sélectionnable.",
      leadSuit,
    };
  }

  const effectiveType = getEffectiveType(card, tigressMode);

  if (effectiveType === "joker") {
    const jokerError = validateJokerSuit(request, leadSuit);
    if (jokerError) return jokerError;
  }

  // Les cartes spéciales peuvent être jouées même
  // si le joueur possède la couleur demandée.
  if (
    effectiveType !== "number" &&
    effectiveType !== "joker"
  ) {
    return {
      valid: true,
      message: "Carte autorisée.",
      leadSuit,
    };
  }

  if (leadSuit === null) {
    return {
      valid: true,
      message: "Carte autorisée.",
      leadSuit,
    };
  }

  // Le Joker suit obligatoirement la couleur établie,
  // sauf lorsque la couleur demandée est noire.
  if (effectiveType === "joker") {
    if (
      leadSuit !== "black" &&
      chosenSuit !== leadSuit
    ) {
      return {
        valid: false,
        message: `Le Joker doit suivre la couleur ${leadSuit}.`,
        leadSuit,
      };
    }

    return {
      valid: true,
      message: "Joker autorisé.",
      leadSuit,
    };
  }

  const hasLeadSuit = playerHasLeadSuit(hand, leadSuit);

  if (!hasLeadSuit) {
    return {
      valid: true,
      message: "Tu ne possèdes pas la couleur demandée.",
      leadSuit,
    };
  }

  if (card.suit !== leadSuit) {
    return {
      valid: false,
      message: `Tu dois suivre la couleur ${leadSuit}.`,
      leadSuit,
    };
  }

  return {
    valid: true,
    message: "Carte autorisée.",
    leadSuit,
  };
}

/**
 * Retourne les cartes qui peuvent être proposées
 * au joueur selon les règles du pli.
 */
export function getPlayableCards(
  request: Omit<CardPlayRequest, "card">,
): GameCard[] {
  return request.hand.filter((card) => {
    if (card.type === "tigress") {
      const pirateResult = validateCardPlay({
        ...request,
        card,
        tigressMode: "pirate",
      });

      const escapeResult = validateCardPlay({
        ...request,
        card,
        tigressMode: "escape",
      });

      return pirateResult.valid || escapeResult.valid;
    }

    const possibleValues = card.selectableValue?.length
      ? card.selectableValue
      : [undefined];

    const leadSuit = determineLeadSuit(request.playedCards);

    const possibleSuits: (Suit | undefined)[] =
      card.type === "joker"
        ? [
            leadSuit && leadSuit !== "black"
              ? leadSuit
              : "green",
          ]
        : [undefined];

    return possibleValues.some((chosenValue) =>
      possibleSuits.some((chosenSuit) =>
        validateCardPlay({
          ...request,
          card,
          chosenValue,
          chosenSuit,
        }).valid,
      ),
    );
  });
}
