import "./style.css";
import { renderCard } from "../../shared/cards";
import { $, shortcuts, wait } from "../../shared/dom";
import { load, loadRaw, remove, save } from "../../shared/storage";
import { announce, initGamePage, initReset, renderStats } from "../../shared/shell";
import { play } from "../../shared/sound";
import { BETS, Blackjack, type Hand, type Phase, STARTING_CHIPS, handValue, isBlackjack, payout } from "./logic";

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
  split: $<HTMLButtonElement>("split"),
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

/** Saves stats and the round in progress, so a reload can't skip a losing hand. */
function persist(): void {
  stats.chips = game.chips;
  stats.bet = bet;
  stats.mostChips = Math.max(stats.mostChips, game.chips);
  save("blackjack", stats);
  save("blackjack-table", game.save());
  showStats();
}

function totalText(cards: readonly Hand["cards"][number][]): string {
  if (cards.length === 0) return "";
  const { total, soft } = handValue(cards);
  if (total > 21) return `${total}, bust`;
  return soft && total < 21 ? `${total - 10} or ${total}` : String(total);
}

const OUTCOME_TEXT = { blackjack: "Blackjack", win: "Won", lose: "Lost", push: "Push" } as const;

/** Draws both sides. The dealer's second card stays face down during your turn. */
function renderHands(newCards: { player?: number; dealer?: number } = {}): void {
  const hideHole = game.phase === "player";
  const split = game.hands.length > 1;
  if (!split) {
    const cards = game.hands[0]?.cards ?? [];
    playerHand.className = "hand";
    playerHand.replaceChildren(...cards.map((c, i) => renderCard(c, { deal: i >= cards.length - (newCards.player ?? 0) })));
    playerTotal.textContent = totalText(cards);
  } else {
    playerHand.className = "bj-split";
    playerTotal.textContent = "";
    playerHand.replaceChildren(
      ...game.hands.map((h, n) => {
        const box = document.createElement("div");
        box.className = "bj-hand";
        const isActive = game.phase === "player" && n === game.active;
        box.dataset.active = String(isActive);
        if (isActive) box.setAttribute("aria-current", "true");
        const label = document.createElement("p");
        label.className = "bj-hand__label";
        const extra = h.outcome ? `, ${OUTCOME_TEXT[h.outcome]}` : h.doubled ? ", doubled" : "";
        label.textContent = `Hand ${n + 1}: ${totalText(h.cards)}${extra}`;
        const cards = document.createElement("div");
        cards.className = "hand";
        const fresh = n === game.active ? (newCards.player ?? 0) : 0;
        cards.append(...h.cards.map((c, i) => renderCard(c, { deal: i >= h.cards.length - fresh })));
        box.append(label, cards);
        return box;
      }),
    );
  }
  dealerHand.replaceChildren(
    ...game.dealer.map((c, i) =>
      renderCard(c, { hidden: hideHole && i === 1, deal: i >= game.dealer.length - (newCards.dealer ?? 0) }),
    ),
  );
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
  const inRound = game.phase === "player" || game.phase === "dealer";
  const broke = game.chips < Math.min(...BETS);
  // Fall back to the largest bet you can afford.
  if (!broke && bet > game.chips) bet = [...BETS].reverse().find((b) => b <= game.chips) ?? BETS[0];
  btn.deal.disabled = busy || inRound || broke || !game.canDeal(bet);
  btn.deal.hidden = broke && !inRound;
  btn.refill.hidden = !broke || inRound;
  btn.hit.disabled = !playing;
  btn.stand.disabled = !playing;
  btn.double.disabled = !playing || !game.canDouble();
  btn.split.disabled = !playing || !game.canSplit();
  chipsEl.textContent = String(game.chips);
  renderBets();
}

function handSummary(h: Hand, n: number, many: boolean): string {
  const net = payout(h.outcome ?? "push", h.bet);
  const name = many ? `Hand ${n + 1}` : "You";
  const you = handValue(h.cards).total;
  const dealer = handValue(game.dealer).total;
  switch (h.outcome) {
    case "blackjack":
      return `Blackjack! ${name} win${many ? "s" : ""} ${net} chips.`;
    case "win":
      return dealer > 21 ? `Dealer busts. ${name} win${many ? "s" : ""} ${net}.` : `${you} beats ${dealer}. ${name} win${many ? "s" : ""} ${net}.`;
    case "lose":
      if (you > 21) return `${name} bust${many ? "s" : ""} with ${you}, losing ${-net}.`;
      if (isBlackjack(game.dealer)) return `Dealer has blackjack. ${name} lose${many ? "s" : ""} ${-net}.`;
      return `Dealer's ${dealer} beats ${you}. ${name} lose${many ? "s" : ""} ${-net}.`;
    default:
      return `Push at ${you}. ${many ? "That bet" : "Your bet"} comes back.`;
  }
}

