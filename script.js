const TOTAL_TRICKS = 5;
const STARTING_SCORE = 20;
const MAX_CONSECUTIVE_PASSES = 2;
const STORAGE_KEY = "sobe-desce-active-game-v1";
const SUIT_NAMES = {
  spades: "Espadas",
  hearts: "Copas",
  clubs: "Paus",
  diamonds: "Ouros",
};
const SUIT_SYMBOLS = {
  spades: "♠",
  hearts: "♥",
  clubs: "♣",
  diamonds: "♦",
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
const historyDialog = document.querySelector("#history-dialog");
const historyTitle = document.querySelector("#history-title");
const historyCurrentScore = document.querySelector("#history-current-score");
const historyClose = document.querySelector("#history-close");
const historyChartScroll = document.querySelector("#history-chart-scroll");
const historyChart = document.querySelector("#history-chart");
const historyChartDetail = document.querySelector("#history-chart-detail");
const historyList = document.querySelector("#history-list");
const historyEmpty = document.querySelector("#history-empty");

let players = [];
let currentRound = 1;
let phase = "idle";
let selectedSuit = null;
let lastScoredRound = null;
let roundHistory = [];

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
    consecutivePasses: 0,
    autoFilled: false,
    lastChange: null,
  }));
  currentRound = 1;
  phase = "idle";
  selectedSuit = null;
  lastScoredRound = null;
  roundHistory = [];
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
  saveGame();
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
    const consecutivePasses = player.consecutivePasses ?? 0;
    const passEnabled =
      phase === "choosing" &&
      Boolean(selectedSuit) &&
      selectedSuit !== "clubs" &&
      (player.passed || consecutivePasses < MAX_CONSECUTIVE_PASSES);
    const inputValue = player.tricks ?? "";
    const changeText = formatScoreChange(player.lastChange);
    const passStatus = formatPassStatus(player);
    const passButtonText = player.passed
      ? "Passou"
      : consecutivePasses >= MAX_CONSECUTIVE_PASSES
        ? "Jogar"
        : "Passar";
    const passLabel =
      consecutivePasses >= MAX_CONSECUTIVE_PASSES && !player.passed
        ? `${player.name} tem de jogar nesta ronda`
        : `${player.passed ? "Anular o passe de" : "Passar a ronda com"} ${player.name}`;

    card.innerHTML = `
      <div class="player-info">
        <button class="player-history-button" type="button" aria-label="Ver histórico de ${escapeAttribute(player.name)}">
          <span class="player-name">${escapeHtml(player.name)}</span>
          <span class="history-indicator" aria-hidden="true">↗</span>
        </button>
        <div class="score-line">
          <strong class="score-value">${player.score}</strong>
          <span>pontos</span>
          ${changeText}
        </div>
        ${passStatus ? `<div class="pass-status ${consecutivePasses >= MAX_CONSECUTIVE_PASSES ? "pass-status--required" : ""}">${passStatus}</div>` : ""}
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
        <button class="pass-button" type="button" aria-label="${escapeAttribute(passLabel)}" aria-pressed="${player.passed}" ${passEnabled ? "" : "disabled"}>
          ${passButtonText}
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
    card
      .querySelector(".player-history-button")
      .addEventListener("click", () => openPlayerHistory(player.id));
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

function formatPassStatus(player) {
  const completedPasses = player.consecutivePasses ?? 0;
  const pendingPass = phase === "choosing" && player.passed ? 1 : 0;
  const effectivePasses = completedPasses + pendingPass;

  if (phase === "choosing" && !player.passed && completedPasses >= MAX_CONSECUTIVE_PASSES) {
    return "Tem de jogar nesta ronda";
  }
  if (phase === "choosing" && player.passed && effectivePasses >= MAX_CONSECUTIVE_PASSES) {
    return "2.º passe consecutivo · depois tem de jogar";
  }
  if (effectivePasses === 1) return "1.º passe consecutivo";
  if (effectivePasses >= MAX_CONSECUTIVE_PASSES) return "Limite de passes atingido";
  return "";
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
  saveGame();
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
  saveGame();
}

function togglePass(playerId) {
  if (selectedSuit === "clubs") return;
  const player = players.find((item) => item.id === playerId);
  if (!player) return;
  if (!player.passed && (player.consecutivePasses ?? 0) >= MAX_CONSECUTIVE_PASSES) {
    return;
  }

  player.passed = !player.passed;
  player.tricks = null;
  player.autoFilled = false;
  autoCompleteTricks();
  renderPlayerCards();
  renderRoundState();
  saveGame();
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
  const invalidPass = players.find(
    (player) => player.passed && (player.consecutivePasses ?? 0) >= MAX_CONSECUTIVE_PASSES,
  );

  if (!selectedSuit)
    return {
      valid: false,
      message: "Escolhe o trunfo para registar as vazas.",
    };
  if (invalidPass)
    return {
      valid: false,
      message: `${invalidPass.name} já passou duas vezes consecutivas e tem de jogar nesta ronda.`,
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
    historyLength: roundHistory.length,
  };

  const historyEntry = {
    round: currentRound,
    suit: selectedSuit,
    players: [],
  };

  players.forEach((player) => {
    const scoreBefore = player.score;
    const passStreakBefore = player.consecutivePasses ?? 0;
    if (player.passed) {
      player.lastChange = 0;
      player.consecutivePasses = Math.min(
        MAX_CONSECUTIVE_PASSES,
        passStreakBefore + 1,
      );
    } else {
      player.consecutivePasses = 0;
      player.lastChange =
        player.tricks === 0 ? 5 * multiplier : -player.tricks * multiplier;
      player.score = Math.max(0, player.score + player.lastChange);
    }

    historyEntry.players.push({
      id: player.id,
      scoreBefore,
      tricks: player.tricks,
      passed: player.passed,
      change: player.lastChange,
      scoreAfter: player.score,
      passStreakBefore,
      passStreakAfter: player.consecutivePasses,
    });
  });

  roundHistory.push(historyEntry);

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
  roundHistory = roundHistory.slice(0, snapshot.historyLength);
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
  roundHistory = [];
  localStorage.removeItem(STORAGE_KEY);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function openPlayerHistory(playerId) {
  const player = players.find((item) => item.id === playerId);
  if (!player) return;

  renderPlayerHistory(player);
  historyDialog.showModal();
  requestAnimationFrame(() => {
    historyChartScroll.scrollLeft = historyChartScroll.scrollWidth;
  });
}

function renderPlayerHistory(player) {
  let derivedPassStreak = 0;
  const records = roundHistory
    .map((entry) => {
      const result = entry.players.find((item) => item.id === player.id);
      if (!result) return null;
      derivedPassStreak = result.passed ? derivedPassStreak + 1 : 0;
      return {
        ...result,
        passStreakAfter: Number.isInteger(result.passStreakAfter)
          ? result.passStreakAfter
          : derivedPassStreak,
        round: entry.round,
        suit: entry.suit,
      };
    })
    .filter(Boolean);

  historyTitle.textContent = player.name;
  historyCurrentScore.textContent = `${player.score} pontos neste momento`;
  historyEmpty.hidden = records.length > 0;
  renderHistoryChart(records, player.score);
  renderHistoryList(records);
}

function renderHistoryChart(records, currentScore) {
  const initialScore = records[0]?.scoreBefore ?? currentScore;
  const points = [
    { round: 0, score: initialScore, record: null },
    ...records.map((record) => ({
      round: record.round,
      score: record.scoreAfter,
      record,
    })),
  ];
  const width = Math.max(340, (points.length - 1) * 64 + 80);
  const height = 220;
  const left = 38;
  const right = 18;
  const top = 28;
  const bottom = 42;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const maxScore = Math.max(STARTING_SCORE, ...points.map((point) => point.score));
  const axisMax = Math.max(5, Math.ceil(maxScore / 5) * 5);
  const xFor = (index) =>
    points.length === 1
      ? left + plotWidth / 2
      : left + (index / (points.length - 1)) * plotWidth;
  const yFor = (score) => top + ((axisMax - score) / axisMax) * plotHeight;
  const gridValues = [...new Set([axisMax, Math.round(axisMax / 2), 0])];

  const grid = gridValues
    .map((value) => {
      const y = yFor(value);
      const lineClass = value === 0 ? "history-goal-line" : "history-grid-line";
      return `
        <line class="${lineClass}" x1="${left}" y1="${y}" x2="${width - right}" y2="${y}"></line>
        <text class="history-axis-label" x="${left - 8}" y="${y + 3}" text-anchor="end">${value}</text>
      `;
    })
    .join("");

  const segments = records
    .map((record, index) => {
      const start = points[index];
      const end = points[index + 1];
      const direction =
        record.change < 0 ? "down" : record.change > 0 ? "up" : "flat";
      return `<line class="history-segment history-segment--${direction}" x1="${xFor(index)}" y1="${yFor(start.score)}" x2="${xFor(index + 1)}" y2="${yFor(end.score)}"></line>`;
    })
    .join("");

  const circles = points
    .map((point, index) => {
      const x = xFor(index);
      const y = yFor(point.score);
      const recordIndex = index - 1;
      const direction = !point.record
        ? "start"
        : point.record.change < 0
          ? "down"
          : point.record.change > 0
            ? "up"
            : "flat";
      const label = point.record
        ? `Ronda ${point.round}: ${formatHistoryResult(point.record)}, ${formatSignedChange(point.record.change)} pontos, total ${point.score}`
        : `Início: ${point.score} pontos`;
      const roundLabel = point.record ? `R${point.round}` : "Início";
      const suitMarker = point.record
        ? `<text class="history-suit-marker ${isRedSuit(point.record.suit) ? "history-suit-marker--red" : ""}" x="${x}" y="${Math.max(15, y - 12)}" text-anchor="middle">${SUIT_SYMBOLS[point.record.suit]}</text>`
        : "";
      return `
        ${suitMarker}
        <circle class="history-point history-point--${direction}" cx="${x}" cy="${y}" r="6" tabindex="0" role="button" data-record-index="${recordIndex}" aria-label="${escapeAttribute(label)}"><title>${escapeHtml(label)}</title></circle>
        <text class="history-axis-label" x="${x}" y="${height - 16}" text-anchor="middle">${roundLabel}</text>
      `;
    })
    .join("");

  historyChart.innerHTML = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Gráfico da evolução da pontuação">
      ${grid}
      ${segments}
      ${circles}
    </svg>
  `;

  const showDetail = (recordIndex) => {
    historyChartDetail.textContent =
      recordIndex < 0
        ? `Início do jogo · ${initialScore} pontos`
        : formatHistoryDetail(records[recordIndex]);
  };

  historyChart.querySelectorAll(".history-point").forEach((point) => {
    const showPoint = () => showDetail(Number(point.dataset.recordIndex));
    point.addEventListener("click", showPoint);
    point.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        showPoint();
      }
    });
  });

  if (records.length > 0) {
    showDetail(records.length - 1);
  } else {
    showDetail(-1);
  }
}

