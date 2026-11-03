import { createShuffledDeck, type GameCard, type GameExtensions, DEFAULT_GAME_EXTENSIONS } from "./cards";
import { chooseBotCard, estimateBotBid, type BotDifficulty } from "./bots";
import { resolveTrick, type PlayedCard, type TrickResult } from "./rules";

export type SoloPhase = "bidding" | "playing" | "round-summary" | "finished";
export interface SoloPlayer {
  id: string;
  name: string;
  isHuman: boolean;
  hand: GameCard[];
  bid: number | null;
  tricksWon: number;
  totalScore: number;
}
export interface SoloMatch {
  phase: SoloPhase;
  round: number;
  maxRounds: number;
  difficulty: BotDifficulty;
  players: SoloPlayer[];
  leaderIndex: number;
  turnIndex: number;
  trickNumber: number;
  plays: PlayedCard[];
  lastResult: TrickResult | null;
  message: string;
}
export interface SoloSettings {
  botCount: number;
  difficulty: BotDifficulty;
  username: string;
  extensions?: Partial<GameExtensions>;
}
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function createSoloMatch(settings: SoloSettings): SoloMatch {
  const botCount = clamp(Math.floor(settings.botCount), 1, 7);
  const players: SoloPlayer[] = [{
    id: "solo-human",
    name: settings.username.trim() || "Capitaine",
    isHuman: true,
    hand: [],
    bid: null,
    tricksWon: 0,
    totalScore: 0,
  }];
  for (let i = 0; i < botCount; i++) {
    players.push({
      id: `solo-bot-${i + 1}`,
      name: ["Barbe-Noire", "Anne Bonny", "Long John", "Calico Jack", "Mary Read", "Le Borgne", "Black Sam"][i],
      isHuman: false,
      hand: [],
      bid: null,
      tricksWon: 0,
      totalScore: 0,
    });
  }
  const deckSize = createShuffledDeck(settings.extensions ?? DEFAULT_GAME_EXTENSIONS).length;
  const maxRounds = Math.min(10, Math.floor(deckSize / players.length));
  const match: SoloMatch = {
    phase: "bidding",
    round: 1,
    maxRounds,
    difficulty: settings.difficulty,
    players,
    leaderIndex: 0,
    turnIndex: 0,
    trickNumber: 1,
    plays: [],
    lastResult: null,
    message: "Les cartes sont distribuées. Annonce ton pari !",
  };
  return dealSoloRound(match, settings.extensions);
}

export function dealSoloRound(match: SoloMatch, extensions?: Partial<GameExtensions>): SoloMatch {
  const deck = createShuffledDeck(extensions ?? DEFAULT_GAME_EXTENSIONS);
  const players = match.players.map((player) => ({
    ...player,
    hand: [],
    bid: null,
    tricksWon: 0,
  }));
  let cursor = 0;
  for (let cardIndex = 0; cardIndex < match.round; cardIndex++) {
    for (const player of players) {
      const card = deck[cursor++];
      if (card) player.hand.push(card);
    }
  }
  for (const player of players) {
    if (!player.isHuman) player.bid = estimateBotBid(player.hand, match.difficulty);
  }
  return {
    ...match,
    phase: "bidding",
    players,
    leaderIndex: (match.round - 1) % players.length,
    turnIndex: (match.round - 1) % players.length,
    trickNumber: 1,
    plays: [],
    lastResult: null,
    message: "À toi d'annoncer ton nombre de plis.",
  };
}

export function submitSoloBid(match: SoloMatch, bid: number): SoloMatch {
  if (match.phase !== "bidding" || !Number.isInteger(bid) || bid < 0 || bid > match.round) return match;
  const players = match.players.map((p, i) => i === 0 ? { ...p, bid } : p);
  return playBotUntilHuman({ ...match, players, phase: "playing", turnIndex: match.leaderIndex, message: "Les enchères sont révélées. À toi de jouer !" });
}

function playBotUntilHuman(match: SoloMatch): SoloMatch {
  let next = match;
  let safety = 0;
  while (next.phase === "playing" && !next.players[next.turnIndex]?.isHuman && safety++ < 20) {
    const player = next.players[next.turnIndex];
    const choice = chooseBotCard({
      hand: player.hand,
      playedCards: next.plays,
      playerId: player.id,
      playersRemaining: next.players.length,
      tricksRemaining: next.round - next.trickNumber + 1,
      difficulty: next.difficulty,
    });
    if (!choice) break;
    next = playSoloCard(next, player.id, choice.cardId, {
      tigressMode: choice.tigressMode,
      chosenValue: choice.chosenValue,
      chosenSuit: choice.chosenSuit,
    }, false);
  }
  return next;
}

