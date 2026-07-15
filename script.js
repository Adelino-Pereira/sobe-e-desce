const TOTAL_TRICKS = 5;
const STARTING_SCORE = 20;
const SUIT_NAMES = {
  spades: "Espadas",
  hearts: "Copas",
  clubs: "Paus",
  diamonds: "Ouros",
};

const setupScreen = document.querySelector("#setup-screen");
const gameScreen = document.querySelector("#game-screen");
const setupForm = document.querySelector("#setup-form");
const playerCount = document.querySelector("#player-count");
const playerNameFields = document.querySelector("#player-name-fields");
const setupError = document.querySelector("#setup-error");
const roundNumber = document.querySelector("#round-number");
const roundStatus = document.querySelector("#round-status");
const suitHint = document.querySelector("#suit-hint");
const suitButtons = [...document.querySelectorAll(".suit-button")];
const playerCards = document.querySelector("#player-cards");
const trickCounter = document.querySelector("#trick-counter");
const roundMessage = document.querySelector("#round-message");
const startRoundButton = document.querySelector("#start-round-button");
const updateScoresButton = document.querySelector("#update-scores-button");
const newGameButton = document.querySelector("#new-game-button");
const undoRoundButton = document.querySelector("#undo-round-button");
const winnerDialog = document.querySelector("#winner-dialog");
const winnerTitle = document.querySelector("#winner-title");
const winnerMessage = document.querySelector("#winner-message");
const winnerNewGame = document.querySelector("#winner-new-game");
const winnerClose = document.querySelector("#winner-close");
const winnerUndoRound = document.querySelector("#winner-undo-round");

let players = [];
let currentRound = 1;
let phase = "idle";
let selectedSuit = null;
let lastScoredRound = null;

function renderNameFields() {
  const count = Number(playerCount.value);
  const previousNames = [...playerNameFields.querySelectorAll("input")].map(
    (input) => input.value,
  );

  playerNameFields.replaceChildren();

  for (let index = 0; index < count; index += 1) {
    const row = document.createElement("div");
    row.className = "name-row";
    row.innerHTML = `
      <span class="name-number" aria-hidden="true">${index + 1}</span>
      <label class="sr-only" for="player-name-${index}">Nome do jogador ${index + 1}</label>
      <input
        id="player-name-${index}"
        class="name-input"
        type="text"
        maxlength="24"
        placeholder="Jogador ${index + 1}"
        value="${escapeAttribute(previousNames[index] || "")}"
        autocomplete="off"
      />
    `;
    playerNameFields.append(row);
  }
}

