import "./style.css";
import { renderCard } from "../../shared/cards";
import { $, shortcuts, wait } from "../../shared/dom";
import { load, remove, save } from "../../shared/storage";
import { announce, initGamePage, initReset, renderStats } from "../../shared/shell";
import { play } from "../../shared/sound";
import { BETS, Blackjack, type Phase, STARTING_CHIPS, handValue, payout } from "./logic";

initGamePage("blackjack");

const DEFAULT_STATS = { chips: STARTING_CHIPS, bet: 10, won: 0, lost: 0, pushes: 0, blackjacks: 0, mostChips: STARTING_CHIPS };
let stats = load("blackjack", DEFAULT_STATS);
if (stats.chips < 0) stats.chips = STARTING_CHIPS;

const game = new Blackjack(stats.chips);
let bet: number = (BETS as readonly number[]).includes(stats.bet) ? stats.bet : 10;
let busy = false;

const dealerHand = $("dealer-hand");
const playerHand = $("player-hand");
const dealerTotal = $("dealer-total");
const playerTotal = $("player-total");
const chipsEl = $("chips");
const btn = {
  deal: $<HTMLButtonElement>("deal"),
  hit: $<HTMLButtonElement>("hit"),
  stand: $<HTMLButtonElement>("stand"),
  double: $<HTMLButtonElement>("double"),
  refill: $<HTMLButtonElement>("refill"),
};
const betBox = $("bets");

function showStats(): void {
  renderStats([
    { label: "Chips", value: game.chips },
    { label: "Most chips", value: stats.mostChips },
    { label: "Hands won", value: stats.won },
    { label: "Hands lost", value: stats.lost },
    { label: "Pushes", value: stats.pushes },
    { label: "Blackjacks", value: stats.blackjacks },
  ]);
}

function persist(): void {
  stats.chips = game.chips;
  stats.bet = bet;
  stats.mostChips = Math.max(stats.mostChips, game.chips);
  save("blackjack", stats);
  showStats();
}

function totalText(cards: typeof game.player): string {
  if (cards.length === 0) return "";
  const { total, soft } = handValue(cards);
  if (total > 21) return `${total}, bust`;
  return soft && total < 21 ? `${total - 10} or ${total}` : String(total);
}

/** Draws both hands. The dealer's second card stays face down during your turn. */
function renderHands(newCards: { player?: number; dealer?: number } = {}): void {
  const hideHole = game.phase === "player";
  playerHand.replaceChildren(
    ...game.player.map((c, i) => renderCard(c, { deal: i >= game.player.length - (newCards.player ?? 0) })),
  );
  dealerHand.replaceChildren(
    ...game.dealer.map((c, i) =>
      renderCard(c, { hidden: hideHole && i === 1, deal: i >= game.dealer.length - (newCards.dealer ?? 0) }),
    ),
  );
  playerTotal.textContent = totalText(game.player);
  dealerTotal.textContent = hideHole ? totalText(game.dealer.slice(0, 1)) : totalText(game.dealer);
}

function renderBets(): void {
  const locked = game.phase === "player" || game.phase === "dealer" || busy;
  betBox.replaceChildren(
    ...BETS.map((amount) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = String(amount);
      b.setAttribute("aria-label", `Bet ${amount} chips`);
      b.setAttribute("aria-pressed", String(amount === bet));
      b.disabled = locked || amount > game.chips;
      b.addEventListener("click", () => {
        bet = amount;
        persist();
        renderControls();
      });
      return b;
    }),
  );
}

function renderControls(): void {
  const playing = game.phase === "player" && !busy;
  const broke = game.chips < Math.min(...BETS);
  // Fall back to the largest bet you can afford.
  if (!broke && bet > game.chips) bet = [...BETS].reverse().find((b) => b <= game.chips) ?? BETS[0];
  btn.deal.disabled = busy || playing || broke || !game.canDeal(bet);
  btn.deal.hidden = broke;
  btn.refill.hidden = !broke || game.phase === "player" || game.phase === "dealer";
  btn.hit.disabled = !playing;
  btn.stand.disabled = !playing;
  btn.double.disabled = !playing || !game.canDouble();
  chipsEl.textContent = String(game.chips);
  renderBets();
}