function renderHistoryList(records) {
  historyList.replaceChildren();

  [...records].reverse().forEach((record) => {
    const item = document.createElement("li");
    const changeClass =
      record.change > 0
        ? "history-change--up"
        : record.change === 0
          ? "history-change--flat"
          : "";
    item.className = "history-round-card";
    item.innerHTML = `
      <div class="history-round-heading">
        <span class="history-round-number">Ronda ${record.round}</span>
        <span class="history-suit ${isRedSuit(record.suit) ? "history-suit--red" : ""}">
          <span class="history-suit-symbol" aria-hidden="true">${SUIT_SYMBOLS[record.suit]}</span>
          ${SUIT_NAMES[record.suit]}
        </span>
      </div>
      <div class="history-round-result">
        <div>
          <div class="history-result-text">${formatHistoryResult(record)}</div>
          <div class="history-score-path">${record.scoreBefore} → ${record.scoreAfter} pontos</div>
        </div>
        <span class="history-change ${changeClass}">${formatSignedChange(record.change)}</span>
      </div>
    `;
    historyList.append(item);
  });
}

function formatHistoryResult(record) {
  if (record.passed) {
    const streak = record.passStreakAfter;
    return streak ? `Passou (${streak}.º consecutivo)` : "Passou";
  }
  return `${record.tricks} ${record.tricks === 1 ? "vaza" : "vazas"}`;
}