function report(): void {
  if (game.phase !== "done") return;
  const many = game.hands.length > 1;
  for (const h of game.hands) {
    if (h.outcome === "blackjack") stats.blackjacks++;
    if (h.outcome === "blackjack" || h.outcome === "win") stats.won++;
    else if (h.outcome === "lose") stats.lost++;
    else stats.pushes++;
  }
  const lines = game.hands.map((h, n) => handSummary(h, n, many));
  const net = game.net;
  if (many) lines.push(net > 0 ? `Net +${net}.` : net < 0 ? `Net ${net}.` : "You break even.");
  announce(lines.join(" "), net > 0 ? "win" : net < 0 ? "lose" : "push");
  play(net > 0 ? "win" : net < 0 ? "lose" : "push");
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
    persist();
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

function prompt(prefix = ""): void {
  const many = game.hands.length > 1;
  const total = handValue(game.player).total;
  const options = ["hit", "stand"];
  if (game.canDouble()) options.push("double");
  if (game.canSplit()) options.push("split");
  const last = options.pop();
  const list = `${options.join(", ")} or ${last}`;
  announce(`${prefix}${many ? `Hand ${game.active + 1}: ` : ""}${total}. ${list.charAt(0).toUpperCase()}${list.slice(1)}?`);
}

async function afterPlayerAction(): Promise<void> {
  persist();
  if (game.phase === "dealer") await dealerTurn();
  else if (game.phase === "done") {
    renderHands();
    report();
    renderControls();
    btn.deal.focus();
  } else {
    renderControls();
    prompt();
  }
}

async function deal(): Promise<void> {
  if (busy || !game.canDeal(bet) || game.phase === "player") return;
  game.deal(bet);
  play("flip");
  renderHands({ player: 2, dealer: 2 });
  // deal() may end the round at once on a natural, so read the phase again.
  if ((game.phase as Phase) === "player") {
    renderControls();
    persist();
    prompt();
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
  renderHands();
  void afterPlayerAction();
}

function double(): void {
  if (busy || !game.canDouble()) return;
  const n = game.active;
  game.double();
  play("flip");
  renderHands({ player: 1 });
  announce(`${game.hands.length > 1 ? `Hand ${n + 1} doubled` : "Doubled"} to ${game.hands[n]?.bet ?? 0}. One card only.`);
  void afterPlayerAction();
}

function split(): void {
  if (busy || !game.canSplit()) return;
  game.split();
  play("flip");
  renderHands({ player: 1 });
  void afterPlayerAction();
}

btn.deal.addEventListener("click", () => void deal());
btn.hit.addEventListener("click", hit);
btn.stand.addEventListener("click", stand);
btn.double.addEventListener("click", double);
btn.split.addEventListener("click", split);
btn.refill.addEventListener("click", () => {
  game.chips = STARTING_CHIPS;
  bet = Math.min(bet, STARTING_CHIPS);
  persist();
  renderControls();
  announce("Chips back to 100. Good luck.");
  btn.deal.focus();
});

shortcuts({ n: () => void deal(), h: hit, s: stand, d: double, p: split });

initReset(() => {
  remove("blackjack");
  stats = { ...DEFAULT_STATS };
  if (game.phase !== "player" && game.phase !== "dealer") game.chips = STARTING_CHIPS;
  persist();
  renderControls();
});

// Pick up a round left in progress.
const resumed = game.restore(loadRaw("blackjack-table")) && (game.phase === "player" || game.phase === "dealer");
renderHands();
renderControls();
showStats();
if (resumed && game.phase === "player") {
  prompt("Welcome back, your hand is where you left it. ");
} else if (resumed && game.phase === "dealer") {
  void dealerTurn();
} else {
  announce(game.chips < Math.min(...BETS) ? "You're out of chips. Refill to keep playing." : "Pick a bet and deal.");
}
