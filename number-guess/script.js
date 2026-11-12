const MAX_ATTEMPTS = 5;

const buttonsEl = document.getElementById("buttons");
const attemptsEl = document.getElementById("attempts");
const resultEl = document.getElementById("result");
const playAgainBtn = document.getElementById("playAgain");

let secret;
let attemptsLeft;

function newGame() {
  secret = Math.floor(Math.random() * 10); // 0 to 9
  attemptsLeft = MAX_ATTEMPTS;
  attemptsEl.textContent = `Attempts left: ${attemptsLeft}`;
  resultEl.textContent = "";
  resultEl.className = "mainHeading";
  playAgainBtn.hidden = true;
  buttonsEl.querySelectorAll("button").forEach((btn) => {
    btn.disabled = false;
  });
}

function endGame(message, colorClass) {
  resultEl.textContent = message;
  resultEl.className = `mainHeading ${colorClass}`;
  buttonsEl.querySelectorAll("button").forEach((btn) => {
    btn.disabled = true;
  });
  playAgainBtn.hidden = false;
}

function guess(value) {
  attemptsLeft--;
  attemptsEl.textContent = `Attempts left: ${attemptsLeft}`;

  if (value === secret) {
    endGame(`You win! It was ${secret}.`, "text-success");
  } else if (attemptsLeft === 0) {
    endGame(`Out of attempts. It was ${secret}.`, "text-danger");
  } else {
    const hint = value < secret ? "higher" : "lower";
    resultEl.textContent = `Not ${value}. Try ${hint}.`;
    resultEl.className = "mainHeading text-danger";
  }
}

for (let i = 0; i <= 9; i++) {
  const btn = document.createElement("button");
  btn.className = "btn btn-primary myButton";
  btn.textContent = i;
  btn.addEventListener("click", () => {
    btn.disabled = true;
    guess(i);
  });
  buttonsEl.appendChild(btn);
}

playAgainBtn.addEventListener("click", newGame);

newGame();
