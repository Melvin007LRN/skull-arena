import type { GameCard, Suit } from "./cards";
import type { PlayedCard } from "./rules";

export type BotDifficulty = "easy" | "normal" | "expert";

export interface BotDecisionContext {
  hand: GameCard[];
  playedCards: PlayedCard[];
  playerId: string;
  playersRemaining: number;
  tricksRemaining: number;
  difficulty: BotDifficulty;
}

export interface BotCardChoice {
  cardId: string;
  tigressMode: "pirate" | "escape" | null;
  chosenValue: number | null;
  chosenSuit: Suit | null;
}

/**
 * Heuristic estimate of the number of tricks a hand can win.
 * It only uses the bot's own hand; it never reads another player's hand.
 */
export function estimateBotBid(
  hand: GameCard[],
  difficulty: BotDifficulty = "normal",
): number {
  let strength = 0;

  for (const card of hand) {
    switch (card.type) {
      case "skull_king":
        strength += 1.35;
        break;
      case "pirate":
        strength += 0.95;
        break;
      case "tigress":
        strength += 0.8;
        break;
      case "mermaid":
        strength += 0.58;
        break;
      case "number":
        if (card.suit === "black") {
          strength += (card.value ?? 0) >= 11 ? 0.85 : 0.52;
        } else {
          strength += Math.max(0, (card.value ?? 0) - 8) * 0.075;
        }
        break;
      case "joker":
        strength += 0.62;
        break;
      case "second":
        strength += 0.25;
        break;
      default:
        break;
    }
  }

  const estimate = Math.max(0, Math.min(hand.length, Math.round(strength)));
  if (difficulty === "easy" && estimate > 0) return Math.max(0, estimate - 1);
  if (difficulty === "expert" && hand.length > 1 && strength % 1 >= 0.45) {
    return Math.min(hand.length, estimate + 1);
  }
  return estimate;
}

function cardPower(card: GameCard): number {
  switch (card.type) {
    case "skull_king": return 100;
    case "pirate": return 80;
    case "tigress": return 72;
    case "mermaid": return 64;
    case "number":
      return card.suit === "black"
        ? 35 + (card.value ?? 0)
        : 10 + (card.value ?? 0);
    case "joker": return 55;
    case "second": return 25;
    case "escape": return 1;
    default: return 8;
  }
}

function chooseJokerSuit(hand: GameCard[]): Suit {
  const counts: Record<Exclude<Suit, "black">, number> = {
    green: 0,
    purple: 0,
    yellow: 0,
  };
  for (const card of hand) {
    if (card.type === "number" && card.suit && card.suit !== "black") {
      counts[card.suit] += 1;
    }
  }
  return (Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ??
    "green") as Exclude<Suit, "black">;
}

/**
 * Chooses a legal-looking play using only the bot's hand and public cards
 * already on the table. Final legality remains the responsibility of play_card.
 */
export function chooseBotCard(context: BotDecisionContext): BotCardChoice | null {
  const { hand, playedCards, difficulty } = context;
  if (hand.length === 0) return null;

  const leadSuit = playedCards
    .slice()
    .sort((a, b) => a.order - b.order)
    .find((play) => play.card.type === "number" || play.card.type === "joker")
    ?.chosenSuit ?? playedCards
      .slice()
      .sort((a, b) => a.order - b.order)
      .find((play) => play.card.type === "number")
      ?.card.suit ?? null;

  const candidates = hand.map((card) => {
    let mode: "pirate" | "escape" | null = null;
    if (card.type === "tigress") {
      mode = difficulty === "easy" ? "escape" : "pirate";
    }

    let cost = cardPower(card);
    if (playedCards.length === 0) {
      // Lead with useful but not always the strongest card.
      cost += card.type === "number" && card.suit === "black" ? 8 : 0;
    } else if (card.type === "number" && leadSuit && card.suit !== leadSuit) {
      cost -= 18;
    }

    if (difficulty === "easy") cost += Math.random() * 22;
    if (difficulty === "expert") cost += Math.random() * 2;

    return { card, mode, cost };
  });

  // When leading, avoid spending the strongest card unless the bot has few cards left.
  candidates.sort((a, b) => {
    if (playedCards.length === 0 && hand.length > 2) return a.cost - b.cost;
    return a.cost - b.cost;
  });

  const chosen = candidates[0].card;
  return {
    cardId: chosen.id,
    tigressMode: candidates[0].mode,
    chosenValue: chosen.selectableValue?.[0] ?? null,
    chosenSuit: chosen.type === "joker"
      ? leadSuit === "black"
        ? null
        : leadSuit ?? chooseJokerSuit(hand)
      : null,
  };
}
