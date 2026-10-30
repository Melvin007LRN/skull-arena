import type {
  GameCard,
  GameExtensions,
  Suit,
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
  extensions?: Partial<GameExtensions>;
}

export interface CardValidationResult {
  valid: boolean;
  message: string;
  leadSuit: Suit | null;
}

/**
 * Identifie le type réel de la carte.
 * La Tigresse peut être déclarée Pirate ou Fuite.
 */
function getEffectiveType(
  card: GameCard,
  tigressMode?: TigressMode,
): string {
  if (card.type === "tigress") {
    if (!tigressMode) return "tigress";
    return tigressMode === "pirate" ? "pirate" : "escape";
  }

  return card.type;
}

/**
 * Détermine la couleur à suivre dans le pli.
 *
 * - Une carte numérotée jouée en premier impose sa couleur.
 * - Un personnage joué en premier n'impose aucune couleur.
 * - Une Fuite ou un Butin en premier reporte le choix
 *   au prochain joueur qui joue une carte numérotée.
 * - Plusieurs Fuites ou Butins peuvent reporter ce choix.
 */
export function determineLeadSuit(
  playedCards: PlayedCard[],
): Suit | null {
  if (playedCards.length === 0) return null;

  const ordered = [...playedCards].sort(
    (a, b) => a.order - b.order,
  );

  const first = ordered[0];
  const firstType = getEffectiveType(
    first.card,
    first.tigressMode,
  );

  if (
    firstType === "number" ||
    firstType === "joker"
  ) {
    return first.card.suit ?? null;
  }

  if (
    firstType !== "escape" &&
    firstType !== "loot"
  ) {
    return null;
  }

  // Le premier joueur a joué une Fuite ou un Butin.
  // On cherche la première carte numérotée jouée ensuite.
  for (const play of ordered.slice(1)) {
    const type = getEffectiveType(
      play.card,
      play.tigressMode,
    );

    if (type === "escape" || type === "loot") {
      continue;
    }

    if (type === "number" || type === "joker") {
      return play.card.suit ?? null;
    }

    // Un personnage ne définit pas de couleur.
    return null;
  }

  return null;
}

/**
 * Vérifie que le joueur possède bien la carte
 * qu'il souhaite jouer.
 */
function cardBelongsToPlayer(
  card: GameCard,
  hand: GameCard[],
): boolean {
  return hand.some((item) => item.id === card.id);
}

/**
 * Vérifie que la carte est autorisée
 * par les extensions activées dans le salon.
 */
function isExtensionEnabled(
  card: GameCard,
  extensions: Partial<GameExtensions>,
): boolean {
  if (!card.extension) return true;

  // Une extension absente de la configuration
  // est considérée comme désactivée.
  return extensions[card.extension] === true;
}

/**
 * Vérifie si le joueur possède au moins une carte
 * numérotée de la couleur demandée.
 */
function playerHasLeadSuit(
  hand: GameCard[],
  leadSuit: Suit,
): boolean {
  return hand.some((card) => {
    return (
      card.type === "number" &&
      card.suit === leadSuit
    );
  });
}

/**
 * Vérifie si la valeur choisie pour une carte
 * à valeur variable est autorisée.
 */
function isChosenValueValid(
  card: GameCard,
  chosenValue?: number,
): boolean {
  if (!card.selectableValue?.length) {
    return chosenValue === undefined;
  }

  if (chosenValue === undefined) return false;

  return card.selectableValue.includes(chosenValue);
}

/**
 * Vérifie toutes les conditions nécessaires
 * avant d'accepter une carte dans un pli.
 */
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
    extensions = {},
  } = request;

  const leadSuit = determineLeadSuit(playedCards);

  const reject = (message: string): CardValidationResult => ({
    valid: false,
    message,
    leadSuit,
  });

  // 1. Le joueur doit avoir la carte.
  if (!cardBelongsToPlayer(card, hand)) {
    return reject(
      "Cette carte ne se trouve pas dans votre main.",
    );
  }

  // 2. Un joueur ne peut jouer qu'une carte par pli.
  if (
    playedCards.some(
      (play) => play.playerId === playerId,
    )
  ) {
    return reject(
      "Vous avez déjà joué une carte dans ce pli.",
    );
  }

  // 3. Vérification des extensions.
  if (!isExtensionEnabled(card, extensions)) {
    return reject(
      "Cette carte appartient à une extension désactivée.",
    );
  }

  // 4. Vérification de la Tigresse.
  if (
    card.type === "tigress" &&
    !tigressMode
  ) {
    return reject(
      "Vous devez choisir si la Tigresse est jouée comme Pirate ou comme Fuite.",
    );
  }

  // 5. Vérification de la valeur variable.
  if (!isChosenValueValid(card, chosenValue)) {
    return reject(
      "Vous devez choisir une valeur autorisée pour cette carte.",
    );
  }

  // 6. Les cartes spéciales peuvent être jouées
  // même si le joueur possède la couleur demandée.
  const effectiveType = getEffectiveType(
    card,
    tigressMode,
  );

  const isNumberCard =
    effectiveType === "number" ||
    effectiveType === "joker";

  if (!isNumberCard) {
    return {
      valid: true,
      message: "Carte spéciale autorisée.",
      leadSuit,
    };
  }

  // 7. Si aucune couleur n'est demandée,
  // toute carte numérotée est autorisée.
  if (!leadSuit) {
    return {
      valid: true,
      message: "Aucune couleur obligatoire.",
      leadSuit: null,
    };
  }

  // 8. Une carte numérotée doit suivre la couleur
  // si le joueur possède cette couleur.
  if (playerHasLeadSuit(hand, leadSuit)) {
    if (card.suit !== leadSuit) {
      return reject(
        `Vous devez jouer une carte ${leadSuit}. Vous en possédez au moins une.`,
      );
    }
  }

  return {
    valid: true,
    message: "Carte autorisée.",
    leadSuit,
  };
}

/**
 * Vérifie si un joueur peut encore jouer dans le pli.
 */
export function canPlayerPlay(
  playerId: string,
  playedCards: PlayedCard[],
): boolean {
  return !playedCards.some(
    (play) => play.playerId === playerId,
  );
}

/**
 * Retourne toutes les cartes jouables d'une main.
 *
 * Utile pour griser les cartes interdites dans l'interface.
 */
export function getPlayableCards(
  request: Omit<CardPlayRequest, "card">,
): GameCard[] {
  return request.hand.filter((card) => {
    const result = validateCardPlay({
      ...request,
      card,
      chosenValue:
        card.selectableValue?.length === 1
          ? card.selectableValue[0]
          : undefined,
    });

    // Une carte à choix multiple, comme 0/14,
    // reste sélectionnable : son choix sera demandé
    // au moment de la jouer.
    if (
      card.selectableValue &&
      card.selectableValue.length > 1 &&
      result.message.includes("choisir une valeur")
    ) {
      return true;
    }

    return result.valid;
  });
}
