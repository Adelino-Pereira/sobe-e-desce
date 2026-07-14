const appUrl = new URL("../index.html", import.meta.url).href;
const tab = await fetch(`http://127.0.0.1:9222/json/new?${encodeURIComponent(appUrl)}`, {
  method: "PUT",
}).then((response) => response.json());

const socket = new WebSocket(tab.webSocketDebuggerUrl);
const pending = new Map();
let messageId = 0;

socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  const request = pending.get(message.id);
  if (!request) return;
  pending.delete(message.id);
  message.error ? request.reject(message.error) : request.resolve(message.result);
});

await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});

function command(method, params = {}) {
  messageId += 1;
  socket.send(JSON.stringify({ id: messageId, method, params }));
  return new Promise((resolve, reject) => pending.set(messageId, { resolve, reject }));
}

async function evaluate(expression) {
  const result = await command("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

await command("Runtime.enable");
await new Promise((resolve) => setTimeout(resolve, 300));

const setup = await evaluate(`(() => {
  const count = document.querySelector("#player-count");
  count.value = "2";
  count.dispatchEvent(new Event("change", { bubbles: true }));
  const names = document.querySelectorAll(".name-input");
  names[0].value = "Ada";
  names[1].value = "Linus";
  document.querySelector("#setup-form").requestSubmit();
  return {
    setupHidden: document.querySelector("#setup-screen").hidden,
    cardCount: document.querySelectorAll(".player-card").length,
    scores: [...document.querySelectorAll(".score-value")].map((node) => node.textContent),
  };
})()`);

assert(setup.setupHidden, "Submitting setup should open the game screen.");
assert(setup.cardCount === 2, "The game should render two player cards.");
assert(setup.scores.join(",") === "20,20", "Every player should start at 20 points.");

const heartRound = await evaluate(`(() => {
  document.querySelector("#start-round-button").click();
  document.querySelector('[data-suit="hearts"]').click();
  const inputs = document.querySelectorAll(".trick-input");
  inputs[0].value = "2";
  inputs[0].dispatchEvent(new Event("input", { bubbles: true }));
  const autoCompleted = inputs[1].value;
  const canUpdate = !document.querySelector("#update-scores-button").disabled;
  document.querySelector("#update-scores-button").click();
  return {
    autoCompleted,
    canUpdate,
    scores: [...document.querySelectorAll(".score-value")].map((node) => node.textContent),
    inputsLocked: [...document.querySelectorAll(".trick-input")].every((input) => input.disabled),
  };
})()`);

assert(heartRound.autoCompleted === "3", "A 2/3 split should autocomplete the second player to 3.");
assert(heartRound.canUpdate, "Exactly five assigned tricks should enable score updates.");
assert(heartRound.scores.join(",") === "16,14", "Hearts should double the deductions to 4 and 6.");
assert(heartRound.inputsLocked, "Inputs should lock after scores are updated.");

const clubRound = await evaluate(`(() => {
  document.querySelector("#start-round-button").click();
  document.querySelector('[data-suit="clubs"]').click();
  const passDisabled = [...document.querySelectorAll(".pass-button")].every((button) => button.disabled);
  const inputs = document.querySelectorAll(".trick-input");
  inputs[0].value = "0";
  inputs[0].dispatchEvent(new Event("input", { bubbles: true }));
  const autoCompleted = inputs[1].value;
  document.querySelector("#update-scores-button").click();
  return {
    passDisabled,
    autoCompleted,
    scores: [...document.querySelectorAll(".score-value")].map((node) => node.textContent),
  };
})()`);

assert(clubRound.passDisabled, "Clubs should disable every pass button.");
assert(clubRound.autoCompleted === "5", "A zero should autocomplete the other player to five.");
assert(clubRound.scores.join(",") === "21,9", "Normal scoring should add 5 for zero and deduct tricks won.");

console.log("Browser smoke test passed: setup, autocomplete, hearts, clubs, and round locking.");
await command("Page.close");
socket.close();
