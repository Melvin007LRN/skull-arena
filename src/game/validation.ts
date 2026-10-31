
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
  chosenValue?: 0 | 14;
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
 *
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

    if (type === "escape" || type === "loot") {
      continue;
    }

    if (type === "number") {
      return play.card.suit ?? null;
    }

    if (type === "joker") {
      return play.chosenSuit ?? null;
    }

    // Une carte spéciale jouée en premier
    // ne fixe pas de couleur.
    return null;
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

    // Le Joker peut prendre la couleur demandée,
    // sauf lorsque la couleur demandée est noire.
    return (
      card.type === "joker" &&
      leadSuit !== "black"
    );
  });
}

function isChosenValueValid(
  card: GameCard,
  chosenValue?: 0 | 14,
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

  if (chosenSuit === "black") {
    return {
      valid: false,
      message: "Le Joker ne peut pas prendre la couleur noire.",
      leadSuit,
    };
  }

  if (
    chosenSuit !== undefined &&
    !VALID_JOKER_SUITS.includes(chosenSuit)
  ) {
    return {
      valid: false,
      message: "La couleur choisie pour le Joker est invalide.",
      leadSuit,
    };
  }

  // Si aucune couleur n'est établie, le joueur
  // doit choisir une couleur pour son Joker.
  if (leadSuit === null && chosenSuit === undefined) {
    return {
      valid: false,
      message: "Choisis une couleur pour ton Joker.",
      leadSuit,
    };
  }

  // Si une couleur autre que noire est établie,
  // le Joker doit prendre cette couleur.
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

  const cardInHand = hand.some(
    (handCard) => handCard.id === card.id,
  );

  if (!cardInHand) {
    return {
      valid: false,
      message: "Cette carte n'est pas dans ta main.",
      leadSuit,
    };
  }

  if (
    playedCards.some(
      (play) => play.playerId === playerId,
    )
  ) {
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

  if (
    card.type === "tigress" &&
    !tigressMode
  ) {
    return {
      valid: false,
      message: "Choisis si la Tigresse devient Pirate ou Fuite.",
      leadSuit,
    };
  }

  if (
    card.type !== "tigress" &&
    tigressMode !== undefined
  ) {
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

  if (
    card.type === "joker" &&
    chosenSuit !== undefined &&
    !VALID_JOKER_SUITS.includes(chosenSuit)
  ) {
    return {
      valid: false,
      message: "La couleur choisie pour le Joker est invalide.",
      leadSuit,
    };
  }

  const effectiveType = getEffectiveType(
    card,
    tigressMode,
  );

  // Le Joker doit être joué avec une couleur valide.
  if (effectiveType === "joker") {
    const jokerError = validateJokerSuit(
      request,
      leadSuit,
    );

    if (jokerError) return jokerError;
  }

  // Les cartes spéciales peuvent être jouées
  // même si le joueur possède la couleur demandée.
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

  // Aucune couleur n'a encore été établie.
  if (leadSuit === null) {
    return {
      valid: true,
      message: "Carte autorisée.",
      leadSuit,
    };
  }

  // Le Joker suit obligatoirement la couleur établie,
  // sauf lorsque la couleur demandée est noire.
  if (
    effectiveType === "joker" &&
    leadSuit !== "black"
  ) {
    return {
      valid: true,
      message: "Le Joker suit la couleur demandée.",
      leadSuit,
    };
  }

  const hasLeadSuit = playerHasLeadSuit(
    hand,
    leadSuit,
  );

  if (!hasLeadSuit) {
    return {
      valid: true,
      message: "Tu ne possèdes pas la couleur demandée.",
      leadSuit,
    };
  }

  const followsSuit =
    effectiveType === "number"
      ? card.suit === leadSuit
      : effectiveType === "joker" &&
        leadSuit !== "black" &&
        chosenSuit === leadSuit;

  if (!followsSuit) {
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
    const effectiveType = getEffectiveType(
      card,
      card.type === "tigress" ? "escape" : undefined,
    );

    // Une Tigresse peut être jouée dans les deux modes.
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

    // Les cartes à valeur sélectionnable doivent
    // pouvoir être proposées avant le choix de valeur.
    const valueToUse =
      card.selectableValue?.length === 1
        ? card.selectableValue[0]
        : undefined;

    const chosenValue =
      valueToUse === 0 || valueToUse === 14
        ? valueToUse
        : undefined;

    // Le Joker nécessite un choix de couleur.
    // On vérifie ici sa disponibilité sans imposer
    // le choix final à l'interface.
    if (effectiveType === "joker") {
      const leadSuit = determineLeadSuit(
        request.playedCards,
      );

      if (
        leadSuit !== null &&
        leadSuit !== "black"
      ) {
        return playerHasLeadSuit(
          request.hand,
          leadSuit,
        );
      }

      return true;
    }

    return validateCardPlay({
      ...request,
      card,
      chosenValue,
    }).valid;
  });
}