function escapeAttribute(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function startGame(event) {
  event.preventDefault();
  const inputs = [...playerNameFields.querySelectorAll("input")];
  const names = inputs.map(
    (input, index) => input.value.trim() || `Jogador ${index + 1}`,
  );
  const normalized = names.map((name) => name.toLocaleLowerCase());

  if (new Set(normalized).size !== names.length) {
    setupError.textContent = "Atribui um nome diferente a cada jogador.";
    setupError.hidden = false;
    return;
  }

  setupError.hidden = true;
  players = names.map((name, index) => ({
    id: index,
    name,
    score: STARTING_SCORE,
    tricks: null,
    passed: false,
    autoFilled: false,
    lastChange: null,
  }));
  currentRound = 1;
  phase = "idle";
  selectedSuit = null;
  lastScoredRound = null;
  setupScreen.hidden = true;
  gameScreen.hidden = false;
  renderGame();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderGame() {
  roundNumber.textContent = currentRound;
  renderCorrectionControls();
  renderSuitPicker();
  renderPlayerCards();
  renderRoundState();
}

function renderCorrectionControls() {
  const canCorrect = Boolean(lastScoredRound);
  undoRoundButton.hidden = !canCorrect;
  winnerUndoRound.hidden = !canCorrect;
}

function renderSuitPicker() {
  suitButtons.forEach((button) => {
    const isSelected = button.dataset.suit === selectedSuit;
    button.disabled = phase !== "choosing";
    button.setAttribute("aria-checked", String(isSelected));
  });
}

function renderPlayerCards() {
  playerCards.replaceChildren();

  players.forEach((player) => {
    const card = document.createElement("article");
    card.className = "player-card";
    if (player.passed) card.classList.add("is-passed");
    if (player.score === 0) card.classList.add("is-winner");
    card.dataset.playerId = player.id;

    const controlsEnabled =
      phase === "choosing" && Boolean(selectedSuit) && !player.passed;
    const passEnabled =
      phase === "choosing" && Boolean(selectedSuit) && selectedSuit !== "clubs";
    const inputValue = player.tricks ?? "";
    const changeText = formatScoreChange(player.lastChange);

    card.innerHTML = `
      <div class="player-info">
        <h3 class="player-name">${escapeHtml(player.name)}</h3>
        <div class="score-line">
          <strong class="score-value">${player.score}</strong>
          <span>pontos</span>
          ${changeText}
        </div>
      </div>
      <div class="round-controls">
        <div class="trick-control" aria-label="Vazas ganhas por ${escapeAttribute(player.name)}">
          <button class="stepper-button" type="button" data-action="decrement" aria-label="Diminuir as vazas de ${escapeAttribute(player.name)}" ${controlsEnabled ? "" : "disabled"}>−</button>
          <input
            class="trick-input"
            type="number"
            inputmode="numeric"
            min="0"
            max="5"
            step="1"
            aria-label="Vazas ganhas por ${escapeAttribute(player.name)}"
            value="${inputValue}"
            ${controlsEnabled ? "" : "disabled"}
          />
          <button class="stepper-button" type="button" data-action="increment" aria-label="Aumentar as vazas de ${escapeAttribute(player.name)}" ${controlsEnabled ? "" : "disabled"}>+</button>
        </div>
        <button class="pass-button" type="button" aria-pressed="${player.passed}" ${passEnabled ? "" : "disabled"}>
          ${player.passed ? "Passou" : "Passar"}
        </button>
      </div>
    `;

    const input = card.querySelector(".trick-input");
    input.addEventListener("input", () =>
      handleTrickInput(player.id, input.value),
    );
    input.addEventListener("blur", () => renderPlayerCards());
    card.querySelectorAll(".stepper-button").forEach((button) => {
      button.addEventListener("click", () =>
        stepTricks(player.id, button.dataset.action),
      );
    });
    card
      .querySelector(".pass-button")
      .addEventListener("click", () => togglePass(player.id));
    playerCards.append(card);
  });
}

function escapeHtml(value) {
  const element = document.createElement("span");
  element.textContent = value;
  return element.innerHTML;
}

function formatScoreChange(change) {
  if (change === null) return "";
  if (change === 0) return '<span class="score-change">sem alteração</span>';
  const className = change < 0 ? "score-change is-negative" : "score-change";
  return `<span class="${className}">${change > 0 ? "+" : ""}${change}</span>`;
}

function startRound() {
  phase = "choosing";
  selectedSuit = null;
  players.forEach((player) => {
    player.tricks = null;
    player.passed = false;
    player.autoFilled = false;
    player.lastChange = null;
  });
  renderGame();
  document.querySelector(".suit-button")?.focus();
}

function chooseSuit(suit) {
  if (phase !== "choosing") return;
  selectedSuit = suit;

  if (suit === "clubs") {
    players.forEach((player) => {
      player.passed = false;
    });
  }

  autoCompleteTricks();
  renderGame();
}

function handleTrickInput(playerId, rawValue) {
  const player = players.find((item) => item.id === playerId);
  if (!player || player.passed) return;

  if (rawValue === "") {
    player.tricks = null;
  } else {
    const numericValue = Number(rawValue);
    player.tricks = Number.isInteger(numericValue)
      ? Math.min(TOTAL_TRICKS, Math.max(0, numericValue))
      : null;
  }

  player.autoFilled = false;

  autoCompleteTricks(playerId);
  syncPlayerCardInputs();
  renderRoundState();
}

function stepTricks(playerId, action) {
  const player = players.find((item) => item.id === playerId);
  if (!player || player.passed) return;
  const current = player.tricks ?? 0;
  player.tricks = Math.min(
    TOTAL_TRICKS,
    Math.max(0, current + (action === "increment" ? 1 : -1)),
  );
  player.autoFilled = false;
  autoCompleteTricks(playerId);
  renderPlayerCards();
  renderRoundState();
}

function togglePass(playerId) {
  if (selectedSuit === "clubs") return;
  const player = players.find((item) => item.id === playerId);
  if (!player) return;

  player.passed = !player.passed;
  player.tricks = null;
  player.autoFilled = false;
  autoCompleteTricks();
  renderPlayerCards();
  renderRoundState();
}

function autoCompleteTricks(lastEditedId = null) {
  const active = players.filter((player) => !player.passed);
  const candidates = active.filter(
    (player) =>
      player.tricks === null ||
      (player.autoFilled && player.id !== lastEditedId),
  );

  candidates.forEach((player) => {
    if (player.autoFilled) player.tricks = null;
    player.autoFilled = false;
  });

  const fixed = active.filter((player) => player.tricks !== null);
  const enteredTotal = fixed.reduce((sum, player) => sum + player.tricks, 0);
  const remaining = TOTAL_TRICKS - enteredTotal;

  if (remaining < 0) return;

  if (candidates.length === 1) {
    candidates[0].tricks = remaining;
    candidates[0].autoFilled = true;
  } else if (candidates.length > 1 && remaining === 0) {
    candidates.forEach((player) => {
      player.tricks = 0;
      player.autoFilled = true;
    });
  }
}

function syncPlayerCardInputs() {
  players.forEach((player) => {
    const card = playerCards.querySelector(`[data-player-id="${player.id}"]`);
    if (!card) return;
    const input = card.querySelector(".trick-input");
    const expectedValue = player.tricks ?? "";
    if (String(input.value) !== String(expectedValue))
      input.value = expectedValue;
  });
}

function getEnteredTotal() {
  return players
    .filter((player) => !player.passed)
    .reduce((sum, player) => sum + (player.tricks ?? 0), 0);
}

function getRoundValidity() {
  const active = players.filter((player) => !player.passed);
  const total = getEnteredTotal();
  const allEntered =
    active.length > 0 && active.every((player) => player.tricks !== null);

  if (!selectedSuit)
    return {
      valid: false,
      message: "Escolhe o trunfo para registar as vazas.",
    };
  if (active.length === 0)
    return {
      valid: false,
      message: "Pelo menos um jogador tem de jogar nesta ronda.",
    };
  if (total > TOTAL_TRICKS)
    return {
      valid: false,
      message: `Foram registadas ${total} vazas, mas a ronda só tem 5.`,
    };
  if (!allEntered) {
    const remaining = TOTAL_TRICKS - total;
    return {
      valid: false,
      message:
        remaining === 1
          ? "Falta atribuir 1 vaza."
          : `Faltam atribuir ${remaining} vazas.`,
    };
  }
  if (total < TOTAL_TRICKS) {
    const remaining = TOTAL_TRICKS - total;
    return {
      valid: false,
      message:
        remaining === 1
          ? "Atribui a vaza restante."
          : `Atribui as ${remaining} vazas restantes.`,
    };
  }
  return {
    valid: true,
    message: "As 5 vazas estão atribuídas. Podes atualizar a pontuação.",
  };
}

function renderRoundState() {
  const validity = getRoundValidity();
  const total = getEnteredTotal();

  trickCounter.innerHTML = `<strong>${total}</strong><span>/ 5 vazas</span>`;
  trickCounter.classList.toggle("is-complete", total === TOTAL_TRICKS);
  trickCounter.classList.toggle("is-over", total > TOTAL_TRICKS);

  if (phase === "idle") {
    roundStatus.textContent = currentRound === 1 ? "Não iniciada" : "Concluída";
    suitHint.textContent =
      "Começa a ronda para desbloquear a escolha do trunfo.";
    roundMessage.textContent =
      currentRound === 1
        ? "Começa a ronda quando estiver tudo pronto."
        : "Pontuação atualizada. Começa a próxima ronda quando estiver tudo pronto.";
    roundMessage.classList.remove("is-error");
    startRoundButton.hidden = false;
    startRoundButton.disabled = false;
    startRoundButton.textContent =
      currentRound === 1 ? "Começar ronda" : "Começar próxima ronda";
    updateScoresButton.hidden = true;
    return;
  }

  roundStatus.textContent = selectedSuit
    ? SUIT_NAMES[selectedSuit]
    : "Escolher trunfo";
  suitHint.textContent =
    selectedSuit === "hearts"
      ? "Copas é a dobrar!"
      : selectedSuit === "clubs"
        ? "Em Paus todos têm de ir a jogo!."
        : selectedSuit
          ? "Regista as 5 vazas ganhas pelos jogadores ativos."
          : "Escolhe um trunfo para desbloquear os controlos dos jogadores.";
  roundMessage.textContent = validity.message;
  roundMessage.classList.toggle(
    "is-error",
    Boolean(selectedSuit) && !validity.valid && total > TOTAL_TRICKS,
  );
  startRoundButton.hidden = true;
  updateScoresButton.hidden = false;
  updateScoresButton.disabled = !validity.valid;
}

function updateScores() {
  const validity = getRoundValidity();
  if (phase !== "choosing" || !validity.valid) return;
  const multiplier = selectedSuit === "hearts" ? 2 : 1;

  lastScoredRound = {
    round: currentRound,
    suit: selectedSuit,
    players: players.map((player) => ({ ...player })),
  };

  players.forEach((player) => {
    if (player.passed) {
      player.lastChange = 0;
      return;
    }

    const change =
      player.tricks === 0 ? 5 * multiplier : -player.tricks * multiplier;
    player.lastChange = change;
    player.score = Math.max(0, player.score + change);
  });

  phase = "idle";
  const winners = players.filter((player) => player.score === 0);

  if (winners.length > 0) {
    renderGame();
    showWinner(winners);
  } else {
    currentRound += 1;
    renderGame();
  }
}

function correctLastRound() {
  if (!lastScoredRound) return;

  const hasNewRoundInProgress = phase === "choosing";
  if (
    hasNewRoundInProgress &&
    !window.confirm(
      "A ronda atual já foi iniciada. Os dados introduzidos nessa ronda serão descartados. Continuar?",
    )
  ) {
    return;
  }

  if (winnerDialog.open) winnerDialog.close();

  const snapshot = lastScoredRound;
  currentRound = snapshot.round;
  selectedSuit = snapshot.suit;
  players = snapshot.players.map((player) => ({ ...player }));
  phase = "choosing";
  lastScoredRound = null;
  renderGame();
  roundMessage.textContent =
    "Ronda reaberta. Corrige os dados e volta a atualizar a pontuação.";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showWinner(winners) {
  const names = winners.map((winner) => winner.name);
  winnerTitle.textContent =
    winners.length === 1 ? `${names[0]} ganhou!` : "Empate!";
  winnerMessage.textContent =
    winners.length === 1
      ? `${names[0]} chegou aos zero pontos na ronda ${currentRound}.`
      : `${formatNameList(names)} chegaram aos zero pontos na ronda ${currentRound}.`;
  winnerDialog.showModal();
}

function formatNameList(names) {
  if (names.length < 2) return names[0] || "";
  if (names.length === 2) return `${names[0]} e ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} e ${names.at(-1)}`;
}

function resetGame() {
  if (winnerDialog.open) winnerDialog.close();
  gameScreen.hidden = true;
  setupScreen.hidden = false;
  players = [];
  selectedSuit = null;
  phase = "idle";
  lastScoredRound = null;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

playerCount.addEventListener("change", renderNameFields);
setupForm.addEventListener("submit", startGame);
startRoundButton.addEventListener("click", startRound);
updateScoresButton.addEventListener("click", updateScores);
undoRoundButton.addEventListener("click", correctLastRound);
newGameButton.addEventListener("click", () => {
  if (window.confirm("Começar um novo jogo? A pontuação atual será apagada."))
    resetGame();
});
suitButtons.forEach((button) => {
  button.addEventListener("click", () => chooseSuit(button.dataset.suit));
});
winnerNewGame.addEventListener("click", resetGame);
winnerClose.addEventListener("click", () => winnerDialog.close());
winnerUndoRound.addEventListener("click", correctLastRound);

renderNameFields();