export function playSoloCard(
  match: SoloMatch,
  playerId: string,
  cardId: string,
  options: { tigressMode?: "pirate" | "escape" | null; chosenValue?: number | null; chosenSuit?: "green" | "purple" | "yellow" | "black" | null } = {},
  advanceBots = true,
): SoloMatch {
  if (match.phase !== "playing") return match;
  const playerIndex = match.players.findIndex((p) => p.id === playerId);
  if (playerIndex < 0 || playerIndex !== match.turnIndex) return match;
  const player = match.players[playerIndex];
  const card = player.hand.find((item) => item.id === cardId);
  if (!card) return match;
  if (card.type === "tigress" && !options.tigressMode) return { ...match, message: "Choisis Pirate ou Fuite pour la Tigresse." };
  if (card.selectableValue?.length && options.chosenValue == null) return { ...match, message: "Choisis la valeur de cette carte." };
  if (card.type === "joker" && options.chosenSuit === "black") return { ...match, message: "Le Joker ne peut pas prendre la couleur noire." };

  const played: PlayedCard = {
    playerId,
    card,
    order: match.plays.length,
    ...(options.tigressMode ? { tigressMode: options.tigressMode } : {}),
    ...(options.chosenValue != null ? { chosenValue: options.chosenValue } : {}),
    ...(options.chosenSuit ? { chosenSuit: options.chosenSuit } : {}),
  };
  const players = match.players.map((p, i) => i === playerIndex
    ? { ...p, hand: p.hand.filter((c) => c.id !== cardId) }
    : p);
  const plays = [...match.plays, played];
  if (plays.length < players.length) {
    const nextTurn = (playerIndex + 1) % players.length;
    const updated = { ...match, players, plays, turnIndex: nextTurn, message: players[nextTurn].isHuman ? "À toi de jouer." : `${players[nextTurn].name} réfléchit...` };
    return advanceBots && !players[nextTurn].isHuman ? playBotUntilHuman(updated) : updated;
  }

  const plankTarget = plays.find((play) => play.card.type === "pirate" || (play.card.type === "tigress" && play.tigressMode === "pirate"))?.playerId;
  const result = resolveTrick(plays, { walkThePlankTargetPlayerId: plankTarget });
  const updatedPlayers = players.map((p) => p.id === result.winnerPlayerId
    ? { ...p, tricksWon: p.tricksWon + 1 }
    : p);
  const nextTrickNumber = match.trickNumber + 1;
  const roundComplete = nextTrickNumber > match.round;
  if (roundComplete) {
    const scored = updatedPlayers.map((p) => {
      const exact = p.bid === p.tricksWon;
      const points = exact
        ? (p.bid === 0 ? match.round * 10 : p.bid * 20)
        : -Math.abs((p.bid ?? 0) - p.tricksWon) * 10;
      return { ...p, totalScore: p.totalScore + points };
    });
    return {
      ...match,
      players: scored,
      phase: match.round >= match.maxRounds ? "finished" : "round-summary",
      plays: [],
      lastResult: result,
      message: "Manche terminée. Consulte les scores !",
    };
  }
  const winnerIndex = result.nextLeaderPlayerId
    ? updatedPlayers.findIndex((p) => p.id === result.nextLeaderPlayerId)
    : match.leaderIndex;
  const nextLeader = winnerIndex >= 0 ? winnerIndex : match.leaderIndex;
  const nextMatch: SoloMatch = {
    ...match,
    players: updatedPlayers,
    leaderIndex: nextLeader,
    turnIndex: nextLeader,
    trickNumber: nextTrickNumber,
    plays: [],
    lastResult: result,
    message: result.message,
  };
  return advanceBots && !updatedPlayers[nextLeader].isHuman
    ? playBotUntilHuman(nextMatch)
    : nextMatch;
}

export function startNextSoloRound(match: SoloMatch, extensions?: Partial<GameExtensions>): SoloMatch {
  if (match.phase !== "round-summary") return match;
  return dealSoloRound({ ...match, round: match.round + 1 }, extensions);
}

export function playSoloBots(match: SoloMatch): SoloMatch {
  return playBotUntilHuman(match);
}
