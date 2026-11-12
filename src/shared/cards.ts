import { type Rng, cryptoRng, shuffle } from "./rng";

export const SUITS = ["spades", "hearts", "diamonds", "clubs"] as const;
export const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"] as const;

export type Suit = (typeof SUITS)[number];
export type Rank = (typeof RANKS)[number];

export interface Card {
  rank: Rank;
  suit: Suit;
}

const SUIT_SYMBOL: Record<Suit, string> = { spades: "♠", hearts: "♥", diamonds: "♦", clubs: "♣" };
const RANK_NAME: Record<Rank, string> = {
  A: "Ace", "2": "Two", "3": "Three", "4": "Four", "5": "Five", "6": "Six", "7": "Seven",
  "8": "Eight", "9": "Nine", "10": "Ten", J: "Jack", Q: "Queen", K: "King",
};

export function createDeck(decks = 1): Card[] {
  const out: Card[] = [];
  for (let d = 0; d < decks; d++) {
    for (const suit of SUITS) for (const rank of RANKS) out.push({ rank, suit });
  }
  return out;
}

export function shuffledDeck(decks = 1, rng: Rng = cryptoRng): Card[] {
  return shuffle(createDeck(decks), rng);
}

/** Position of the rank, Ace low: A = 1 ... K = 13. */
export function rankOrder(rank: Rank): number {
  return RANKS.indexOf(rank) + 1;
}

export function cardLabel(card: Card): string {
  return `${RANK_NAME[card.rank]} of ${card.suit}`;
}

export function isRed(card: Card): boolean {
  return card.suit === "hearts" || card.suit === "diamonds";
}

/** Builds a playing card element. Pass `hidden` for a face-down card. */
export function renderCard(card: Card | null, options: { hidden?: boolean; deal?: boolean } = {}): HTMLElement {
  const el = document.createElement("div");
  el.className = "card";
  if (options.deal) el.classList.add("card--deal");
  if (!card || options.hidden) {
    el.classList.add("card--back");
    el.setAttribute("role", "img");
    el.setAttribute("aria-label", "Face-down card");
    return el;
  }
  if (isRed(card)) el.classList.add("card--red");
  el.setAttribute("role", "img");
  el.setAttribute("aria-label", cardLabel(card));
  const symbol = SUIT_SYMBOL[card.suit];
  el.innerHTML = `
    <span class="card__corner" aria-hidden="true">${card.rank}<br>${symbol}</span>
    <span class="card__pip" aria-hidden="true">${symbol}</span>
    <span class="card__corner card__corner--flip" aria-hidden="true">${card.rank}<br>${symbol}</span>`;
  return el;
}
