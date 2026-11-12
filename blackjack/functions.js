console.log("Working Fine 😊");

// Asaani ka liye banaya haa
let blackjackGame = {
  you: {
    scoreSpan: "#yourBlackjackResult",
    div: "#yourBox",
    score: 0,
  },
  dealer: {
    scoreSpan: "#dealerBlackjackResult",
    div: "#DealerBox",
    score: 0,
  },
  card: ["2", "3", "4", "5", "6", "7", "8", "9", "K", "Q", "J", "A"],
  cardMap: {
    2: 2,
    3: 3,
    4: 4,
    5: 5,
    6: 6,
    7: 7,
    8: 8,
    9: 9,
    10: 10,
    K: 10,
    Q: 10,
    J: 10,
    A: [1, 11],
  },
  wins: 0,
  losses: 0,
  draws: 0,
  isStand: false,
  turnsOver: false,
};
const YOU = blackjackGame["you"];
const DEALER = blackjackGame["dealer"];
// console.log(YOU);
// console.log(DEALER);

const hitSound = new Audio("./sounds/swish.m4a");
const winSound = new Audio("./sounds/cash.mp3");
const lostSound = new Audio("./sounds/aww.mp3");

document
  .querySelector("#blackjackHitButton")
  .addEventListener("click", blackjackHit);
document
  .querySelector("#blackjackStandButton")
  .addEventListener("click", dealerLogic);
document
  .querySelector("#blackjackDealButton")
  .addEventListener("click", blackjackDeal);

function blackjackHit() {
  if (blackjackGame["isStand"] === false) {
    // showCard(DEALER);
    let myCard = randomCard();
    // console.log("Card: ", myCard);
    showCard(myCard, YOU);
    updateScore(myCard, YOU);
    showScore(YOU);
    // console.log(YOU["score"]);
  }
}

function randomCard() {
  let randomIndex = Math.floor(Math.random() * 12);
  // console.log("randomIndex: ", randomIndex);
  return blackjackGame["card"][randomIndex];
}

function showCard(card, activePlayer) {
  if (activePlayer["score"] <= 21) {
    let cardImage = document.createElement("img");
    cardImage.src = `images/${card}.png`;
    document.querySelector(activePlayer["div"]).appendChild(cardImage);
    hitSound.play();
  }
}

function blackjackDeal() {
  if (blackjackGame["turnsOver"] === true) {
    blackjackGame["isStand"] = false;
    // showResult(computeWinner());
    // console.log("Deal Clicked");
    let yourImages = document.querySelector("#yourBox").querySelectorAll("img");
    let DealerImages = document
      .querySelector("#DealerBox")
      .querySelectorAll("img");
    // console.log(yourImages);
    for (item of yourImages) {
      item.remove();
    }
    for (item of DealerImages) {
      item.remove();
    }
    YOU["score"] = 0;
    DEALER["score"] = 0;

    document.querySelector("#yourBlackjackResult").textContent = 0;
    document.querySelector("#dealerBlackjackResult").textContent = 0;

    document.querySelector("#yourBlackjackResult").style.color = "#ffffff";
    document.querySelector("#dealerBlackjackResult").style.color = "#ffffff";

    document.querySelector("#blackjackResult").textContent = "Lets Play";
    document.querySelector("#blackjackResult").style.color = "#000000";

    blackjackGame["turnsOver"] = true;
  }
}

function updateScore(myCard, activePlayer) {
  if (myCard == "A") {
    // if add 11 keeps  me below 21 , add 11 Otherwise add 1
    if (activePlayer["score"] + blackjackGame["cardMap"][myCard][1] <= 21) {
      activePlayer["score"] += blackjackGame["cardMap"][myCard][1];
    } else {
      activePlayer["score"] += blackjackGame["cardMap"][myCard][0];
    }
  } else {
    activePlayer["score"] += blackjackGame["cardMap"][myCard];
  }
}

function showScore(activePlayer) {
  if (activePlayer["score"] > 21) {
    document.querySelector(activePlayer["scoreSpan"]).textContent = "BUST!";
    document.querySelector(activePlayer["scoreSpan"]).style.color = "red";
  } else {
    document.querySelector(activePlayer["scoreSpan"]).textContent =
      activePlayer["score"];
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function dealerLogic() {
  blackjackGame["isStand"] = true;
  if (document.getElementById("blackjackResult").innerText === "Lets Play") {
    while (DEALER["score"] < 16 && blackjackGame["isStand"] === true) {
      let dealerCard = randomCard();
      showCard(dealerCard, DEALER);
      updateScore(dealerCard, DEALER);
      showScore(DEALER);
      await sleep(1000);
    }

    if (DEALER["score"] > 15) {
      blackjackGame["turnsOver"] = true;
      let winner = computeWinner();
      showResult(winner);
      console.log("turnsOver: ", blackjackGame["turnsOver"]);
    }
  }
}

function computeWinner() {
  let winner;

  if (YOU["score"] <= 21) {
    // when high score than dealer or dealer busts
    if (YOU["score"] > DEALER["score"] || DEALER["score"] > 21) {
      console.log("You Won!");
      blackjackGame["wins"]++;
      winner = YOU;
    } else if (YOU["score"] < DEALER["score"]) {
      // console.log("You Lost!");
      blackjackGame["losses"]++;
      winner = DEALER;
    } else if (YOU["score"] === DEALER["score"]) {
      // console.log("You Drew!");
      blackjackGame["draws"]++;
    }
  }

  // user busts dealer donot
  else if (YOU["score"] > 21 && DEALER["score"] <= 21) {
    // console.log("You Lost!");
    blackjackGame["losses"]++;
    winner = DEALER;
  }
  // Both Busts
  else if (YOU["score"] > 21 && DEALER["score"] > 21) {
    // console.log("You Drew!");
    blackjackGame["draws"]++;
  }
  console.log(blackjackGame);
  return winner;
}

function showResult(winner) {
  let message, messageColor;
  if (blackjackGame["turnsOver"] === true) {
    if (winner === YOU) {
      document.querySelector("#wins").textContent = blackjackGame["wins"];
      message = "You Won!";
      messageColor = "green";
      winSound.play();
    } else if (winner === DEALER) {
      document.querySelector("#losses").textContent = blackjackGame["losses"];
      message = "You Lost!";
      messageColor = "red";
      lostSound.play();
    } else {
      document.querySelector("#draws").textContent = blackjackGame["draws"];
      message = "You Drew!";
      messageColor = "Black";
    }

    document.querySelector("#blackjackResult").textContent = message;
    document.querySelector("#blackjackResult").style.color = messageColor;
  }
}
