import {
  autoChooseRandomColor,
  createMatchState,
} from "./modules/matchState.js";
import { resolveRound } from "./modules/roundResolver.js";

const initialGameConfig = {
  format: 3,
  bestOf: 3,
  timerSeconds: 30,
  mode: "standard",
};

let state = {
  match: createMatchState(initialGameConfig),
  round: {
    p1Choice: null,
    p2Choice: null,
    p1Locked: false,
    p2Locked: false,
    timeLeft: 30,
    timerId: null,
  },
  ui: {
    result: null,
    isRunning: false,
  },
};

document.querySelectorAll("select[data-rule]").forEach((select) => {
  select.addEventListener("change", (event) => {
    const rule = event.target.dataset.rule;
    const rawValue = event.target.value;

    state.match[rule] = rule === "mode" ? rawValue : Number(rawValue);

    state.match = createMatchState(state.match);
    render();
  });
});

document.querySelectorAll("[data-color]").forEach((button) => {
  button.addEventListener("click", () => {
    const playerKey = button.dataset.player;
    const color = button.dataset.color;
    handleColorSelection(playerKey, color);
  });
});

document.querySelectorAll("[data-action]").forEach((button) => {
  button.addEventListener("click", () => {
    const playerKey = button.dataset.player;
    handleLock(playerKey);
  });
});

function handleColorSelection(playerKey, color) {
  if (state.round[`${playerKey}Locked`]) return;
  console.log(color);
  state.round[`${playerKey}Choice`] = color;
  render();
}

function handleLock(playerKey) {
  if (!state.round[`${playerKey}Choice`]) return;
  state.round[`${playerKey}Locked`] = true;
  tryResolveIfReady();
  render();
}

const startBtn = document.querySelector("#start");

startBtn.addEventListener("click", startTimer);

function stopTimer() {
  if (state.round.timerId) {
    clearInterval(state.round.timerId);
    state.round.timerId = null;
  }

  state.ui.isRunning = false;
}

function startTimer() {
  if (state.ui.isRunning) return;

  stopTimer();
  state.ui.isRunning = true;
  state.round.timeLeft = state.match.timerSeconds;

  state.round.timerId = setInterval(() => {
    state.round.timeLeft -= 1;

    if (state.round.timeLeft <= 0) {
      clearInterval(state.round.timerId);
      state.round.timerId = null;
      state.round.p1Choice ??= autoChooseRandomColor(state.match.players.p1);
      state.round.p2Choice ??= autoChooseRandomColor(state.match.players.p2);
      resolveCurrentRound();
      return;
    }

    render();
  }, 1000);
}

function resolveCurrentRound() {
  stopTimer();

  const result = resolveRound(state.match, {
    p1: state.round.p1Choice,
    p2: state.round.p2Choice,
  });

  state.ui.result = result;

  if (state.match.complete) {
    const winnerKey = state.match.winner;
    const winnerName = state.match.players[winnerKey].name;
    alert(`${winnerName} has won the match!`);
    resetMatchState();
    render();
    return;
  }

  resetRoundState();
  render();
}

function resetRoundState() {
  state.round.p1Choice = null;
  state.round.p2Choice = null;
  state.round.p1Locked = false;
  state.round.p2Locked = false;
  state.round.timeLeft = state.match.timerSeconds;
  state.ui.isRunning = false;
}

function resetMatchState() {
  state.match = createMatchState(initialGameConfig);
  resetRoundState();
}

function render() {
  const scoreEl = document.querySelector("#score");
  const resultEl = document.querySelector("#result");
  const rulesEl = document.querySelector("#currentRules");
  const timerEl = document.querySelector("#timer");

  scoreEl.textContent = `${state.match.scores.p1} - ${state.match.scores.p2}`;
  timerEl.textContent = String(state.round.timeLeft);

  resultEl.textContent = state.ui.result
    ? JSON.stringify(state.ui.result, null, 2)
    : "Nessun round ancora eseguito";

  rulesEl.textContent = JSON.stringify(state.match);
}

function tryResolveIfReady() {
  const bothSelected = Boolean(state.round.p1Choice && state.round.p2Choice);
  const bothLocked = state.round.p1Locked && state.round.p2Locked;

  if (bothSelected && bothLocked) {
    resolveCurrentRound();
  }
}

render();
