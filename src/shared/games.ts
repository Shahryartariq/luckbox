/** Every game in luckbox. The home page, page shell and build config read this list. */
export interface GameInfo {
  slug: string;
  name: string;
  /** One sentence for the home page ticket. */
  blurb: string;
  /** Ticket colour token from tokens.css. */
  color: "sun" | "pink" | "mint" | "sky" | "lilac" | "peach" | "lime" | "aqua";
  /** Short label for the controls, e.g. "R, P, S". */
  keys: string;
}

export const GAMES: readonly GameInfo[] = [
  {
    slug: "blackjack",
    name: "Blackjack",
    blurb: "Beat the dealer to 21. Hit, stand, double down or split, with chips that carry over between visits.",
    color: "mint",
    keys: "H hit, S stand, D double, N new hand",
  },
  {
    slug: "mines",
    name: "Mines",
    blurb: "Flip tiles on a 5 by 5 grid. Every safe tile raises your multiplier. Cash out before you hit a mine.",
    color: "pink",
    keys: "C cash out, N new round",
  },
  {
    slug: "higher-or-lower",
    name: "Higher or Lower",
    blurb: "Guess if the next card beats this one. The odds are shown, so the only question is how brave you feel.",
    color: "sun",
    keys: "Up higher, Down lower",
  },
  {
    slug: "sudoku",
    name: "Sudoku",
    blurb: "The one game here where luck can't help you. Fresh puzzles every time, each with exactly one solution.",
    color: "peach",
    keys: "Arrows move, 1 to 9 place, N notes",
  },
  {
    slug: "2048",
    name: "2048",
    blurb: "Slide the tiles and merge equal numbers. New tiles drop in at random, so plan ahead and reach 2048.",
    color: "lime",
    keys: "Arrows or WASD to slide, N new game",
  },
  {
    slug: "tic-tac-toe",
    name: "Tic Tac Toe",
    blurb: "The classic three in a row. Play a friend, or the computer on easy, medium or unbeatable. Can you hold it to a draw?",
    color: "aqua",
    keys: "1 to 9 place, arrows move, N new game",
  },
  {
    slug: "rock-paper-scissors",
    name: "Rock Paper Scissors",
    blurb: "The classic, played first to three against a computer that picks at random. No tricks.",
    color: "sky",
    keys: "R rock, P paper, S scissors",
  },
  {
    slug: "number-guess",
    name: "Number Guess",
    blurb: "Find the secret number with as few guesses as you can. Each miss narrows the range.",
    color: "lilac",
    keys: "Enter to guess",
  },
];

export function getGame(slug: string): GameInfo {
  const game = GAMES.find((g) => g.slug === slug);
  if (!game) throw new Error(`Unknown game: ${slug}`);
  return game;
}
