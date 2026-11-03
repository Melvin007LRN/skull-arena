
export type Suit = "green" | "purple" | "yellow" | "black";

export type CardType =
  | "number"
  | "escape"
  | "pirate"
  | "tigress"
  | "mermaid"
  | "skull_king"
  | "loot"
  | "kraken"
  | "white_whale"
  | "joker"
  | "last_volley"
  | "second"
  | "spotted_stingray"
  | "davys_locker"
  | "walk_the_plank";

export type PiratePower =
  | "rosie"
  | "bendt"
  | "rascal"
  | "juanita"
  | "harry";

export interface PiratePowerInfo {
  id: PiratePower;
  name: string;
  description: string;
  canUseAfterFinalTrick: boolean;
}

export const PIRATE_POWERS: Record<PiratePower, PiratePowerInfo> = {
  rosie: {
    id: "rosie",
    name: "Rosie la Douce",
    description:
      "Choisir le joueur qui commencera le prochain pli, soi-même compris.",
    canUseAfterFinalTrick: false,
  },
  bendt: {
    id: "bendt",
    name: "Bendt le Bandit",
    description:
      "Piocher 2 cartes, puis en défausser 2 de sa main.",
    canUseAfterFinalTrick: false,
  },
  rascal: {
    id: "rascal",
    name: "Rascal le Flambeur",
    description:
      "Parier 0, 10 ou 20 points supplémentaires. Gagner ces points si sa mise est exacte, les perdre sinon.",
    canUseAfterFinalTrick: true,
  },
  juanita: {
    id: "juanita",
    name: "Juanita Jade",
    description:
      "Regarder secrètement les cartes qui n'ont pas été distribuées pendant cette manche.",
    canUseAfterFinalTrick: false,
  },
  harry: {
    id: "harry",
    name: "Harry le Géant",
    description:
      "Modifier sa mise de +1, de -1 ou la laisser inchangée.",
    canUseAfterFinalTrick: true,
  },
};

export type ExtensionKey =
  | "loot"
  | "kraken"
  | "white_whale"
  | "expansion_2025"
  | "last_shot"
  | "second"
  | "spotted_stingray"
  | "davys_locker"
  | "walk_the_plank";

export interface GameCard {
  id: string;
  name: string;
  type: CardType;
  suit?: Suit;
  value?: number;
  selectableValue?: number[];
  extension?: ExtensionKey;
  isExpansionCard: boolean;

  /** Pouvoir individuel d'un Pirate classique. */
  piratePower?: PiratePower;
}

export type GameExtensions = Record<ExtensionKey, boolean>;

export const DEFAULT_GAME_EXTENSIONS: GameExtensions = {
  loot: true,
  kraken: true,
  white_whale: true,
  expansion_2025: true,
  last_shot: true,
  second: true,
  spotted_stingray: true,
  davys_locker: true,
  walk_the_plank: true,
};

export const SUITS: Suit[] = [
  "green",
  "purple",
  "yellow",
  "black",
];

export const SUIT_NAMES: Record<Suit, string> = {
  green: "Vert",
  purple: "Violet",
  yellow: "Jaune",
  black: "Noir",
};

/**
 * Paquet de base :
 * 4 couleurs de 1 à 14 = 56 cartes
 * 5 Pirates
 * 5 Fuites
 * 1 Tigresse
 * 1 Skull King
 * 2 Sirènes
 * Total : 70 cartes
 */
function createBaseDeck(): GameCard[] {
  const cards: GameCard[] = [];

  for (const suit of SUITS) {
    for (let value = 1; value <= 14; value++) {
      cards.push({
        id: `${suit}-${value}`,
        name: `${SUIT_NAMES[suit]} ${value}`,
        type: "number",
        suit,
        value,
        isExpansionCard: false,
      });
    }
  }

  const pirates: {
    id: string;
    name: string;
    power: PiratePower;
  }[] = [
    {
      id: "pirate-1",
      name: "Rosie la Douce",
      power: "rosie",
    },
    {
      id: "pirate-2",
      name: "Bendt le Bandit",
      power: "bendt",
    },
    {
      id: "pirate-3",
      name: "Rascal le Flambeur",
      power: "rascal",
    },
    {
      id: "pirate-4",
      name: "Juanita Jade",
      power: "juanita",
    },
    {
      id: "pirate-5",
      name: "Harry le Géant",
      power: "harry",
    },
  ];

  for (const pirate of pirates) {
    cards.push({
      id: pirate.id,
      name: pirate.name,
      type: "pirate",
      piratePower: pirate.power,
      isExpansionCard: false,
    });
  }

  for (let i = 1; i <= 5; i++) {
    cards.push({
      id: `escape-${i}`,
      name: `Fuite ${i}`,
      type: "escape",
      isExpansionCard: false,
    });
  }

  cards.push({
    id: "tigress",
    name: "Tigresse",
    type: "tigress",
    isExpansionCard: false,
  });

  cards.push({
    id: "skull-king",
    name: "Skull King",
    type: "skull_king",
    isExpansionCard: false,
  });

  for (let i = 1; i <= 2; i++) {
    cards.push({
      id: `mermaid-${i}`,
      name: `Sirène ${i}`,
      type: "mermaid",
      isExpansionCard: false,
    });
  }

  return cards;
}