function formatSignedChange(change) {
  return change > 0 ? `+${change}` : String(change);
}

function formatHistoryDetail(record) {
  return `Ronda ${record.round} · ${SUIT_NAMES[record.suit]} · ${formatHistoryResult(record)} · ${formatSignedChange(record.change)} pontos · ${record.scoreBefore} → ${record.scoreAfter}`;
}

function isRedSuit(suit) {
  return suit === "hearts" || suit === "diamonds";
}

function saveGame() {
  if (players.length === 0) return;

  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        players,
        currentRound,
        phase,
        selectedSuit,
        lastScoredRound,
        roundHistory,
      }),
    );
  } catch {
    // The game remains fully usable if browser storage is unavailable.
  }
}

function restoreSavedGame() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved?.version !== 1 || !Array.isArray(saved.players) || saved.players.length < 2) {
      return false;
    }

    roundHistory = Array.isArray(saved.roundHistory) ? saved.roundHistory : [];
    players = saved.players.map((player) => ({
      ...player,
      consecutivePasses: Number.isInteger(player.consecutivePasses)
        ? player.consecutivePasses
        : deriveConsecutivePasses(player.id, roundHistory),
    }));
    currentRound = Number.isInteger(saved.currentRound) ? saved.currentRound : 1;
    phase = saved.phase === "choosing" ? "choosing" : "idle";
    selectedSuit = SUIT_NAMES[saved.selectedSuit] ? saved.selectedSuit : null;
    lastScoredRound = normalizeCorrectionSnapshot(saved.lastScoredRound);
    setupScreen.hidden = true;
    gameScreen.hidden = false;
    renderGame();

    const winners = players.filter((player) => player.score === 0);
    if (phase === "idle" && winners.length > 0) showWinner(winners);
    return true;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return false;
  }
}

function deriveConsecutivePasses(playerId, history) {
  let count = 0;
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const result = history[index].players?.find((item) => item.id === playerId);
    if (!result) continue;
    if (!result.passed) break;
    count += 1;
  }
  return Math.min(MAX_CONSECUTIVE_PASSES, count);
}

function normalizeCorrectionSnapshot(snapshot) {
  if (!snapshot?.players) return null;
  const priorHistory = roundHistory.slice(0, snapshot.historyLength ?? roundHistory.length);
  return {
    ...snapshot,
    players: snapshot.players.map((player) => ({
      ...player,
      consecutivePasses: Number.isInteger(player.consecutivePasses)
        ? player.consecutivePasses
        : deriveConsecutivePasses(player.id, priorHistory),
    })),
  };
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
historyClose.addEventListener("click", () => historyDialog.close());
historyDialog.addEventListener("click", (event) => {
  if (event.target === historyDialog) historyDialog.close();
});

renderNameFields();
restoreSavedGame();