function report(): void {
  const outcome = game.outcome;
  if (!outcome) return;
  const net = payout(outcome, game.bet);
  const you = handValue(game.player).total;
  const dealer = handValue(game.dealer).total;
  switch (outcome) {
    case "blackjack":
      stats.blackjacks++;
      stats.won++;
      announce(`Blackjack! You win ${net} chips.`, "win");
      play("win");
      break;
    case "win":
      stats.won++;
      announce(dealer > 21 ? `Dealer busts. You win ${net} chips.` : `${you} beats ${dealer}. You win ${net} chips.`, "win");
      play("win");
      break;
    case "lose":
      stats.lost++;
      announce(
        you > 21 ? `Bust with ${you}. You lose ${-net} chips.` : dealer === 21 && game.dealer.length === 2 ? `Dealer has blackjack. You lose ${-net} chips.` : `Dealer's ${dealer} beats ${you}. You lose ${-net} chips.`,
        "lose",
      );
      play("lose");
      break;
    case "push":
      stats.pushes++;
      announce(`Push at ${you}. Your bet comes back.`, "push");
      play("push");
      break;
  }
  if (game.chips < Math.min(...BETS)) announce("You're out of chips. Refill to keep playing.", "lose");
  persist();
}

async function dealerTurn(): Promise<void> {
  busy = true;
  renderControls();
  renderHands();
  play("flip");
  await wait(550);
  for (;;) {
    const card = game.dealerStep();
    if (!card) break;
    renderHands({ dealer: 1 });
    play("flip");
    await wait(650);
  }
  busy = false;
  renderHands();
  report();
  renderControls();
  btn.deal.focus();
}

async function afterPlayerAction(): Promise<void> {
  if (game.phase === "dealer") await dealerTurn();
  else if (game.phase === "done") {
    renderHands();
    report();
    renderControls();
    btn.deal.focus();
  } else {
    renderControls();
  }
}

async function deal(): Promise<void> {
  if (busy || !game.canDeal(bet) || game.phase === "player") return;
  game.deal(bet);
  play("flip");
  renderHands({ player: 2, dealer: 2 });
  // Read the phase again: deal() may have ended the hand on a natural blackjack.
  const phase = game.phase as Phase;
  if (phase === "player") {
    announce(`Your bet is ${bet}. Hit or stand?`);
    renderControls();
    btn.hit.focus();
  } else {
    await afterPlayerAction();
  }
}

function hit(): void {
  if (busy || game.phase !== "player") return;
  game.hit();
  play("flip");
  renderHands({ player: 1 });
  void afterPlayerAction();
}

function stand(): void {
  if (busy || game.phase !== "player") return;
  game.stand();
  void afterPlayerAction();
}

function double(): void {
  if (busy || !game.canDouble()) return;
  game.double();
  play("flip");
  renderHands({ player: 1 });
  announce(`Doubled to ${game.bet}. One card only.`);
  void afterPlayerAction();
}

btn.deal.addEventListener("click", () => void deal());
btn.hit.addEventListener("click", hit);
btn.stand.addEventListener("click", stand);
btn.double.addEventListener("click", double);
btn.refill.addEventListener("click", () => {
  game.chips = STARTING_CHIPS;
  bet = Math.min(bet, STARTING_CHIPS);
  persist();
  renderControls();
  announce("Chips back to 100. Good luck.");
  btn.deal.focus();
});

shortcuts({ n: () => void deal(), h: hit, s: stand, d: double });

initReset(() => {
  remove("blackjack");
  stats = { ...DEFAULT_STATS };
  if (game.phase !== "player" && game.phase !== "dealer") game.chips = STARTING_CHIPS;
  persist();
  renderControls();
});

renderHands();
renderControls();
showStats();
announce(game.chips < Math.min(...BETS) ? "You're out of chips. Refill to keep playing." : "Pick a bet and deal.");