/**
 * Cartes supplémentaires de couleur de l'extension 2025.
 * Chaque couleur reçoit un 7, un 8 et une carte 0/14.
 */
function create2025ColorCards(): GameCard[] {
  const cards: GameCard[] = [];

  for (const suit of SUITS) {
    cards.push({
      id: `exp-2025-${suit}-7`,
      name: `${SUIT_NAMES[suit]} 7`,
      type: "number",
      suit,
      value: 7,
      extension: "expansion_2025",
      isExpansionCard: true,
    });

    cards.push({
      id: `exp-2025-${suit}-8`,
      name: `${SUIT_NAMES[suit]} 8`,
      type: "number",
      suit,
      value: 8,
      extension: "expansion_2025",
      isExpansionCard: true,
    });

    cards.push({
      id: `exp-2025-${suit}-0-14`,
      name: `${SUIT_NAMES[suit]} 0/14`,
      type: "number",
      suit,
      selectableValue: [0, 14],
      extension: "expansion_2025",
      isExpansionCard: true,
    });
  }

  return cards;
}

/**
 * Cartes spéciales de l'extension 2025.
 */
function create2025SpecialCards(): GameCard[] {
  return [
    {
      id: "joker-15",
      name: "Joker 15",
      type: "joker",
      value: 15,
      selectableValue: [15],
      extension: "expansion_2025",
      isExpansionCard: true,
    },
    {
      id: "last-volley",
      name: "Dernière salve",
      type: "last_volley",
      extension: "last_shot",
      isExpansionCard: true,
    },
    {
      id: "second",
      name: "Second",
      type: "second",
      extension: "second",
      isExpansionCard: true,
    },
    {
      id: "spotted-stingray",
      name: "Raie tachetée",
      type: "spotted_stingray",
      extension: "spotted_stingray",
      isExpansionCard: true,
    },
    {
      id: "davys-locker",
      name: "Casier de Davy Jones",
      type: "davys_locker",
      extension: "davys_locker",
      isExpansionCard: true,
    },
    {
      id: "walk-the-plank",
      name: "Supplice de la planche",
      type: "walk_the_plank",
      extension: "walk_the_plank",
      isExpansionCard: true,
    },
  ];
}

/**
 * Cartes optionnelles de l'édition de base.
 */
function createOptionalBaseCards(): GameCard[] {
  return [
    {
      id: "loot-1",
      name: "Butin 1",
      type: "loot",
      extension: "loot",
      isExpansionCard: false,
    },
    {
      id: "loot-2",
      name: "Butin 2",
      type: "loot",
      extension: "loot",
      isExpansionCard: false,
    },
    {
      id: "kraken",
      name: "Kraken",
      type: "kraken",
      extension: "kraken",
      isExpansionCard: false,
    },
    {
      id: "white-whale",
      name: "Baleine blanche",
      type: "white_whale",
      extension: "white_whale",
      isExpansionCard: false,
    },
  ];
}

export const BASE_DECK: GameCard[] = createBaseDeck();

export const EXPANSION_2025_DECK: GameCard[] = [
  ...create2025ColorCards(),
  ...create2025SpecialCards(),
];

export const OPTIONAL_BASE_DECK: GameCard[] =
  createOptionalBaseCards();

/**
 * Construit le paquet selon les options choisies dans le salon.
 */
export function buildDeck(
  extensions: Partial<GameExtensions> = {},
): GameCard[] {
  const settings: GameExtensions = {
    ...DEFAULT_GAME_EXTENSIONS,
    ...extensions,
  };

  const deck: GameCard[] = [...BASE_DECK];

  for (const card of OPTIONAL_BASE_DECK) {
    if (card.extension && settings[card.extension]) {
      deck.push(card);
    }
  }

  if (settings.expansion_2025) {
    deck.push(
      ...EXPANSION_2025_DECK.filter(
        (card) => card.extension === "expansion_2025",
      ),
    );
  }

  const optionalExpansionKeys: ExtensionKey[] = [
    "last_shot",
    "second",
    "spotted_stingray",
    "davys_locker",
    "walk_the_plank",
  ];

  for (const key of optionalExpansionKeys) {
    if (!settings[key]) continue;

    const card = EXPANSION_2025_DECK.find(
      (item) => item.extension === key,
    );

    if (card) deck.push(card);
  }

  return deck;
}

/**
 * Mélange aléatoire du paquet.
 * Fisher-Yates : chaque carte conserve son identité.
 */
export function shuffleDeck(deck: GameCard[]): GameCard[] {
  const shuffled = [...deck];

  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));

    [shuffled[i], shuffled[j]] = [
      shuffled[j],
      shuffled[i],
    ];
  }

  return shuffled;
}

/**
 * Vérifie que chaque carte possède un identifiant unique.
 */
export function validateDeck(deck: GameCard[]): boolean {
  const ids = deck.map((card) => card.id);
  return new Set(ids).size === ids.length;
}

/**
 * Crée et mélange un paquet prêt à être distribué.
 */
export function createShuffledDeck(
  extensions: Partial<GameExtensions> = {},
): GameCard[] {
  const deck = buildDeck(extensions);

  if (!validateDeck(deck)) {
    throw new Error(
      "Erreur : le paquet contient des identifiants de cartes en double.",
    );
  }

  return shuffleDeck(deck);
}
